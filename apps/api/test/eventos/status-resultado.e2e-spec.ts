import {
  eventoDtoSchema,
  statusEventoAlteradoDtoSchema,
  type Papel,
  type StatusEvento,
} from '@atletica/shared'
import request from 'supertest'
import type { RespostaErro } from '../../src/common/erros/erro-negocio'
import type { Evento, Time } from '../../src/generated/prisma/client'
import { AuditoriaService } from '../../src/modules/auditoria/auditoria.service'
import { EventosStatusService } from '../../src/modules/eventos/eventos-status.service'
import { EventosService } from '../../src/modules/eventos/eventos.service'
import { aguardarOuvintes, espiarEventos, type EspiaoEventos } from '../eventos'
import { criarAtletica } from '../fabricas/atletica'
import { tokenPara } from '../fabricas/auth'
import { criarEvento, criarJogo, criarTreino } from '../fabricas/eventos'
import { criarModalidade } from '../fabricas/modalidades'
import { criarAtleticaAdversaria, criarTime, criarTimeAdversario } from '../fabricas/times'
import { criarUsuario, type UsuarioCriado } from '../fabricas/usuario'
import { criarApp, type AppDeTeste } from '../setup/criar-app'
import { prismaTeste } from '../setup/prisma-teste'

const ROTA = '/api/v1/eventos'
const erro = (resposta: { body: unknown }) => resposta.body as RespostaErro

/** Libera as `total` chamadas só quando todas chegaram (leitura feita, gravação pendente). */
function barreira(total: number) {
  let chegaram = 0
  let liberar!: () => void
  const liberada = new Promise<void>((resolver) => (liberar = resolver))
  return async () => {
    chegaram += 1
    if (chegaram === total) liberar()
    await liberada
  }
}

describe('/eventos — status e resultado (#73)', () => {
  let contexto: AppDeTeste
  let eventos: EspiaoEventos
  let atleticaId: string
  let time: Time
  let adversario: Time

  beforeAll(async () => {
    contexto = await criarApp()
  })

  beforeEach(async () => {
    atleticaId = (await criarAtletica()).id
    const voleiId = (await criarModalidade({ nome: 'Vôlei' })).id
    time = await criarTime({ atleticaId, modalidadeId: voleiId })
    const medicina = await criarAtleticaAdversaria()
    adversario = await criarTimeAdversario({ atleticaId: medicina.id, modalidadeId: voleiId })
    eventos = espiarEventos(contexto.app)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  afterAll(async () => {
    await contexto.app.close()
  })

  async function como(papel: Papel | UsuarioCriado) {
    const alvo = typeof papel === 'string' ? await criarUsuario({ papel, atleticaId }) : papel
    const auth = `Bearer ${await tokenPara(alvo)}`
    const http = contexto.http
    return {
      status: (id: string, status: string) =>
        request(http).patch(`${ROTA}/${id}/status`).set('Authorization', auth).send({ status }),
      resultado: (id: string, corpo: object) =>
        request(http).put(`${ROTA}/${id}/resultado`).set('Authorization', auth).send(corpo),
    }
  }

  const diretor = () => criarUsuario({ papel: 'DIRETOR', atleticaId })

  const novoJogo = (dados: Partial<Evento> = {}) =>
    criarJogo({ atleticaId, timeId: time.id, timeAdversarioId: adversario.id, ...dados })
  const jogoFinalizado = (placar?: [number, number, 'VITORIA' | 'EMPATE' | 'DERROTA']) =>
    novoJogo({
      status: 'FINALIZADO',
      ...(placar && {
        placarTime: placar[0],
        placarAdversario: placar[1],
        resultado: placar[2],
      }),
    })

  const registros = () =>
    prismaTeste.registroAuditoria.findMany({
      where: { entidade: 'Evento' },
      orderBy: { criadoEm: 'asc' },
    })
  const linha = (id: string) => prismaTeste.evento.findUniqueOrThrow({ where: { id } })

  async function emitidos() {
    await aguardarOuvintes()
    return eventos.emitidos().filter(({ nome }) => nome.startsWith('evento.'))
  }

  describe('PATCH /eventos/:id/status', () => {
    it('AGENDADO → EM_ANDAMENTO: 200, auditoria e evento.alterado com campos ["status"] (critério 1)', async () => {
      const autor = await diretor()
      const evento = await novoJogo()
      const resposta = await (await como(autor)).status(evento.id, 'EM_ANDAMENTO')

      expect(resposta.status).toBe(200)
      expect(resposta.headers['cache-control']).toBe('no-store')
      expect(statusEventoAlteradoDtoSchema.parse(resposta.body)).toEqual({
        id: evento.id,
        status: 'EM_ANDAMENTO',
        statusAnterior: 'AGENDADO',
      })
      await expect(linha(evento.id)).resolves.toMatchObject({ status: 'EM_ANDAMENTO' })
      const [registro, ...outros] = await registros()
      expect(outros).toHaveLength(0)
      expect(registro).toMatchObject({
        acao: 'EVENTO_STATUS_ALTERADO',
        entidadeId: evento.id,
        usuarioId: autor.id,
        dados: { antes: { status: 'AGENDADO' }, depois: { status: 'EM_ANDAMENTO' } },
      })
      await expect(emitidos()).resolves.toEqual([
        {
          nome: 'evento.alterado',
          payload: {
            atleticaId,
            eventoIds: [evento.id],
            timeId: time.id,
            campos: ['status'],
            autorId: autor.id,
          },
        },
      ])
    })

    it.each<[StatusEvento, StatusEvento]>([
      ['EM_ANDAMENTO', 'FINALIZADO'],
      ['AGENDADO', 'FINALIZADO'],
      ['FINALIZADO', 'EM_ANDAMENTO'],
      ['EM_ANDAMENTO', 'AGENDADO'],
    ])('%s → %s: 200 (critérios 2, 3 e 5)', async (de, para) => {
      const evento = await novoJogo({ status: de })
      const resposta = await (await como('DIRETOR')).status(evento.id, para)
      expect(resposta.status).toBe(200)
      await expect(linha(evento.id)).resolves.toMatchObject({ status: para })
    })

    it.each<StatusEvento>(['AGENDADO', 'EM_ANDAMENTO', 'FINALIZADO'])(
      'CANCELADO → %s: 422 TRANSICAO_INVALIDA com de/para (critério 4)',
      async (para) => {
        const evento = await novoJogo({ status: 'CANCELADO' })
        const resposta = await (await como('DIRETOR')).status(evento.id, para)
        expect(resposta.status).toBe(422)
        expect(erro(resposta)).toMatchObject({
          code: 'TRANSICAO_INVALIDA',
          details: [{ field: 'status', message: `CANCELADO → ${para} não é permitido` }],
        })
        await expect(linha(evento.id)).resolves.toMatchObject({ status: 'CANCELADO' })
      },
    )

    it('FINALIZADO com resultado → EM_ANDAMENTO: 422 TRANSICAO_INVALIDA (critério 5)', async () => {
      const evento = await jogoFinalizado([3, 1, 'VITORIA'])
      const resposta = await (await como('DIRETOR')).status(evento.id, 'EM_ANDAMENTO')
      expect(resposta.status).toBe(422)
      expect(erro(resposta).code).toBe('TRANSICAO_INVALIDA')
    })

    it.each<StatusEvento>(['AGENDADO', 'CANCELADO'])(
      'FINALIZADO → %s: 422 TRANSICAO_INVALIDA (critério 6)',
      async (para) => {
        const evento = await jogoFinalizado()
        const resposta = await (await como('DIRETOR')).status(evento.id, para)
        expect(resposta.status).toBe(422)
        expect(erro(resposta).code).toBe('TRANSICAO_INVALIDA')
        await expect(registros()).resolves.toHaveLength(0)
      },
    )

    it('EM_ANDAMENTO com presença → AGENDADO: 422 TRANSICAO_INVALIDA', async () => {
      const atleta = await criarUsuario({ papel: 'ATLETA', atleticaId })
      const evento = await criarTreino({
        atleticaId,
        timeId: time.id,
        status: 'EM_ANDAMENTO',
        participantes: [{ usuarioId: atleta.id, presente: true }],
      })
      const resposta = await (await como('DIRETOR')).status(evento.id, 'AGENDADO')
      expect(resposta.status).toBe(422)
      expect(erro(resposta).code).toBe('TRANSICAO_INVALIDA')
    })

    it('EM_ANDAMENTO → CANCELADO: cancelamento da #70 e evento.cancelado (critério 7)', async () => {
      const autor = await diretor()
      const evento = await novoJogo({ status: 'EM_ANDAMENTO' })
      const resposta = await (await como(autor)).status(evento.id, 'CANCELADO')

      expect(resposta.status).toBe(200)
      expect(resposta.body).toEqual({
        id: evento.id,
        status: 'CANCELADO',
        statusAnterior: 'EM_ANDAMENTO',
      })
      await expect(linha(evento.id)).resolves.toMatchObject({ status: 'CANCELADO' })
      await expect(registros()).resolves.toEqual([
        expect.objectContaining({
          acao: 'EVENTO_CANCELADO',
          usuarioId: autor.id,
          dados: { antes: { status: 'EM_ANDAMENTO' }, depois: { status: 'CANCELADO' } },
        }),
      ])
      await expect(emitidos()).resolves.toEqual([
        {
          nome: 'evento.cancelado',
          payload: { atleticaId, eventoIds: [evento.id], timeId: time.id, autorId: autor.id },
        },
      ])
    })

    it('mesmo status: 200 sem auditoria nem evento (critério 8)', async () => {
      const evento = await novoJogo()
      const resposta = await (await como('DIRETOR')).status(evento.id, 'AGENDADO')
      expect(resposta.status).toBe(200)
      expect(resposta.body).toEqual({
        id: evento.id,
        status: 'AGENDADO',
        statusAnterior: 'AGENDADO',
      })
      await expect(registros()).resolves.toHaveLength(0)
      await expect(emitidos()).resolves.toEqual([])
      await expect(linha(evento.id)).resolves.toEqual(evento)
    })

    it('concorrência a partir de AGENDADO: uma 200 e outra 409 CONFLITO_STATUS (critério 9)', async () => {
      const evento = await novoJogo()
      const esperar = barreira(2)
      const status = contexto.app.get(EventosStatusService)
      const trocar = status.trocar.bind(status)
      jest.spyOn(status, 'trocar').mockImplementation(async (...args) => {
        await esperar()
        return trocar(...args)
      })
      const servico = contexto.app.get(EventosService)
      const cancelar = servico.cancelar.bind(servico)
      jest.spyOn(servico, 'cancelar').mockImplementation(async (...args) => {
        await esperar()
        return cancelar(...args)
      })

      const [a, b] = await Promise.all([
        (await como('DIRETOR')).status(evento.id, 'EM_ANDAMENTO'),
        (await como('DIRETOR')).status(evento.id, 'CANCELADO'),
      ])

      expect([a.status, b.status].sort()).toEqual([200, 409])
      const perdedora = a.status === 409 ? a : b
      expect(erro(perdedora).code).toBe('CONFLITO_STATUS')
      const vencedora = a.status === 200 ? a : b
      await expect(linha(evento.id)).resolves.toMatchObject({
        status: (vencedora.body as { status: string }).status,
      })
      await expect(registros()).resolves.toHaveLength(1)
      await expect(emitidos()).resolves.toHaveLength(1)
    })

    it.each([{}, { status: 'ENCERRADO' }, { status: 'AGENDADO', extra: 1 }])(
      'corpo %j: 400 VALIDATION_ERROR',
      async (corpo) => {
        const evento = await novoJogo()
        const auth = `Bearer ${await tokenPara(await diretor())}`
        const resposta = await request(contexto.http)
          .patch(`${ROTA}/${evento.id}/status`)
          .set('Authorization', auth)
          .send(corpo)
        expect(resposta.status).toBe(400)
        expect(erro(resposta).code).toBe('VALIDATION_ERROR')
      },
    )
  })

  describe('PUT /eventos/:id/resultado', () => {
    it('primeiro registro: 200 VITORIA, auditoria e evento.resultadoRegistrado (critério 10)', async () => {
      const autor = await diretor()
      const evento = await jogoFinalizado()
      const resposta = await (
        await como(autor)
      ).resultado(evento.id, {
        placarTime: 3,
        placarAdversario: 1,
      })

      expect(resposta.status).toBe(200)
      expect(resposta.headers['cache-control']).toBe('no-store')
      expect(eventoDtoSchema.parse(resposta.body)).toMatchObject({
        id: evento.id,
        status: 'FINALIZADO',
        placarTime: 3,
        placarAdversario: 1,
        resultado: 'VITORIA',
      })
      await expect(registros()).resolves.toEqual([
        expect.objectContaining({
          acao: 'RESULTADO_REGISTRADO',
          entidadeId: evento.id,
          usuarioId: autor.id,
          dados: {
            antes: { placarTime: null, placarAdversario: null, resultado: null },
            depois: { placarTime: 3, placarAdversario: 1, resultado: 'VITORIA' },
          },
        }),
      ])
      await expect(emitidos()).resolves.toEqual([
        {
          nome: 'evento.resultadoRegistrado',
          payload: { atleticaId, eventoId: evento.id, autorId: autor.id },
        },
      ])
    })

    it.each([
      [1, 1, 'EMPATE'],
      [0, 2, 'DERROTA'],
    ])('%i × %i → %s (critério 11)', async (placarTime, placarAdversario, resultado) => {
      const evento = await jogoFinalizado()
      const resposta = await (
        await como('DIRETOR')
      ).resultado(evento.id, {
        placarTime,
        placarAdversario,
      })
      expect(resposta.status).toBe(200)
      await expect(linha(evento.id)).resolves.toMatchObject({ resultado })
    })

    it('correção 3×1 → 2×2: EMPATE, RESULTADO_CORRIGIDO e nenhum evento (critério 12)', async () => {
      const evento = await jogoFinalizado([3, 1, 'VITORIA'])
      const resposta = await (
        await como('DIRETOR')
      ).resultado(evento.id, {
        placarTime: 2,
        placarAdversario: 2,
      })

      expect(resposta.status).toBe(200)
      expect(resposta.body).toMatchObject({ resultado: 'EMPATE' })
      await expect(registros()).resolves.toEqual([
        expect.objectContaining({
          acao: 'RESULTADO_CORRIGIDO',
          dados: {
            antes: { placarTime: 3, placarAdversario: 1, resultado: 'VITORIA' },
            depois: { placarTime: 2, placarAdversario: 2, resultado: 'EMPATE' },
          },
        }),
      ])
      await expect(emitidos()).resolves.toEqual([])
    })

    it('mesmo placar: 200 sem gravação, auditoria nem evento', async () => {
      const evento = await jogoFinalizado([3, 1, 'VITORIA'])
      const resposta = await (
        await como('DIRETOR')
      ).resultado(evento.id, {
        placarTime: 3,
        placarAdversario: 1,
      })
      expect(resposta.status).toBe(200)
      await expect(linha(evento.id)).resolves.toEqual(evento)
      await expect(registros()).resolves.toHaveLength(0)
      await expect(emitidos()).resolves.toEqual([])
    })

    it('EM_ANDAMENTO sem finalizar: 422 EVENTO_NAO_FINALIZADO (critério 13)', async () => {
      const evento = await novoJogo({ status: 'EM_ANDAMENTO' })
      const resposta = await (
        await como('DIRETOR')
      ).resultado(evento.id, {
        placarTime: 3,
        placarAdversario: 1,
      })
      expect(resposta.status).toBe(422)
      expect(erro(resposta).code).toBe('EVENTO_NAO_FINALIZADO')
      await expect(linha(evento.id)).resolves.toEqual(evento)
    })

    it.each<StatusEvento>(['EM_ANDAMENTO', 'AGENDADO'])(
      '%s com finalizar: FINALIZADO e placar na mesma transação, duas auditorias (critério 14)',
      async (de) => {
        const evento = await novoJogo({ status: de })
        const resposta = await (
          await como('DIRETOR')
        ).resultado(evento.id, {
          placarTime: 0,
          placarAdversario: 0,
          finalizar: true,
        })

        expect(resposta.status).toBe(200)
        expect(resposta.body).toMatchObject({ status: 'FINALIZADO', resultado: 'EMPATE' })
        const acoes = (await registros()).map(({ acao }) => acao)
        expect(acoes).toEqual(['EVENTO_STATUS_ALTERADO', 'RESULTADO_REGISTRADO'])
        const nomes = (await emitidos()).map(({ nome }) => nome)
        expect(nomes).toEqual(['evento.alterado', 'evento.resultadoRegistrado'])
      },
    )

    it('finalizar com falha na gravação do placar: rollback do status, sem auditoria nem evento', async () => {
      const evento = await novoJogo({ status: 'EM_ANDAMENTO' })
      const auditoria = contexto.app.get(AuditoriaService)
      const registrar = auditoria.registrar.bind(auditoria)
      jest.spyOn(auditoria, 'registrar').mockImplementation(async (tx, entrada) => {
        if (entrada.acao === 'RESULTADO_REGISTRADO') throw new Error('falha no placar')
        return registrar(tx, entrada)
      })

      const resposta = await (
        await como('DIRETOR')
      ).resultado(evento.id, {
        placarTime: 3,
        placarAdversario: 1,
        finalizar: true,
      })

      expect(resposta.status).toBe(500)
      await expect(linha(evento.id)).resolves.toEqual(evento)
      await expect(registros()).resolves.toHaveLength(0)
      await expect(emitidos()).resolves.toEqual([])
    })

    it.each([undefined, true])(
      'CANCELADO (finalizar: %s): 422 EVENTO_CANCELADO (critério 15)',
      async (finalizar) => {
        const evento = await novoJogo({ status: 'CANCELADO' })
        const resposta = await (
          await como('DIRETOR')
        ).resultado(evento.id, {
          placarTime: 3,
          placarAdversario: 1,
          finalizar,
        })
        expect(resposta.status).toBe(422)
        expect(erro(resposta).code).toBe('EVENTO_CANCELADO')
      },
    )

    it('TREINO: 422 EVENTO_NAO_E_JOGO (critério 16)', async () => {
      const evento = await criarTreino({ atleticaId, timeId: time.id, status: 'FINALIZADO' })
      const resposta = await (
        await como('DIRETOR')
      ).resultado(evento.id, {
        placarTime: 3,
        placarAdversario: 1,
      })
      expect(resposta.status).toBe(422)
      expect(erro(resposta).code).toBe('EVENTO_NAO_E_JOGO')
    })

    it.each([
      { placarTime: -1, placarAdversario: 0 },
      { placarTime: 1000, placarAdversario: 0 },
      { placarTime: 2.5, placarAdversario: 0 },
      { placarAdversario: 0 },
      { placarTime: 1, placarAdversario: 0, resultado: 'VITORIA' },
    ])('corpo %j: 400 VALIDATION_ERROR (critério 17)', async (corpo) => {
      const evento = await jogoFinalizado()
      const resposta = await (await como('DIRETOR')).resultado(evento.id, corpo)
      expect(resposta.status).toBe(400)
      expect(erro(resposta).code).toBe('VALIDATION_ERROR')
      await expect(linha(evento.id)).resolves.toEqual(evento)
    })
  })

  describe('autorização (critério 18, convenções §9)', () => {
    const PLACAR = { placarTime: 1, placarAdversario: 0 }

    it('sem token → 401 nas duas rotas', async () => {
      const evento = await jogoFinalizado()
      const respostas = [
        await request(contexto.http)
          .patch(`${ROTA}/${evento.id}/status`)
          .send({ status: 'EM_ANDAMENTO' }),
        await request(contexto.http).put(`${ROTA}/${evento.id}/resultado`).send(PLACAR),
      ]
      for (const resposta of respostas) {
        expect(resposta.status).toBe(401)
        expect(erro(resposta).code).toBe('UNAUTHENTICATED')
      }
    })

    it('ATLETA → 403 nas duas rotas', async () => {
      const evento = await jogoFinalizado()
      const api = await como('ATLETA')
      const respostas = [
        await api.status(evento.id, 'EM_ANDAMENTO'),
        await api.resultado(evento.id, PLACAR),
      ]
      expect(respostas.map(({ status }) => status)).toEqual([403, 403])
      expect(respostas.every((resposta) => erro(resposta).code === 'FORBIDDEN')).toBe(true)
      await expect(linha(evento.id)).resolves.toEqual(evento)
    })

    it('evento de outra atlética ou excluído → 404 nas duas rotas', async () => {
      const alheio = await criarEvento({
        atleticaId: (await criarAtletica()).id,
        tipo: 'JOGO',
        status: 'FINALIZADO',
      })
      const excluido = await novoJogo({ status: 'FINALIZADO', excluidoEm: new Date() })
      const api = await como('DIRETOR')
      const respostas = [
        await api.status(alheio.id, 'EM_ANDAMENTO'),
        await api.resultado(alheio.id, PLACAR),
        await api.status(excluido.id, 'EM_ANDAMENTO'),
        await api.resultado(excluido.id, PLACAR),
      ]
      expect(respostas.map(({ status }) => status)).toEqual([404, 404, 404, 404])
      expect(respostas.every((resposta) => erro(resposta).code === 'NOT_FOUND')).toBe(true)
      await expect(linha(alheio.id)).resolves.toEqual(alheio)
    })
  })
})
