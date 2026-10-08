import {
  listaAuditoriaSchema,
  registroAuditoriaDetalheSchema,
  type ListaAuditoria,
  type Papel,
} from '@atletica/shared'
import request from 'supertest'
import type { RespostaErro } from '../../src/common/erros/erro-negocio'
import { AtleticaPadraoService } from '../../src/modules/atleticas/atletica-padrao.service'
import { criarAtletica } from '../fabricas/atletica'
import { tokenPara } from '../fabricas/auth'
import { criarEvento } from '../fabricas/eventos'
import { criarTime } from '../fabricas/times'
import { criarUsuario, type UsuarioCriado } from '../fabricas/usuario'
import { criarApp, type AppDeTeste } from '../setup/criar-app'
import { prismaTeste } from '../setup/prisma-teste'

const ROTA = '/api/v1/auditoria'
const ID_INEXISTENTE = '0b6f8a52-8e5d-4a43-9d6c-1f0f3c2b7a90'
const DIA_MS = 24 * 60 * 60_000
const erro = (resposta: { body: unknown }) => resposta.body as RespostaErro
const lista = (resposta: { body: unknown }): ListaAuditoria =>
  listaAuditoriaSchema.parse(resposta.body)

interface DadosRegistro {
  atleticaId?: string
  usuarioId?: string | null
  acao?: string
  entidade?: string
  entidadeId?: string
  dados?: object
  criadoEm?: Date
}

describe('Consulta de auditoria (#39)', () => {
  let contexto: AppDeTeste
  let padraoId: string
  let presidente: UsuarioCriado

  const registrar = (dados: DadosRegistro = {}) =>
    prismaTeste.registroAuditoria.create({
      data: {
        atleticaId: dados.atleticaId ?? padraoId,
        usuarioId: dados.usuarioId === undefined ? presidente.id : dados.usuarioId,
        acao: dados.acao ?? 'MODALIDADE_CRIADA',
        entidade: dados.entidade ?? 'Modalidade',
        entidadeId: dados.entidadeId ?? ID_INEXISTENTE,
        dados: dados.dados ?? { antes: null, depois: { nome: 'Vôlei' } },
        criadoEm: dados.criadoEm ?? new Date(),
      },
    })

  async function como(solicitante: UsuarioCriado) {
    const token = await tokenPara(solicitante)
    const autenticar = (teste: request.Test) => teste.set('Authorization', `Bearer ${token}`)
    return {
      listar: (query: Record<string, string | number> = {}) =>
        autenticar(request(contexto.http).get(ROTA).query(query)),
      detalhar: (id: string) => autenticar(request(contexto.http).get(`${ROTA}/${id}`)),
      http: (metodo: 'post' | 'patch' | 'put' | 'delete', rota: string) =>
        autenticar(request(contexto.http)[metodo](rota).send({})),
    }
  }

  beforeAll(async () => {
    contexto = await criarApp()
    padraoId = contexto.app.get(AtleticaPadraoService).id()
  })

  beforeEach(async () => {
    await criarAtletica({ id: padraoId, nome: 'Atlética Lorde' })
    presidente = await criarUsuario({ atleticaId: padraoId, papel: 'PRESIDENTE', nome: 'Ana' })
  })

  afterAll(async () => {
    await contexto.app.close()
  })

  describe('acesso (critérios 9 a 12)', () => {
    it.each([ROTA, `${ROTA}/${ID_INEXISTENTE}`])('GET %s sem token → 401', async (rota) => {
      const resposta = await request(contexto.http).get(rota)
      expect(resposta.status).toBe(401)
      expect(erro(resposta).code).toBe('UNAUTHENTICATED')
    })

    it.each<Papel>(['ATLETA', 'DIRETOR'])('%s → 403 FORBIDDEN', async (papel) => {
      const registro = await registrar()
      const api = await como(await criarUsuario({ atleticaId: padraoId, papel }))
      for (const resposta of [await api.listar(), await api.detalhar(registro.id)]) {
        expect(resposta.status).toBe(403)
        expect(erro(resposta).code).toBe('FORBIDDEN')
      }
    })

    it.each<Papel>(['PRESIDENTE', 'VICE_PRESIDENTE', 'ADMINISTRADOR'])(
      '%s → 200',
      async (papel) => {
        await registrar()
        const solicitante =
          papel === 'PRESIDENTE' ? presidente : await criarUsuario({ atleticaId: padraoId, papel })
        const resposta = await (await como(solicitante)).listar()
        expect(resposta.status).toBe(200)
        expect(resposta.headers['cache-control']).toBe('no-store')
        expect(lista(resposta).total).toBe(1)
      },
    )

    it('registro de outra atlética → 404 no detalhe e ausente da lista', async () => {
      const outra = await criarAtletica()
      const deFora = await registrar({ atleticaId: outra.id, usuarioId: null })
      const api = await como(presidente)
      for (const id of [deFora.id, ID_INEXISTENTE]) {
        const resposta = await api.detalhar(id)
        expect(resposta.status).toBe(404)
        expect(erro(resposta).code).toBe('NOT_FOUND')
      }
      expect(lista(await api.listar()).items).toEqual([])
    })

    it('id que não é UUID → 400', async () => {
      const resposta = await (await como(presidente)).detalhar('abc')
      expect(resposta.status).toBe(400)
      expect(erro(resposta).code).toBe('VALIDATION_ERROR')
    })

    it('POST, PATCH, PUT e DELETE → 404 e nada muda', async () => {
      const registro = await registrar()
      const api = await como(presidente)
      for (const metodo of ['post', 'patch', 'put', 'delete'] as const) {
        for (const rota of [ROTA, `${ROTA}/${registro.id}`]) {
          const resposta = await api.http(metodo, rota)
          expect(resposta.status).toBe(404)
          expect(erro(resposta).code).toBe('NOT_FOUND')
        }
      }
      expect(await prismaTeste.registroAuditoria.findMany()).toEqual([registro])
    })
  })

  describe('lista (critérios 1 a 5, 13 e 15)', () => {
    it('padrão: últimos 30 dias, do mais recente ao mais antigo, 20 por página', async () => {
      const agora = Date.now()
      for (let i = 0; i < 22; i++) await registrar({ criadoEm: new Date(agora - i * 60_000) })
      await registrar({ criadoEm: new Date(agora - 31 * DIA_MS) })
      const api = await como(presidente)

      const primeira = lista(await api.listar())
      expect(primeira).toMatchObject({ page: 1, limit: 20, total: 22 })
      const datas = primeira.items.map(({ criadoEm }) => criadoEm)
      expect(datas).toEqual([...datas].sort().reverse())

      const segunda = lista(await api.listar({ page: 2 }))
      expect(segunda.items).toHaveLength(2)
      expect(segunda.items.map(({ id }) => id)).not.toContain(primeira.items[0]?.id)
    })

    it('a consulta não gera registro de auditoria', async () => {
      await registrar()
      const api = await como(presidente)
      await api.listar()
      await api.detalhar((await prismaTeste.registroAuditoria.findFirstOrThrow()).id)
      expect(await prismaTeste.registroAuditoria.count()).toBe(1)
    })

    it('filtra por entidade + registro, autor e ação', async () => {
      const time = await criarTime({ atleticaId: padraoId, nome: 'Futsal' })
      const evento = await criarEvento({
        atleticaId: padraoId,
        timeId: time.id,
        inicio: new Date('2026-10-12T22:00:00.000Z'),
      })
      const diretor = await criarUsuario({ atleticaId: padraoId, papel: 'DIRETOR' })
      const doEvento = await registrar({
        entidade: 'Evento',
        acao: 'EVENTO_ALTERADO',
        entidadeId: evento.id,
        usuarioId: diretor.id,
        dados: { antes: { local: 'A' }, depois: { local: 'B' } },
      })
      await registrar({ entidade: 'Evento', acao: 'EVENTO_CRIADO' })
      await registrar()
      const api = await como(presidente)

      const porRegistro = lista(await api.listar({ entidade: 'Evento', entidadeId: evento.id }))
      expect(porRegistro.items.map(({ id }) => id)).toEqual([doEvento.id])
      expect(porRegistro.items[0]).toMatchObject({
        acao: 'EVENTO_ALTERADO',
        rotuloRegistro: 'Treino Futsal 12/10/2026 19:00',
        autor: { id: diretor.id, nome: diretor.nome, anonimizado: false },
      })
      expect(lista(await api.listar({ usuarioId: diretor.id })).total).toBe(1)
      expect(lista(await api.listar({ entidade: 'Evento' })).total).toBe(2)
      expect(lista(await api.listar({ acao: 'MODALIDADE_CRIADA' })).total).toBe(1)
    })

    it('período de 01/09 a 15/09 cobre os dias inteiros em America/Fortaleza', async () => {
      const dentro = [
        await registrar({ criadoEm: new Date('2026-09-01T03:00:00.000Z') }),
        await registrar({ criadoEm: new Date('2026-09-16T02:59:59.999Z') }),
      ]
      await registrar({ criadoEm: new Date('2026-09-01T02:59:59.999Z') })
      await registrar({ criadoEm: new Date('2026-09-16T03:00:00.000Z') })

      const resposta = await (
        await como(presidente)
      ).listar({ de: '2026-09-01', ate: '2026-09-15' })
      expect(
        lista(resposta)
          .items.map(({ id }) => id)
          .sort(),
      ).toEqual(dentro.map(({ id }) => id).sort())
    })

    it('autor de job é null; conta excluída aparece anonimizada e sem e-mail', async () => {
      const excluido = await criarUsuario({ atleticaId: padraoId, papel: 'DIRETOR', nome: 'Zé' })
      await registrar({ usuarioId: excluido.id, criadoEm: new Date(Date.now() - 1000) })
      await prismaTeste.usuario.update({
        where: { id: excluido.id },
        data: { nome: 'Usuário excluído', excluidoEm: new Date() },
      })
      await registrar({ usuarioId: null })

      const resposta = await (await como(presidente)).listar()
      const [sistema, anonimo] = lista(resposta).items
      expect(sistema?.autor).toBeNull()
      expect(anonimo?.autor).toEqual({
        id: excluido.id,
        nome: 'Usuário excluído',
        anonimizado: true,
      })
      expect(JSON.stringify(resposta.body)).not.toContain(excluido.email)
    })

    it('filtros sem resultado → lista vazia', async () => {
      await registrar()
      expect(lista(await (await como(presidente)).listar({ entidade: 'Banner' })).total).toBe(0)
    })
  })

  describe('validação (critérios 6, 14 e 17)', () => {
    it.each([
      [{ de: '2026-09-15', ate: '2026-09-01' }, 'ate'],
      [{ de: '2025-01-01', ate: '2026-01-10' }, 'de'],
      [{ limit: 100 }, 'limit'],
      [{ entidade: 'Sessao' }, 'entidade'],
      [{ acao: 'CRIAR' }, 'acao'],
      [{ entidadeId: ID_INEXISTENTE }, 'entidadeId'],
    ])('%o → 400 com details no campo %s', async (query, campo) => {
      const resposta = await (await como(presidente)).listar(query)
      expect(resposta.status).toBe(400)
      expect(erro(resposta).code).toBe('VALIDATION_ERROR')
      expect(erro(resposta).details.map(({ field }) => field)).toEqual([campo])
    })
  })

  describe('detalhe (critério 7)', () => {
    it('antes/depois sem campos sensíveis e com os ids resolvidos', async () => {
      const time = await criarTime({ atleticaId: padraoId, nome: 'Futsal' })
      const evento = await criarEvento({
        atleticaId: padraoId,
        tipo: 'JOGO',
        timeId: time.id,
        inicio: new Date('2026-10-12T22:00:00.000Z'),
      })
      const registro = await registrar({
        entidade: 'Evento',
        acao: 'RESULTADO_CORRIGIDO',
        entidadeId: evento.id,
        dados: {
          antes: { placarTime: 2, resultado: 'EMPATE', senhaHash: 'x' },
          depois: { placarTime: 3, resultado: 'VITORIA', email: 'vazou@ex.com' },
          contexto: { usuarioId: presidente.id, tokenPush: 'ExponentPushToken[x]' },
        },
      })

      const resposta = await (await como(presidente)).detalhar(registro.id)
      expect(resposta.status).toBe(200)
      expect(resposta.headers['cache-control']).toBe('no-store')
      const detalhe = registroAuditoriaDetalheSchema.parse(resposta.body)
      expect(detalhe.dados).toEqual({
        antes: { placarTime: 2, resultado: 'EMPATE' },
        depois: { placarTime: 3, resultado: 'VITORIA' },
        contexto: { usuarioId: presidente.id },
      })
      expect(detalhe.rotuloRegistro).toBe('Jogo Futsal 12/10/2026 19:00')
      expect(detalhe.referencias).toEqual({
        [evento.id]: 'Jogo Futsal 12/10/2026 19:00',
        [presidente.id]: 'Ana',
      })
    })

    it('nome de entidade de domínio é mantido; de pessoa, removido', async () => {
      const api = await como(presidente)
      const modalidade = await registrar()
      const pessoa = await registrar({
        entidade: 'VinculoAtletica',
        acao: 'CARGO_ALTERADO',
        dados: { antes: { papel: 'ATLETA', nome: 'X' }, depois: { papel: 'DIRETOR' } },
      })
      const dados = async (id: string) =>
        registroAuditoriaDetalheSchema.parse((await api.detalhar(id)).body).dados
      expect(await dados(modalidade.id)).toEqual({ antes: null, depois: { nome: 'Vôlei' } })
      expect(await dados(pessoa.id)).toEqual({
        antes: { papel: 'ATLETA' },
        depois: { papel: 'DIRETOR' },
      })
    })
  })
})
