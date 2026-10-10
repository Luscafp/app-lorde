import { alcanceAvisoSchema, avisoEnviadoSchema, type Papel } from '@atletica/shared'
import request from 'supertest'
import type { RespostaErro } from '../../src/common/erros/erro-negocio'
import { AuditoriaService } from '../../src/modules/auditoria/auditoria.service'
import type { FakeExpoPush } from '../../src/modules/notificacoes/envio/fake-expo-push'
import { criarAtletica } from '../fabricas/atletica'
import { tokenPara } from '../fabricas/auth'
import { criarDispositivo, criarPreferencias, fakeExpo } from '../fabricas/notificacoes'
import { adicionarMembro, criarTime, criarTimeAdversario } from '../fabricas/times'
import { criarUsuario, type UsuarioCriado } from '../fabricas/usuario'
import { criarApp, type AppDeTeste } from '../setup/criar-app'
import { processarFilas } from '../setup/fila'
import { prismaTeste } from '../setup/prisma-teste'

const ROTA = '/api/v1/avisos'
const ROTA_ALCANCE = `${ROTA}/alcance`
const ID_INEXISTENTE = '0b6f8a52-8e5d-4a43-9d6c-1f0f3c2b7a90'
const TEXTO = {
  titulo: 'Treino cancelado hoje',
  mensagem: 'Por causa da chuva, o treino das 19h está cancelado.',
}
const erro = (resposta: { body: unknown }) => resposta.body as RespostaErro

describe('/avisos (#38)', () => {
  let contexto: AppDeTeste
  let expo: FakeExpoPush
  let atleticaId: string
  let diretor: UsuarioCriado

  beforeAll(async () => {
    contexto = await criarApp()
    expo = fakeExpo(contexto.app)
  })

  beforeEach(async () => {
    expo.limpar()
    atleticaId = (await criarAtletica()).id
    diretor = await criarUsuario({ papel: 'DIRETOR', atleticaId })
  })

  afterAll(async () => {
    await contexto.app.close()
  })

  async function como(usuario: UsuarioCriado = diretor) {
    const auth = `Bearer ${await tokenPara(usuario)}`
    return {
      enviar: (corpo: object) =>
        request(contexto.http).post(ROTA).set('Authorization', auth).send(corpo),
      alcance: (consulta: object) =>
        request(contexto.http).get(ROTA_ALCANCE).set('Authorization', auth).query(consulta),
    }
  }

  async function comAparelho(papel: Papel = 'ATLETA') {
    const usuario = await criarUsuario({ papel, atleticaId })
    const dispositivo = await criarDispositivo(usuario)
    return { ...usuario, dispositivo }
  }

  const tokensEnviados = () =>
    expo
      .enviadas()
      .map(({ to }) => to)
      .sort()
  const auditoria = () =>
    prismaTeste.registroAuditoria.findMany({ where: { atleticaId, entidade: 'Aviso' } })

  describe('autenticação e papel', () => {
    it.each([
      ['post', ROTA],
      ['get', `${ROTA_ALCANCE}?destino=TODOS`],
    ] as const)('sem token: %s %s → 401', async (metodo, rota) => {
      const resposta = await request(contexto.http)[metodo](rota)
      expect(resposta.status).toBe(401)
      expect(erro(resposta).code).toBe('UNAUTHENTICATED')
    })

    it('atleta → 403 nas duas rotas, sem auditoria (critério 9)', async () => {
      const api = await como(await criarUsuario({ atleticaId }))
      const envio = await api.enviar({ destino: 'TODOS', ...TEXTO })
      const alcance = await api.alcance({ destino: 'TODOS' })
      expect([envio.status, erro(envio).code]).toEqual([403, 'FORBIDDEN'])
      expect([alcance.status, erro(alcance).code]).toEqual([403, 'FORBIDDEN'])
      expect(await auditoria()).toHaveLength(0)
    })

    it.each(['DIRETOR', 'PRESIDENTE'] as const)('%s → 202', async (papel) => {
      const remetente = await criarUsuario({ papel, atleticaId })
      const resposta = await (await como(remetente)).enviar({ destino: 'TODOS', ...TEXTO })
      expect(resposta.status).toBe(202)
    })
  })

  describe('validação', () => {
    it('TIME sem timeId → 400 com details[0].field = timeId (critério 5)', async () => {
      const resposta = await (await como()).enviar({ destino: 'TIME', ...TEXTO })
      expect(resposta.status).toBe(400)
      expect(erro(resposta).code).toBe('VALIDATION_ERROR')
      expect(erro(resposta).details[0]?.field).toBe('timeId')
    })

    it.each([
      ['título com 66 caracteres', { ...TEXTO, titulo: 'x'.repeat(66) }, 'titulo'],
      ['mensagem vazia', { ...TEXTO, mensagem: '' }, 'mensagem'],
    ])('%s → 400 (critério 8)', async (_, texto, campo) => {
      const resposta = await (await como()).enviar({ destino: 'TODOS', ...texto })
      expect(resposta.status).toBe(400)
      expect(erro(resposta).details[0]?.field).toBe(campo)
      expect(await auditoria()).toHaveLength(0)
    })

    it('alcance com TIME sem timeId → 400', async () => {
      const resposta = await (await como()).alcance({ destino: 'TIME' })
      expect(resposta.status).toBe(400)
      expect(erro(resposta).details[0]?.field).toBe('timeId')
    })
  })

  describe('time do destino', () => {
    it.each([
      ['inexistente', () => Promise.resolve(ID_INEXISTENTE)],
      [
        'de outra atlética (critério 7)',
        async () => (await criarTime({ atleticaId: (await criarAtletica()).id })).id,
      ],
    ])('%s → 404 no envio e no alcance', async (_, timeId) => {
      const id = await timeId()
      const api = await como()
      const envio = await api.enviar({ destino: 'TIME', timeId: id, ...TEXTO })
      const alcance = await api.alcance({ destino: 'TIME', timeId: id })
      expect([envio.status, erro(envio).code]).toEqual([404, 'NOT_FOUND'])
      expect([alcance.status, erro(alcance).code]).toEqual([404, 'NOT_FOUND'])
    })

    it.each([
      ['adversário (critério 6)', async () => (await criarTimeAdversario()).id],
      ['inativo', async () => (await criarTime({ atleticaId, ativo: false })).id],
    ])('%s → 422 TIME_INVALIDO_AVISO', async (_, timeId) => {
      const id = await timeId()
      const api = await como()
      const envio = await api.enviar({ destino: 'TIME', timeId: id, ...TEXTO })
      const alcance = await api.alcance({ destino: 'TIME', timeId: id })
      expect([envio.status, erro(envio).code]).toEqual([422, 'TIME_INVALIDO_AVISO'])
      expect([alcance.status, erro(alcance).code]).toEqual([422, 'TIME_INVALIDO_AVISO'])
      expect(await auditoria()).toHaveLength(0)
    })
  })

  describe('envio', () => {
    it('TODOS: elegíveis recebem, inclusive o remetente; avisos = false fica de fora (critérios 1, 2 e 15)', async () => {
      await criarDispositivo(diretor)
      const ana = await comAparelho()
      const semAvisos = await comAparelho()
      await criarPreferencias(semAvisos, { avisos: false })
      await criarUsuario({ atleticaId })

      const api = await como()
      const alcance = alcanceAvisoSchema.parse((await api.alcance({ destino: 'TODOS' })).body)
      const resposta = await api.enviar({ destino: 'TODOS', ...TEXTO })
      await processarFilas(contexto.app)

      expect(resposta.status).toBe(202)
      expect(avisoEnviadoSchema.parse(resposta.body).destinatarios).toBe(2)
      expect(alcance.destinatarios).toBe(2)
      const tokenDiretor = (
        await prismaTeste.dispositivoPush.findFirstOrThrow({
          where: { usuarioId: diretor.id },
        })
      ).tokenPush
      expect(tokensEnviados()).toEqual([ana.dispositivo.tokenPush, tokenDiretor].sort())
      expect(expo.enviadas()[0]).toMatchObject({
        title: TEXTO.titulo,
        body: TEXTO.mensagem,
        data: { url: '/', tipo: 'AVISOS' },
      })
    })

    it('TIME: só o elenco atual recebe e o toque abre o time (critério 3)', async () => {
      const time = await criarTime({ atleticaId })
      const membros = await Promise.all(Array.from({ length: 8 }, () => comAparelho()))
      for (const membro of membros) await adicionarMembro(time, membro)
      const exMembro = await comAparelho()
      await adicionarMembro(time, exMembro, { saidaEm: new Date() })
      await comAparelho()

      const resposta = await (await como()).enviar({ destino: 'TIME', timeId: time.id, ...TEXTO })
      await processarFilas(contexto.app)

      expect(avisoEnviadoSchema.parse(resposta.body).destinatarios).toBe(8)
      expect(tokensEnviados()).toEqual(
        membros.map(({ dispositivo }) => dispositivo.tokenPush).sort(),
      )
      expect(expo.enviadas().every(({ data }) => data?.url === `/times/${time.id}`)).toBe(true)
    })

    it('grava a auditoria do envio (critério 4)', async () => {
      const time = await criarTime({ atleticaId })
      await adicionarMembro(time, await comAparelho())

      const corpo = avisoEnviadoSchema.parse(
        (await (await como()).enviar({ destino: 'TIME', timeId: time.id, ...TEXTO })).body,
      )

      expect(await auditoria()).toEqual([
        expect.objectContaining({
          acao: 'AVISO_ENVIADO',
          entidade: 'Aviso',
          entidadeId: corpo.avisoId,
          usuarioId: diretor.id,
          dados: {
            antes: null,
            depois: { ...TEXTO, destino: 'TIME', timeId: time.id, destinatarios: 1 },
          },
        }),
      ])
    })

    it('nenhum elegível: 202 com 0 destinatários e auditoria gravada (critério 11)', async () => {
      const resposta = await (await como()).enviar({ destino: 'TODOS', ...TEXTO })
      await processarFilas(contexto.app)

      expect(resposta.status).toBe(202)
      expect(avisoEnviadoSchema.parse(resposta.body).destinatarios).toBe(0)
      expect(await auditoria()).toHaveLength(1)
      expect(expo.enviadas()).toHaveLength(0)
    })

    it('falha na auditoria: 500 e nada enfileirado', async () => {
      await comAparelho()
      const registrar = jest
        .spyOn(contexto.app.get(AuditoriaService), 'registrar')
        .mockRejectedValueOnce(new Error('falha simulada'))
      try {
        const resposta = await (await como()).enviar({ destino: 'TODOS', ...TEXTO })
        await processarFilas(contexto.app)
        expect(resposta.status).toBe(500)
        expect(expo.enviadas()).toHaveLength(0)
      } finally {
        registrar.mockRestore()
      }
    })

    it('11º aviso na mesma hora → 429 com Retry-After (critério 12)', async () => {
      const chave = `${atleticaId}:${diretor.id}`
      await prismaTeste.tentativaAcesso.createMany({
        data: Array.from({ length: 10 }, () => ({ tipo: 'AVISO_ENVIO', chave })),
      })

      const resposta = await (await como()).enviar({ destino: 'TODOS', ...TEXTO })

      expect(resposta.status).toBe(429)
      expect(erro(resposta).code).toBe('RATE_LIMITED')
      expect(Number(resposta.headers['retry-after'])).toBeGreaterThan(0)
      expect(await auditoria()).toHaveLength(0)
    })
  })
})
