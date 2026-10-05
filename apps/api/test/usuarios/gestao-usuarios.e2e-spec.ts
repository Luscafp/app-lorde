import {
  listaUsuariosSchema,
  usuarioDetalheSchema,
  type Papel,
  type UsuarioDetalhe,
} from '@atletica/shared'
import request from 'supertest'
import type { RespostaErro } from '../../src/common/erros/erro-negocio'
import { ContextoAtletica } from '../../src/infra/contexto/contexto-atletica.service'
import { TransacaoService } from '../../src/infra/eventos/apos-commit'
import { SenhaService } from '../../src/infra/senha/senha.service'
import { AtleticaPadraoService } from '../../src/modules/atleticas/atletica-padrao.service'
import { SessaoService } from '../../src/modules/auth/sessao.service'
import { bloquearPapeis } from '../../src/modules/usuarios/regras-papel'
import { aguardarOuvintes, espiarEventos, type EspiaoEventos } from '../eventos'
import { criarAtletica } from '../fabricas/atletica'
import { criarSessao, tokenPara } from '../fabricas/auth'
import { criarUsuario, type DadosUsuario, type UsuarioCriado } from '../fabricas/usuario'
import { criarApp, type AppDeTeste } from '../setup/criar-app'
import { prismaTeste } from '../setup/prisma-teste'

const ROTA = '/api/v1/usuarios'
const SENHA = 'senha-forte-123'
const ID_INEXISTENTE = '0b6f8a52-8e5d-4a43-9d6c-1f0f3c2b7a90'
const erro = (resposta: { body: unknown }) => resposta.body as RespostaErro
const esperar = (ms: number) => new Promise((resolver) => setTimeout(resolver, ms))

describe('Gestão de usuários (#27)', () => {
  let contexto: AppDeTeste
  let padraoId: string
  let eventos: EspiaoEventos

  const usuario = (dados: DadosUsuario = {}) => criarUsuario({ atleticaId: padraoId, ...dados })

  async function como(solicitante: UsuarioCriado) {
    const token = await tokenPara(solicitante)
    const autenticar = (teste: request.Test) => teste.set('Authorization', `Bearer ${token}`)
    return {
      listar: (query: Record<string, string | number> = {}) =>
        autenticar(request(contexto.http).get(ROTA).query(query)),
      detalhar: (id: string) => autenticar(request(contexto.http).get(`${ROTA}/${id}`)),
      alterar: (id: string, corpo: object) =>
        autenticar(request(contexto.http).patch(`${ROTA}/${id}/status`).send(corpo)),
    }
  }

  const vinculoDe = (usuarioId: string) =>
    prismaTeste.vinculoAtletica.findFirstOrThrow({ where: { usuarioId, atleticaId: padraoId } })
  const auditoria = () => prismaTeste.registroAuditoria.findMany({ orderBy: { criadoEm: 'asc' } })

  async function excluir(alvo: UsuarioCriado) {
    await prismaTeste.usuario.update({
      where: { id: alvo.id },
      data: {
        nome: 'Usuário excluído',
        email: `excluido-${alvo.id}@anonimo.local`,
        ativo: false,
        excluidoEm: new Date(),
      },
    })
  }

  beforeAll(async () => {
    contexto = await criarApp()
    padraoId = contexto.app.get(AtleticaPadraoService).id()
  })

  beforeEach(async () => {
    await criarAtletica({ id: padraoId, nome: 'Atlética Lorde' })
    eventos = espiarEventos(contexto.app)
  })

  afterAll(async () => {
    await contexto.app.close()
  })

  describe('autenticação e papel (critérios 14, 15 e 19)', () => {
    it.each([
      ['get', ROTA],
      ['get', `${ROTA}/${ID_INEXISTENTE}`],
      ['patch', `${ROTA}/${ID_INEXISTENTE}/status`],
    ] as const)('%s %s sem token → 401', async (metodo, rota) => {
      const resposta = await request(contexto.http)[metodo](rota).send({ ativo: false })
      expect(resposta.status).toBe(401)
      expect(erro(resposta).code).toBe('UNAUTHENTICATED')
    })

    it.each<Papel>(['ATLETA', 'DIRETOR'])('%s → 403 FORBIDDEN em todas as rotas', async (papel) => {
      const api = await como(await usuario({ papel }))
      const alvo = await usuario()
      for (const resposta of [
        await api.listar(),
        await api.detalhar(alvo.id),
        await api.alterar(alvo.id, { ativo: false }),
      ]) {
        expect(resposta.status).toBe(403)
        expect(erro(resposta).code).toBe('FORBIDDEN')
      }
      expect((await vinculoDe(alvo.id)).ativo).toBe(true)
    })

    it('usuário de outra atlética → 404 no detalhe e na alteração, ausente da lista', async () => {
      const api = await como(await usuario({ papel: 'PRESIDENTE' }))
      const deFora = await criarUsuario({ atleticaId: (await criarAtletica()).id })

      for (const resposta of [
        await api.detalhar(deFora.id),
        await api.alterar(deFora.id, { ativo: false }),
        await api.detalhar(ID_INEXISTENTE),
      ]) {
        expect(resposta.status).toBe(404)
        expect(erro(resposta).code).toBe('NOT_FOUND')
      }
      const lista = listaUsuariosSchema.parse((await api.listar()).body)
      expect(lista.items.map(({ id }) => id)).not.toContain(deFora.id)
      expect(deFora.vinculo.ativo).toBe(true)
    })

    it('id que não é UUID → 400', async () => {
      const api = await como(await usuario({ papel: 'PRESIDENTE' }))
      const resposta = await api.detalhar('abc')
      expect(resposta.status).toBe(400)
      expect(erro(resposta).code).toBe('VALIDATION_ERROR')
    })
  })

  describe('GET /usuarios', () => {
    it('busca sem acento e por e-mail, ordenada por nome (critério 1)', async () => {
      const presidente = await usuario({ papel: 'PRESIDENTE', nome: 'Paula Presidente' })
      await usuario({ nome: 'José Lima', email: 'lima@ex.com' })
      await usuario({ nome: 'Maria Souza', email: 'maria.jose@ex.com' })
      await usuario({ nome: 'Ana Costa', email: 'ana@ex.com' })

      const resposta = await (await como(presidente)).listar({ busca: 'jose' })

      expect(resposta.status).toBe(200)
      expect(resposta.headers['cache-control']).toBe('no-store')
      const corpo = listaUsuariosSchema.parse(resposta.body)
      expect(corpo.items.map(({ nome }) => nome)).toEqual(['José Lima', 'Maria Souza'])
      expect(corpo).toMatchObject({ page: 1, limit: 20, total: 2 })
      expect(corpo.items[0]).toEqual({
        id: expect.any(String) as string,
        nome: 'José Lima',
        email: 'lima@ex.com',
        fotoUrl: null,
        papel: 'ATLETA',
        situacao: 'ATIVO',
      })
    })

    it('termo com acento encontra nome sem acento, sem diferenciar maiúsculas', async () => {
      const presidente = await usuario({ papel: 'PRESIDENTE' })
      await usuario({ nome: 'JOAO Pereira' })
      const corpo = listaUsuariosSchema.parse(
        (await (await como(presidente)).listar({ busca: 'joão' })).body,
      )
      expect(corpo.items.map(({ nome }) => nome)).toEqual(['JOAO Pereira'])
    })

    it('% e _ no termo são literais', async () => {
      const presidente = await usuario({ papel: 'PRESIDENTE' })
      await usuario({ nome: 'Desconto 100% Silva' })
      await usuario({ nome: 'Desconto 1000 Silva' })
      const api = await como(presidente)

      const porcento = listaUsuariosSchema.parse((await api.listar({ busca: '100%' })).body)
      expect(porcento.items.map(({ nome }) => nome)).toEqual(['Desconto 100% Silva'])
      const sublinhado = listaUsuariosSchema.parse((await api.listar({ busca: '10_0' })).body)
      expect(sublinhado.total).toBe(0)
    })

    it('filtros de papel e situação (critério 2)', async () => {
      const presidente = await usuario({ papel: 'PRESIDENTE' })
      const alvo = await usuario({ papel: 'DIRETOR', vinculoAtivo: false })
      await usuario({ papel: 'DIRETOR' })
      await usuario({ papel: 'ATLETA', vinculoAtivo: false })

      const resposta = await (
        await como(presidente)
      ).listar({
        papel: 'DIRETOR',
        situacao: 'DESATIVADO',
      })

      const corpo = listaUsuariosSchema.parse(resposta.body)
      expect(corpo.items.map(({ id, situacao }) => ({ id, situacao }))).toEqual([
        { id: alvo.id, situacao: 'DESATIVADO' },
      ])
    })

    it('paginação com total e foto pela chave', async () => {
      const presidente = await usuario({ papel: 'PRESIDENTE', nome: 'Zeca Presidente' })
      for (const nome of ['Ana', 'Bia', 'Caio']) await usuario({ nome })
      await prismaTeste.usuario.updateMany({
        where: { nome: 'Bia' },
        data: { fotoKey: 'usuarios/x/perfil/y.jpg' },
      })
      const api = await como(presidente)

      const pagina2 = listaUsuariosSchema.parse((await api.listar({ page: 2, limit: 2 })).body)
      expect(pagina2).toMatchObject({ page: 2, limit: 2, total: 4 })
      expect(pagina2.items.map(({ nome }) => nome)).toEqual(['Caio', 'Zeca Presidente'])

      const pagina1 = listaUsuariosSchema.parse((await api.listar({ limit: 2 })).body)
      expect(pagina1.items[1]?.fotoUrl).toBe('https://imagens.teste.local/usuarios/x/perfil/y.jpg')
    })

    it('contas excluídas não aparecem (critério 4)', async () => {
      const presidente = await usuario({ papel: 'PRESIDENTE' })
      const excluido = await usuario({ nome: 'José Excluído' })
      await excluir(excluido)
      const api = await como(presidente)

      for (const query of [{}, { busca: 'excluido' }, { busca: 'jose' }] as Record<
        string,
        string
      >[]) {
        const corpo = listaUsuariosSchema.parse((await api.listar(query)).body)
        expect(corpo.items.map(({ id }) => id)).not.toContain(excluido.id)
      }
    })

    it.each([
      [{ busca: 'a' }, 'busca'],
      [{ limit: 51 }, 'limit'],
      [{ situacao: 'EXCLUIDO' }, 'situacao'],
    ])('%o → 400 VALIDATION_ERROR (critério 3)', async (query, campo) => {
      const resposta = await (await como(await usuario({ papel: 'PRESIDENTE' }))).listar(query)
      expect(resposta.status).toBe(400)
      expect(erro(resposta).code).toBe('VALIDATION_ERROR')
      expect(erro(resposta).details[0]?.field).toBe(campo)
    })
  })

  describe('GET /usuarios/:id', () => {
    async function criarTime(nome: string, capitaoId: string | null = null) {
      const modalidade = await prismaTeste.modalidade.create({
        data: { nome: `Modalidade ${nome}`, icone: 'bola' },
      })
      return prismaTeste.time.create({
        data: { nome, atleticaId: padraoId, modalidadeId: modalidade.id, capitaoId },
      })
    }

    it('perfil, times atuais com capitania e permissões (critério 5)', async () => {
      const presidente = await usuario({ papel: 'PRESIDENTE' })
      const atleta = await usuario({ nome: 'Atleta Dois Times', email: 'dois@ex.com' })
      const futsal = await criarTime('Futsal', atleta.id)
      const volei = await criarTime('Vôlei')
      const antigo = await criarTime('Basquete')
      await prismaTeste.membroTime.createMany({
        data: [
          { atleticaId: padraoId, timeId: volei.id, usuarioId: atleta.id },
          { atleticaId: padraoId, timeId: futsal.id, usuarioId: atleta.id },
          {
            atleticaId: padraoId,
            timeId: antigo.id,
            usuarioId: atleta.id,
            entradaEm: new Date(Date.now() - 86_400_000),
            saidaEm: new Date(),
          },
        ],
      })

      const resposta = await (await como(presidente)).detalhar(atleta.id)

      expect(resposta.status).toBe(200)
      const corpo: UsuarioDetalhe = usuarioDetalheSchema.parse(resposta.body)
      expect(corpo).toEqual({
        id: atleta.id,
        nome: 'Atleta Dois Times',
        email: 'dois@ex.com',
        fotoUrl: null,
        papel: 'ATLETA',
        situacao: 'ATIVO',
        criadoEm: atleta.criadoEm.toISOString(),
        times: [
          {
            id: futsal.id,
            nome: 'Futsal',
            modalidade: { id: futsal.modalidadeId, nome: 'Modalidade Futsal' },
            capitao: true,
          },
          {
            id: volei.id,
            nome: 'Vôlei',
            modalidade: { id: volei.modalidadeId, nome: 'Modalidade Vôlei' },
            capitao: false,
          },
        ],
        estatisticas: null,
        permissoes: {
          podeAlterarSituacao: true,
          motivoBloqueio: null,
          podeAlterarPapel: false,
          ehUltimoAdministrador: false,
        },
      })
    })

    it('Vice sobre Presidente: bloqueado com o motivo (critério 9)', async () => {
      const vice = await usuario({ papel: 'VICE_PRESIDENTE' })
      const presidente = await usuario({ papel: 'PRESIDENTE' })
      const corpo = usuarioDetalheSchema.parse(
        (await (await como(vice)).detalhar(presidente.id)).body,
      )
      expect(corpo.permissoes).toEqual({
        podeAlterarSituacao: false,
        motivoBloqueio: 'Só é possível alterar usuários de nível de acesso inferior ao seu.',
        podeAlterarPapel: false,
        ehUltimoAdministrador: false,
      })
    })

    it('Administrador sobre o único Administrador ativo e sobre si mesmo (critério 18b)', async () => {
      const admin = await usuario({ papel: 'ADMINISTRADOR' })
      const api = await como(admin)

      const proprio = usuarioDetalheSchema.parse((await api.detalhar(admin.id)).body)
      expect(proprio.permissoes).toEqual({
        podeAlterarSituacao: false,
        motivoBloqueio: 'Você não pode desativar a própria conta.',
        podeAlterarPapel: true,
        ehUltimoAdministrador: true,
      })

      const outro = await usuario({ papel: 'ADMINISTRADOR' })
      const comDois = usuarioDetalheSchema.parse((await api.detalhar(outro.id)).body)
      expect(comDois.permissoes).toMatchObject({
        podeAlterarPapel: true,
        ehUltimoAdministrador: false,
      })

      await excluir(outro)
      const proprioDeNovo = usuarioDetalheSchema.parse((await api.detalhar(admin.id)).body)
      expect(proprioDeNovo.permissoes.ehUltimoAdministrador).toBe(true)
    })

    it('conta excluída: situação EXCLUIDO, sem times e sem ações (critério 16)', async () => {
      const admin = await usuario({ papel: 'ADMINISTRADOR' })
      const alvo = await usuario()
      await excluir(alvo)

      const corpo = usuarioDetalheSchema.parse((await (await como(admin)).detalhar(alvo.id)).body)

      expect(corpo).toMatchObject({ situacao: 'EXCLUIDO', nome: 'Usuário excluído', times: [] })
      expect(corpo.permissoes).toEqual({
        podeAlterarSituacao: false,
        motivoBloqueio: 'Este usuário excluiu a conta.',
        podeAlterarPapel: false,
        ehUltimoAdministrador: false,
      })
    })
  })

  describe('PATCH /usuarios/:id/status', () => {
    it('desativar: vínculo inativo, sessões revogadas, auditoria e evento após o commit (critério 6)', async () => {
      const presidente = await usuario({ papel: 'PRESIDENTE' })
      const diretor = await usuario({ papel: 'DIRETOR' })
      const [s1, s2] = await Promise.all(
        [1, 2].map(() => criarSessao({ usuarioId: diretor.id, atleticaId: padraoId })),
      )
      const deOutraAtletica = await criarSessao({
        usuarioId: diretor.id,
        atleticaId: (await criarAtletica()).id,
      })

      const resposta = await (await como(presidente)).alterar(diretor.id, { ativo: false })

      expect(resposta.status).toBe(200)
      expect(resposta.body).toEqual({ id: diretor.id, situacao: 'DESATIVADO' })
      const vinculo = await vinculoDe(diretor.id)
      expect(vinculo).toMatchObject({ ativo: false, papel: 'DIRETOR' })

      const sessoes = await prismaTeste.sessao.findMany({ where: { usuarioId: diretor.id } })
      const porId = new Map(sessoes.map((sessao) => [sessao.id, sessao]))
      for (const id of [s1?.id, s2?.id]) {
        expect(porId.get(id ?? '')?.motivoRevogacao).toBe('CONTA_DESATIVADA')
      }
      expect(porId.get(deOutraAtletica.id)?.revogadaEm).toBeNull()

      expect(await auditoria()).toEqual([
        expect.objectContaining({
          atleticaId: padraoId,
          usuarioId: presidente.id,
          acao: 'USUARIO_DESATIVADO',
          entidade: 'VinculoAtletica',
          entidadeId: diretor.id,
          dados: { antes: { ativo: true }, depois: { ativo: false } },
        }),
      ])

      await aguardarOuvintes()
      const emitidos = eventos.emitidos()
      expect(emitidos).toHaveLength(1)
      expect(emitidos[0]?.nome).toBe('usuario.sessaoEncerrada')
      const payload = emitidos[0]?.payload as { sessaoIds: string[] }
      expect(payload).toEqual({
        atleticaId: padraoId,
        usuarioId: diretor.id,
        sessaoIds: expect.any(Array) as string[],
        motivo: 'CONTA_DESATIVADA',
        autorId: presidente.id,
      })
      expect([...payload.sessaoIds].sort()).toEqual([s1?.id, s2?.id].sort())
    })

    it('sem sessões ativas: desativa sem emitir evento', async () => {
      const presidente = await usuario({ papel: 'PRESIDENTE' })
      const atleta = await usuario()
      const api = await como(presidente)

      expect((await api.alterar(atleta.id, { ativo: false })).status).toBe(200)
      await aguardarOuvintes()
      expect(eventos.emitidos()).toEqual([])
    })

    it('efeito imediato: access token, refresh e login rejeitados (critério 7)', async () => {
      const senhaHash = await contexto.app.get(SenhaService).hash(SENHA)
      const presidente = await usuario({ papel: 'PRESIDENTE' })
      const diretor = await usuario({ papel: 'DIRETOR', email: 'diretor@ex.com', senhaHash })
      const { refreshToken } = await contexto.app
        .get(TransacaoService)
        .executar((tx) =>
          contexto.app
            .get(SessaoService)
            .criar(tx, { usuarioId: diretor.id, atleticaId: padraoId }),
        )
      const tokenDiretor = await tokenPara(diretor)

      await (await como(presidente)).alterar(diretor.id, { ativo: false })

      const requisicao = await request(contexto.http)
        .get(ROTA)
        .set('Authorization', `Bearer ${tokenDiretor}`)
      expect(requisicao.status).toBe(401)
      expect(erro(requisicao).code).toBe('CONTA_DESATIVADA')

      const renovacao = await request(contexto.http)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken })
      expect(renovacao.status).toBe(401)

      const login = await request(contexto.http)
        .post('/api/v1/auth/login')
        .send({ email: 'diretor@ex.com', senha: SENHA })
      expect(login.status).toBe(401)
      expect(erro(login).code).toBe('CONTA_DESATIVADA')
    })

    it('reativar: 200 ATIVO, auditoria e login volta a funcionar (critério 8)', async () => {
      const senhaHash = await contexto.app.get(SenhaService).hash(SENHA)
      const presidente = await usuario({ papel: 'PRESIDENTE' })
      const atleta = await usuario({ email: 'volta@ex.com', senhaHash, vinculoAtivo: false })

      const resposta = await (await como(presidente)).alterar(atleta.id, { ativo: true })

      expect(resposta.status).toBe(200)
      expect(resposta.body).toEqual({ id: atleta.id, situacao: 'ATIVO' })
      expect(await auditoria()).toEqual([
        expect.objectContaining({
          acao: 'USUARIO_REATIVADO',
          dados: { antes: { ativo: false }, depois: { ativo: true } },
        }),
      ])
      await aguardarOuvintes()
      expect(eventos.emitidos()).toEqual([])
      const login = await request(contexto.http)
        .post('/api/v1/auth/login')
        .send({ email: 'volta@ex.com', senha: SENHA })
      expect(login.status).toBe(200)
    })

    it.each<[Papel, Papel, number, string | null]>([
      ['VICE_PRESIDENTE', 'PRESIDENTE', 403, 'NIVEL_INSUFICIENTE'],
      ['PRESIDENTE', 'VICE_PRESIDENTE', 403, 'NIVEL_INSUFICIENTE'],
      ['PRESIDENTE', 'ADMINISTRADOR', 403, 'NIVEL_INSUFICIENTE'],
      ['ADMINISTRADOR', 'ADMINISTRADOR', 403, 'NIVEL_INSUFICIENTE'],
      ['ADMINISTRADOR', 'PRESIDENTE', 200, null],
      ['VICE_PRESIDENTE', 'DIRETOR', 200, null],
    ])('%s desativando %s → %s (critérios 9–12)', async (ator, papelAlvo, status, code) => {
      const solicitante = await usuario({ papel: ator })
      const alvo = await usuario({ papel: papelAlvo })

      const resposta = await (await como(solicitante)).alterar(alvo.id, { ativo: false })

      expect(resposta.status).toBe(status)
      if (code) {
        expect(erro(resposta)).toMatchObject({
          code,
          message: 'Só é possível alterar usuários de nível de acesso inferior ao seu.',
        })
        expect((await vinculoDe(alvo.id)).ativo).toBe(true)
        expect(await auditoria()).toEqual([])
      } else {
        expect((await vinculoDe(alvo.id)).ativo).toBe(false)
      }
    })

    it('a própria conta → 403 ALVO_PROPRIO (critério 13)', async () => {
      const admin = await usuario({ papel: 'ADMINISTRADOR' })
      const resposta = await (await como(admin)).alterar(admin.id, { ativo: false })
      expect(resposta.status).toBe(403)
      expect(erro(resposta)).toMatchObject({
        code: 'ALVO_PROPRIO',
        message: 'Você não pode desativar a própria conta.',
      })
    })

    it('conta excluída → 409 USUARIO_EXCLUIDO (critério 16)', async () => {
      const presidente = await usuario({ papel: 'PRESIDENTE' })
      const alvo = await usuario()
      await excluir(alvo)
      const api = await como(presidente)

      for (const ativo of [true, false]) {
        const resposta = await api.alterar(alvo.id, { ativo })
        expect(resposta.status).toBe(409)
        expect(erro(resposta).code).toBe('USUARIO_EXCLUIDO')
      }
    })

    it('repetir a situação atual → 200 sem auditoria nem evento (critério 17)', async () => {
      const presidente = await usuario({ papel: 'PRESIDENTE' })
      const atleta = await usuario({ vinculoAtivo: false })
      const sessao = await criarSessao({ usuarioId: atleta.id, atleticaId: padraoId })

      const resposta = await (await como(presidente)).alterar(atleta.id, { ativo: false })

      expect(resposta.status).toBe(200)
      expect(resposta.body).toEqual({ id: atleta.id, situacao: 'DESATIVADO' })
      expect(await auditoria()).toEqual([])
      const intacta = await prismaTeste.sessao.findUniqueOrThrow({ where: { id: sessao.id } })
      expect(intacta.revogadaEm).toBeNull()
      await aguardarOuvintes()
      expect(eventos.emitidos()).toEqual([])
    })

    it.each([{}, { ativo: 'false' }, { ativo: false, papel: 'ATLETA' }])(
      'corpo %o → 400',
      async (corpo) => {
        const presidente = await usuario({ papel: 'PRESIDENTE' })
        const resposta = await (await como(presidente)).alterar((await usuario()).id, corpo)
        expect(resposta.status).toBe(400)
        expect(erro(resposta).code).toBe('VALIDATION_ERROR')
      },
    )

    it('solicitante rebaixado depois do guard → 403 FORBIDDEN', async () => {
      const presidente = await usuario({ papel: 'PRESIDENTE' })
      const atleta = await usuario()
      const api = await como(presidente)
      const original = contexto.app
        .get(TransacaoService)
        .executar.bind(contexto.app.get(TransacaoService))
      const espiao = jest
        .spyOn(contexto.app.get(TransacaoService), 'executar')
        .mockImplementationOnce(async (fn) => {
          await prismaTeste.vinculoAtletica.update({
            where: { id: presidente.vinculo.id },
            data: { papel: 'DIRETOR' },
          })
          return original(fn)
        })

      const resposta = await api.alterar(atleta.id, { ativo: false })

      espiao.mockRestore()
      expect(resposta.status).toBe(403)
      expect(erro(resposta).code).toBe('FORBIDDEN')
    })

    it('promoção concorrente a Presidente: a desativação espera o lock e falha (critério 18)', async () => {
      const vice = await usuario({ papel: 'VICE_PRESIDENTE' })
      const alvo = await usuario({ papel: 'DIRETOR' })
      const api = await como(vice)
      const transacao = contexto.app.get(TransacaoService)

      const promocao = contexto.app.get(ContextoAtletica).executarComAtletica(padraoId, () =>
        transacao.executar(async (tx) => {
          await bloquearPapeis(tx, padraoId)
          await tx.vinculoAtletica.update({
            where: { id: alvo.vinculo.id },
            data: { papel: 'PRESIDENTE' },
          })
          await esperar(300)
        }),
      )
      await esperar(50)
      const [resposta] = await Promise.all([api.alterar(alvo.id, { ativo: false }), promocao])

      expect(resposta.status).toBe(403)
      expect(erro(resposta).code).toBe('NIVEL_INSUFICIENTE')
      expect(await vinculoDe(alvo.id)).toMatchObject({ papel: 'PRESIDENTE', ativo: true })
    })
  })
})
