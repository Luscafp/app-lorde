import { respostaSessaoSchema } from '@atletica/shared'
import request from 'supertest'
import { TransacaoService } from '../../src/infra/eventos/apos-commit'
import type { MotivoRevogacao } from '../../src/infra/eventos/eventos-dominio'
import { AtleticaPadraoService } from '../../src/modules/atleticas/atletica-padrao.service'
import {
  hashSegredo,
  JANELA_CONCORRENCIA_MS,
  type OpcoesRevogarTodas,
  SessaoService,
  VALIDADE_SESSAO_MS,
} from '../../src/modules/auth/sessao.service'
import { aguardarOuvintes, espiarEventos, type EspiaoEventos } from '../eventos'
import { criarAtletica } from '../fabricas/atletica'
import { criarSessao } from '../fabricas/auth'
import { criarUsuario, type DadosUsuario, type UsuarioCriado } from '../fabricas/usuario'
import { criarApp, type AppDeTeste } from '../setup/criar-app'
import { prismaTeste } from '../setup/prisma-teste'
import { AuthTesteController } from '../suporte/auth.controller'

const REFRESH = '/api/v1/auth/refresh'
const LOGOUT = '/api/v1/auth/logout'
const ROTA_PROTEGIDA = '/api/v1/teste-auth/livre'

describe('Sessão: refresh e logout (#58)', () => {
  let contexto: AppDeTeste
  let padraoId: string
  let eventos: EspiaoEventos

  const renovar = (refreshToken: string) =>
    request(contexto.http).post(REFRESH).send({ refreshToken })
  const sair = (refreshToken: string) => request(contexto.http).post(LOGOUT).send({ refreshToken })
  const renovado = async (refreshToken: string) =>
    respostaSessaoSchema.parse((await renovar(refreshToken)).body)

  const sessaoDoToken = (refreshToken: string) =>
    prismaTeste.sessao.findUniqueOrThrow({ where: { id: refreshToken.split('.')[0] } })

  async function abrirSessao(dados: DadosUsuario = {}) {
    const usuario = await criarUsuario({ atleticaId: padraoId, ...dados })
    const { refreshToken } = await contexto.app
      .get(TransacaoService)
      .executar((tx) =>
        contexto.app.get(SessaoService).criar(tx, { usuarioId: usuario.id, atleticaId: padraoId }),
      )
    return { usuario, refreshToken }
  }

  /** Simula a passagem do tempo desde a última rotação. */
  async function envelhecerRotacao(refreshToken: string, ms: number) {
    const { id, rotacionadaEm } = await sessaoDoToken(refreshToken)
    if (!rotacionadaEm) throw new Error('sessão nunca rotacionada')
    await prismaTeste.sessao.update({
      where: { id },
      data: { rotacionadaEm: new Date(rotacionadaEm.getTime() - ms) },
    })
  }

  beforeAll(async () => {
    contexto = await criarApp({ controllers: [AuthTesteController] })
    padraoId = contexto.app.get(AtleticaPadraoService).id()
  })

  beforeEach(async () => {
    await criarAtletica({ id: padraoId, nome: 'Atlética Lorde' })
    eventos = espiarEventos(contexto.app)
  })

  afterAll(async () => {
    await contexto.app.close()
  })

  describe('POST /auth/refresh', () => {
    it('feliz: mesmo contrato do login, grava o hash anterior, rotacionadaEm e expiraEm + 30 d (critério 12)', async () => {
      const { usuario, refreshToken } = await abrirSessao({ nome: 'Ana', papel: 'DIRETOR' })
      const [, segredoAntigo = ''] = refreshToken.split('.')
      const antes = Date.now()

      const resposta = await renovar(refreshToken)

      expect(resposta.status).toBe(200)
      expect(resposta.headers['cache-control']).toBe('no-store')
      const corpo = respostaSessaoSchema.parse(resposta.body)
      expect(corpo.usuario).toStrictEqual({
        id: usuario.id,
        nome: 'Ana',
        email: usuario.email,
        fotoUrl: null,
        papel: 'DIRETOR',
        atleticaId: padraoId,
      })
      expect(corpo.refreshToken.split('.')[0]).toBe(refreshToken.split('.')[0])
      expect(corpo.refreshToken).not.toBe(refreshToken)

      const sessao = await sessaoDoToken(refreshToken)
      expect(sessao.refreshTokenAnteriorHash).toBe(hashSegredo(segredoAntigo))
      expect(sessao.refreshTokenHash).toBe(hashSegredo(corpo.refreshToken.split('.')[1] ?? ''))
      expect(sessao.rotacionadaEm?.getTime()).toBeGreaterThanOrEqual(antes)
      expect(sessao.expiraEm.getTime()).toBe(
        (sessao.rotacionadaEm?.getTime() ?? 0) + VALIDADE_SESSAO_MS,
      )

      const protegida = await request(contexto.http)
        .get(ROTA_PROTEGIDA)
        .set('Authorization', `Bearer ${corpo.accessToken}`)
      expect(protegida.status).toBe(200)
      await aguardarOuvintes()
      expect(eventos.emitidos()).toEqual([])
    })

    it('o token novo também pode ser renovado', async () => {
      const { refreshToken } = await abrirSessao()
      const primeira = await renovado(refreshToken)

      expect((await renovar(primeira.refreshToken)).status).toBe(200)
    })

    it('reuso após 30 s: revoga com REUSO_REFRESH, emite o evento após o commit e derruba o token novo (critério 13)', async () => {
      const { usuario, refreshToken } = await abrirSessao()
      const novo = await renovado(refreshToken)
      await envelhecerRotacao(refreshToken, JANELA_CONCORRENCIA_MS)

      const reuso = await renovar(refreshToken)

      expect(reuso.status).toBe(401)
      expect(reuso.body).toMatchObject({ code: 'SESSAO_REVOGADA' })
      const sessao = await sessaoDoToken(refreshToken)
      expect(sessao.motivoRevogacao).toBe('REUSO_REFRESH')
      expect(sessao.revogadaEm).not.toBeNull()
      await aguardarOuvintes()
      expect(eventos.emitidos()).toEqual([
        {
          nome: 'usuario.sessaoEncerrada',
          payload: {
            usuarioId: usuario.id,
            sessaoIds: [sessao.id],
            motivo: 'REUSO_REFRESH',
            autorId: null,
          },
        },
      ])

      expect((await renovar(novo.refreshToken)).body).toMatchObject({ code: 'SESSAO_REVOGADA' })
    })

    it('token anterior em menos de 30 s → 401 REFRESH_JA_ROTACIONADO sem revogar (critério 14)', async () => {
      const { refreshToken } = await abrirSessao()
      const novo = await renovado(refreshToken)

      const repetido = await renovar(refreshToken)

      expect(repetido.status).toBe(401)
      expect(repetido.body).toMatchObject({ code: 'REFRESH_JA_ROTACIONADO' })
      expect((await sessaoDoToken(refreshToken)).revogadaEm).toBeNull()
      expect((await renovar(novo.refreshToken)).status).toBe(200)
      await aguardarOuvintes()
      expect(eventos.emitidos()).toEqual([])
    })

    it('duas renovações simultâneas com o mesmo token: uma 200 e outra REFRESH_JA_ROTACIONADO', async () => {
      const { refreshToken } = await abrirSessao()

      const respostas = await Promise.all([renovar(refreshToken), renovar(refreshToken)])

      expect(respostas.map(({ status }) => status).sort()).toEqual([200, 401])
      expect(respostas.find(({ status }) => status === 401)?.body).toMatchObject({
        code: 'REFRESH_JA_ROTACIONADO',
      })
      expect((await sessaoDoToken(refreshToken)).revogadaEm).toBeNull()
    })

    it.each([
      ['sem separador', 'malformado'],
      ['sessaoId que não é UUID', 'abc.Q2x0b2tlbi1zZWNyZXQtZXhlbXBsby0zMmJ5dGVzMDE'],
      [
        'sessão inexistente',
        '0b6f8a52-8e5d-4a43-9d6c-1f0f3c2b7a90.Q2x0b2tlbi1zZWNyZXQtZXhlbXBsby0zMmJ5dGVzMDE',
      ],
    ])('%s → 401 REFRESH_INVALIDO', async (_caso, refreshToken) => {
      const resposta = await renovar(refreshToken)

      expect(resposta.status).toBe(401)
      expect(resposta.body).toMatchObject({ code: 'REFRESH_INVALIDO' })
    })

    it('sessão expirada → 401 REFRESH_INVALIDO', async () => {
      const { refreshToken } = await abrirSessao()
      await prismaTeste.sessao.updateMany({ data: { expiraEm: new Date(Date.now() - 1000) } })

      expect((await renovar(refreshToken)).body).toMatchObject({ code: 'REFRESH_INVALIDO' })
    })

    it('corpo sem refreshToken → 400 VALIDATION_ERROR', async () => {
      const resposta = await request(contexto.http).post(REFRESH).send({})

      expect(resposta.status).toBe(400)
      expect(resposta.body).toMatchObject({ code: 'VALIDATION_ERROR' })
    })

    it('sessão revogada por logout → 401 SESSAO_REVOGADA', async () => {
      const { refreshToken } = await abrirSessao()
      await sair(refreshToken)

      const resposta = await renovar(refreshToken)

      expect(resposta.status).toBe(401)
      expect(resposta.body).toMatchObject({ code: 'SESSAO_REVOGADA' })
    })

    it.each<[string, DadosUsuario]>([
      ['usuário desativado', { ativo: false }],
      ['vínculo desativado', { vinculoAtivo: false }],
    ])(
      '%s depois do login → 401 CONTA_DESATIVADA e sessão revogada (critério 15)',
      async (_caso, dados) => {
        const { usuario, refreshToken } = await abrirSessao()
        await desativar(usuario, dados)

        const resposta = await renovar(refreshToken)

        expect(resposta.status).toBe(401)
        expect(resposta.body).toMatchObject({
          code: 'CONTA_DESATIVADA',
          message: 'Sua conta está desativada. Procure a diretoria.',
        })
        const sessao = await sessaoDoToken(refreshToken)
        expect(sessao.motivoRevogacao).toBe('CONTA_DESATIVADA')
        await aguardarOuvintes()
        expect(eventos.emitidos()).toEqual([
          {
            nome: 'usuario.sessaoEncerrada',
            payload: {
              usuarioId: usuario.id,
              sessaoIds: [sessao.id],
              motivo: 'CONTA_DESATIVADA',
              autorId: null,
            },
          },
        ])
      },
    )
  })

  describe('POST /auth/logout', () => {
    it('feliz: 204, revoga com LOGOUT e emite o evento com autorId = usuário (critério 16)', async () => {
      const { usuario, refreshToken } = await abrirSessao()

      const resposta = await sair(refreshToken)

      expect(resposta.status).toBe(204)
      expect(resposta.body).toEqual({})
      const sessao = await sessaoDoToken(refreshToken)
      expect(sessao.revogadaEm).not.toBeNull()
      expect(sessao.motivoRevogacao).toBe('LOGOUT')
      await aguardarOuvintes()
      expect(eventos.emitidos()).toEqual([
        {
          nome: 'usuario.sessaoEncerrada',
          payload: {
            usuarioId: usuario.id,
            sessaoIds: [sessao.id],
            motivo: 'LOGOUT',
            autorId: usuario.id,
          },
        },
      ])
    })

    it('token anterior da mesma sessão também revoga', async () => {
      const { refreshToken } = await abrirSessao()
      await renovar(refreshToken)

      expect((await sair(refreshToken)).status).toBe(204)
      expect((await sessaoDoToken(refreshToken)).motivoRevogacao).toBe('LOGOUT')
    })

    it('access token de sessão encerrada por logout → 401 em rota protegida (#7)', async () => {
      const { refreshToken } = await abrirSessao()
      const novo = await renovado(refreshToken)
      await sair(novo.refreshToken)

      const resposta = await request(contexto.http)
        .get(ROTA_PROTEGIDA)
        .set('Authorization', `Bearer ${novo.accessToken}`)

      expect(resposta.status).toBe(401)
      expect(resposta.body).toMatchObject({ code: 'UNAUTHENTICATED' })
    })

    it.each([
      ['malformado', () => Promise.resolve('malformado')],
      [
        'de sessão inexistente',
        () =>
          Promise.resolve(
            '0b6f8a52-8e5d-4a43-9d6c-1f0f3c2b7a90.Q2x0b2tlbi1zZWNyZXQtZXhlbXBsby0zMmJ5dGVzMDE',
          ),
      ],
      [
        'já revogado',
        async () => {
          const { refreshToken } = await abrirSessao()
          await sair(refreshToken)
          eventos = espiarEventos(contexto.app)
          return refreshToken
        },
      ],
    ])('token %s → 204 sem evento (critério 18)', async (_caso, preparar) => {
      const resposta = await sair(await preparar())

      expect(resposta.status).toBe(204)
      await aguardarOuvintes()
      expect(eventos.emitidos()).toEqual([])
    })

    it('não exige access token e mantém o motivo da primeira revogação', async () => {
      const { refreshToken } = await abrirSessao()
      await renovar(refreshToken)
      await envelhecerRotacao(refreshToken, JANELA_CONCORRENCIA_MS)
      await renovar(refreshToken)

      expect((await sair(refreshToken)).status).toBe(204)
      expect((await sessaoDoToken(refreshToken)).motivoRevogacao).toBe('REUSO_REFRESH')
    })
  })

  describe('SessaoService.revogarTodas', () => {
    const revogarTodas = (
      usuarioId: string,
      motivo: MotivoRevogacao,
      opcoes?: OpcoesRevogarTodas,
    ) =>
      contexto.app
        .get(TransacaoService)
        .executar((tx) =>
          contexto.app.get(SessaoService).revogarTodas(tx, usuarioId, motivo, opcoes),
        )

    it('com exceto: devolve os 2 ids revogados e a sessão preservada continua ativa', async () => {
      const usuario = await criarUsuario({ atleticaId: padraoId })
      const [s1, s2, s3] = await Promise.all(
        [1, 2, 3].map(() => criarSessao({ usuarioId: usuario.id, atleticaId: padraoId })),
      )
      const jaRevogada = await criarSessao({
        usuarioId: usuario.id,
        atleticaId: padraoId,
        revogadaEm: new Date(),
        motivoRevogacao: 'LOGOUT',
      })

      const ids = await revogarTodas(usuario.id, 'TROCA_SENHA', { exceto: s1?.id })

      expect(ids.sort()).toEqual([s2?.id, s3?.id].sort())
      const sessoes = await prismaTeste.sessao.findMany({ where: { usuarioId: usuario.id } })
      const porId = new Map(sessoes.map((sessao) => [sessao.id, sessao]))
      expect(porId.get(s1?.id ?? '')?.revogadaEm).toBeNull()
      expect(porId.get(s2?.id ?? '')?.motivoRevogacao).toBe('TROCA_SENHA')
      expect(porId.get(jaRevogada.id)?.motivoRevogacao).toBe('LOGOUT')
    })

    it('sem sessões ativas (ou só a exceto) → [] e nada emitido', async () => {
      const usuario = await criarUsuario({ atleticaId: padraoId })
      const unica = await criarSessao({ usuarioId: usuario.id, atleticaId: padraoId })

      await expect(revogarTodas(usuario.id, 'TROCA_SENHA', { exceto: unica.id })).resolves.toEqual(
        [],
      )
      await expect(
        revogarTodas(usuario.id, 'CONTA_EXCLUIDA', { exceto: unica.id }),
      ).resolves.toEqual([])
      await aguardarOuvintes()
      expect(eventos.emitidos()).toEqual([])
    })

    it('não toca sessões de outros usuários nem expiradas; filtra por atlética', async () => {
      const outraAtletica = await criarAtletica()
      const usuario = await criarUsuario({ atleticaId: padraoId })
      const outro = await criarUsuario({ atleticaId: padraoId })
      const daOutraAtletica = await criarSessao({
        usuarioId: usuario.id,
        atleticaId: outraAtletica.id,
      })
      const daPadrao = await criarSessao({ usuarioId: usuario.id, atleticaId: padraoId })
      await criarSessao({
        usuarioId: usuario.id,
        atleticaId: padraoId,
        expiraEm: new Date(Date.now() - 1000),
      })
      await criarSessao({ usuarioId: outro.id, atleticaId: padraoId })

      const ids = await revogarTodas(usuario.id, 'CONTA_DESATIVADA', { atleticaId: padraoId })

      expect(ids).toEqual([daPadrao.id])
      expect(
        (await prismaTeste.sessao.findUniqueOrThrow({ where: { id: daOutraAtletica.id } }))
          .revogadaEm,
      ).toBeNull()
    })
  })
})

async function desativar(usuario: UsuarioCriado, dados: DadosUsuario) {
  if (dados.ativo === false) {
    await prismaTeste.usuario.update({ where: { id: usuario.id }, data: { ativo: false } })
  }
  if (dados.vinculoAtivo === false) {
    await prismaTeste.vinculoAtletica.update({
      where: { id: usuario.vinculo.id },
      data: { ativo: false },
    })
  }
}
