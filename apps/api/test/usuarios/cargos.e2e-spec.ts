import { papelAlteradoSchema, type Papel } from '@atletica/shared'
import request from 'supertest'
import type { RespostaErro } from '../../src/common/erros/erro-negocio'
import { AtleticaPadraoService } from '../../src/modules/atleticas/atletica-padrao.service'
import { aguardarOuvintes, espiarEventos, type EspiaoEventos } from '../eventos'
import { criarAtletica } from '../fabricas/atletica'
import { tokenPara } from '../fabricas/auth'
import { criarUsuario, type DadosUsuario, type UsuarioCriado } from '../fabricas/usuario'
import { criarApp, type AppDeTeste } from '../setup/criar-app'
import { prismaTeste } from '../setup/prisma-teste'

const ROTA = '/api/v1/usuarios'
const ID_INEXISTENTE = '0b6f8a52-8e5d-4a43-9d6c-1f0f3c2b7a90'
const erro = (resposta: { body: unknown }) => resposta.body as RespostaErro

describe('Cargos (#28)', () => {
  let contexto: AppDeTeste
  let padraoId: string
  let eventos: EspiaoEventos

  const usuario = (dados: DadosUsuario = {}) => criarUsuario({ atleticaId: padraoId, ...dados })

  async function como(solicitante: UsuarioCriado) {
    const token = await tokenPara(solicitante)
    return {
      token,
      alterar: (id: string, corpo: object) =>
        request(contexto.http)
          .put(`${ROTA}/${id}/papel`)
          .set('Authorization', `Bearer ${token}`)
          .send(corpo),
    }
  }

  const papelDe = async (usuarioId: string) =>
    (
      await prismaTeste.vinculoAtletica.findFirstOrThrow({
        where: { usuarioId, atleticaId: padraoId },
      })
    ).papel
  const auditoria = () =>
    prismaTeste.registroAuditoria.findMany({
      where: { acao: 'CARGO_ALTERADO' },
      orderBy: { criadoEm: 'asc' },
    })
  const eventosDeCargo = async () => {
    await aguardarOuvintes()
    return eventos.emitidos().filter(({ nome }) => nome === 'usuario.papelAlterado')
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

  describe('autenticação, papel e alvo (critérios 14, 15, 16, 19 e 20)', () => {
    it('sem token → 401', async () => {
      const resposta = await request(contexto.http)
        .put(`${ROTA}/${ID_INEXISTENTE}/papel`)
        .send({ papel: 'DIRETOR' })
      expect(resposta.status).toBe(401)
    })

    it.each<Papel>(['PRESIDENTE', 'VICE_PRESIDENTE', 'DIRETOR'])(
      '%s → 403 FORBIDDEN',
      async (papel) => {
        const alvo = await usuario()
        const resposta = await (
          await como(await usuario({ papel }))
        ).alterar(alvo.id, {
          papel: 'DIRETOR',
        })
        expect(resposta.status).toBe(403)
        expect(erro(resposta).code).toBe('FORBIDDEN')
        expect(await papelDe(alvo.id)).toBe('ATLETA')
      },
    )

    it('outra atlética ou inexistente → 404', async () => {
      const api = await como(await usuario({ papel: 'ADMINISTRADOR' }))
      const deFora = await criarUsuario({ atleticaId: (await criarAtletica()).id })
      for (const id of [deFora.id, ID_INEXISTENTE]) {
        const resposta = await api.alterar(id, { papel: 'DIRETOR' })
        expect(resposta.status).toBe(404)
        expect(erro(resposta).code).toBe('NOT_FOUND')
      }
    })

    it('conta excluída → 409 USUARIO_EXCLUIDO', async () => {
      const api = await como(await usuario({ papel: 'ADMINISTRADOR' }))
      const alvo = await usuario()
      await prismaTeste.usuario.update({
        where: { id: alvo.id },
        data: { excluidoEm: new Date(), ativo: false },
      })
      const resposta = await api.alterar(alvo.id, { papel: 'DIRETOR' })
      expect(resposta.status).toBe(409)
      expect(erro(resposta).code).toBe('USUARIO_EXCLUIDO')
    })

    it.each([{ papel: 'SUPERADMIN' }, {}, { papel: 'DIRETOR', ativo: true }])(
      'corpo %o → 400 VALIDATION_ERROR',
      async (corpo) => {
        const api = await como(await usuario({ papel: 'ADMINISTRADOR' }))
        const resposta = await api.alterar((await usuario()).id, corpo)
        expect(resposta.status).toBe(400)
        expect(erro(resposta).code).toBe('VALIDATION_ERROR')
      },
    )
  })

  it('Atleta → Diretor: 200, auditoria e evento após o commit (critério 1)', async () => {
    const admin = await usuario({ papel: 'ADMINISTRADOR' })
    const atleta = await usuario()

    const resposta = await (await como(admin)).alterar(atleta.id, { papel: 'DIRETOR' })

    expect(resposta.status).toBe(200)
    expect(resposta.headers['cache-control']).toBe('no-store')
    expect(papelAlteradoSchema.parse(resposta.body)).toEqual({
      alterado: true,
      usuario: { id: atleta.id, papelAnterior: 'ATLETA', papel: 'DIRETOR' },
      substituido: null,
    })
    expect(await papelDe(atleta.id)).toBe('DIRETOR')
    expect(await auditoria()).toEqual([
      expect.objectContaining({
        usuarioId: admin.id,
        entidade: 'VinculoAtletica',
        entidadeId: atleta.id,
        dados: { antes: { papel: 'ATLETA' }, depois: { papel: 'DIRETOR' } },
      }),
    ])
    expect(await eventosDeCargo()).toEqual([
      {
        nome: 'usuario.papelAlterado',
        payload: {
          atleticaId: padraoId,
          usuarioId: atleta.id,
          papelAnterior: 'ATLETA',
          papelNovo: 'DIRETOR',
          autorId: admin.id,
        },
      },
    ])
  })

  it('efeito imediato com o mesmo access token (critério 2)', async () => {
    const api = await como(await usuario({ papel: 'ADMINISTRADOR' }))
    const atleta = await usuario()
    const tokenAtleta = await tokenPara(atleta)
    const criarModalidade = () =>
      request(contexto.http)
        .post('/api/v1/modalidades')
        .set('Authorization', `Bearer ${tokenAtleta}`)
        .send({ nome: 'Handebol', icone: 'handball' })

    expect((await criarModalidade()).status).toBe(403)
    await api.alterar(atleta.id, { papel: 'DIRETOR' })
    expect((await criarModalidade()).status).toBe(201)
    await api.alterar(atleta.id, { papel: 'ATLETA' })
    const rebaixado = await criarModalidade()
    expect(rebaixado.status).toBe(403)
    expect(erro(rebaixado).code).toBe('FORBIDDEN')
  })

  describe('substituição de Presidente e Vice (RN07)', () => {
    it.each<Papel>(['PRESIDENTE', 'VICE_PRESIDENTE'])(
      '%s: sem confirmação → 409 e nada muda; confirmada → anterior vira Diretor (critérios 3–5)',
      async (cargo) => {
        const admin = await usuario({ papel: 'ADMINISTRADOR' })
        const ana = await usuario({ papel: cargo, nome: 'Ana Souza' })
        const bruno = await usuario({ papel: 'DIRETOR' })
        const api = await como(admin)

        const recusa = await api.alterar(bruno.id, { papel: cargo })

        expect(recusa.status).toBe(409)
        const { code, message, details } = erro(recusa)
        expect(code).toBe('SUBSTITUICAO_NECESSARIA')
        expect(message).toMatch(/^Ana Souza é o\(a\) atual .+ e passará a Diretor\(a\)\.$/)
        expect(details.map(({ field }) => field)).toEqual(['confirmarSubstituicao'])
        expect([await papelDe(ana.id), await papelDe(bruno.id)]).toEqual([cargo, 'DIRETOR'])
        expect(await eventosDeCargo()).toEqual([])

        const resposta = await api.alterar(bruno.id, { papel: cargo, confirmarSubstituicao: true })

        expect(resposta.status).toBe(200)
        expect(resposta.body).toEqual({
          alterado: true,
          usuario: { id: bruno.id, papelAnterior: 'DIRETOR', papel: cargo },
          substituido: { id: ana.id, nome: 'Ana Souza', papelAnterior: cargo, papel: 'DIRETOR' },
        })
        expect([await papelDe(ana.id), await papelDe(bruno.id)]).toEqual(['DIRETOR', cargo])
        expect(await auditoria()).toEqual([
          expect.objectContaining({
            entidadeId: ana.id,
            dados: {
              antes: { papel: cargo },
              depois: { papel: 'DIRETOR' },
              contexto: { substituidoPor: bruno.id },
            },
          }),
          expect.objectContaining({ entidadeId: bruno.id }),
        ])
        const payloads = (await eventosDeCargo()).map(({ payload }) => payload)
        expect(payloads).toEqual([
          expect.objectContaining({ usuarioId: ana.id, papelNovo: 'DIRETOR', autorId: admin.id }),
          expect.objectContaining({ usuarioId: bruno.id, papelNovo: cargo, autorId: admin.id }),
        ])
      },
    )

    it('Vice promovido a Presidente deixa a vice vaga (critério 6)', async () => {
      const api = await como(await usuario({ papel: 'ADMINISTRADOR' }))
      const ana = await usuario({ papel: 'PRESIDENTE' })
      const carla = await usuario({ papel: 'VICE_PRESIDENTE' })

      const resposta = await api.alterar(carla.id, {
        papel: 'PRESIDENTE',
        confirmarSubstituicao: true,
      })

      expect(resposta.status).toBe(200)
      expect([await papelDe(carla.id), await papelDe(ana.id)]).toEqual(['PRESIDENTE', 'DIRETOR'])
      expect(
        await prismaTeste.vinculoAtletica.count({
          where: { atleticaId: padraoId, papel: 'VICE_PRESIDENTE' },
        }),
      ).toBe(0)
    })

    it('Atleta direto a Vice, sem Vice atual: 200 sem confirmação (critério 7)', async () => {
      const api = await como(await usuario({ papel: 'ADMINISTRADOR' }))
      const atleta = await usuario()
      const resposta = await api.alterar(atleta.id, { papel: 'VICE_PRESIDENTE' })
      expect(resposta.status).toBe(200)
      expect(resposta.body).toMatchObject({ substituido: null })
    })

    it('Presidente desativado ainda ocupa o cargo', async () => {
      const api = await como(await usuario({ papel: 'ADMINISTRADOR' }))
      await usuario({ papel: 'PRESIDENTE', vinculoAtivo: false })
      const resposta = await api.alterar((await usuario()).id, { papel: 'PRESIDENTE' })
      expect(erro(resposta).code).toBe('SUBSTITUICAO_NECESSARIA')
    })

    it('promoções simultâneas a Presidente: exatamente um Presidente (critério 8)', async () => {
      const api = await como(await usuario({ papel: 'ADMINISTRADOR' }))
      const [a, b] = await Promise.all([usuario(), usuario()])

      const respostas = await Promise.all(
        [a, b].map(({ id }) => api.alterar(id, { papel: 'PRESIDENTE' })),
      )

      expect(respostas.map(({ status }) => status).sort()).toEqual([200, 409])
      const recusa = respostas.find(({ status }) => status === 409)
      expect(['SUBSTITUICAO_NECESSARIA', 'CONFLITO_CONCORRENTE']).toContain(
        recusa && erro(recusa).code,
      )
      expect(
        await prismaTeste.vinculoAtletica.count({
          where: { atleticaId: padraoId, papel: 'PRESIDENTE' },
        }),
      ).toBe(1)
    })
  })

  describe('último Administrador (RN08)', () => {
    it('único Administrador ativo não muda o próprio papel (critério 9)', async () => {
      const admin = await usuario({ papel: 'ADMINISTRADOR' })
      const resposta = await (await como(admin)).alterar(admin.id, { papel: 'PRESIDENTE' })
      expect(resposta.status).toBe(409)
      expect(erro(resposta).code).toBe('ULTIMO_ADMINISTRADOR')
      expect(await papelDe(admin.id)).toBe('ADMINISTRADOR')
    })

    it('outro Administrador desativado não conta (critério 10)', async () => {
      const admin = await usuario({ papel: 'ADMINISTRADOR' })
      await usuario({ papel: 'ADMINISTRADOR', vinculoAtivo: false })
      const resposta = await (await como(admin)).alterar(admin.id, { papel: 'DIRETOR' })
      expect(erro(resposta).code).toBe('ULTIMO_ADMINISTRADOR')
    })

    it('Administrador rebaixa outro Administrador ativo (critério 11)', async () => {
      const a = await usuario({ papel: 'ADMINISTRADOR' })
      const b = await usuario({ papel: 'ADMINISTRADOR' })
      const resposta = await (await como(a)).alterar(b.id, { papel: 'DIRETOR' })
      expect(resposta.status).toBe(200)
      expect(await papelDe(b.id)).toBe('DIRETOR')
    })

    it('rebaixamento mútuo simultâneo: só um conclui (critério 12)', async () => {
      const a = await usuario({ papel: 'ADMINISTRADOR' })
      const b = await usuario({ papel: 'ADMINISTRADOR' })
      const [apiA, apiB] = await Promise.all([como(a), como(b)])

      const respostas = await Promise.all([
        apiA.alterar(b.id, { papel: 'DIRETOR' }),
        apiB.alterar(a.id, { papel: 'DIRETOR' }),
      ])

      expect(respostas.map(({ status }) => status).sort()).toEqual([200, 403])
      expect(
        await prismaTeste.vinculoAtletica.count({
          where: { atleticaId: padraoId, papel: 'ADMINISTRADOR' },
        }),
      ).toBe(1)
    })

    it('auto-rebaixamento com outro Administrador: 200 e perde o acesso (critério 13)', async () => {
      const a = await usuario({ papel: 'ADMINISTRADOR' })
      await usuario({ papel: 'ADMINISTRADOR' })
      const api = await como(a)

      expect((await api.alterar(a.id, { papel: 'DIRETOR' })).status).toBe(200)

      const depois = await api.alterar(a.id, { papel: 'ADMINISTRADOR' })
      expect(depois.status).toBe(403)
      expect(erro(depois).code).toBe('FORBIDDEN')
    })
  })

  describe('desativado e mesmo papel (critérios 17 e 18)', () => {
    it('promover desativado → 409 USUARIO_DESATIVADO; rebaixar é permitido', async () => {
      const api = await como(await usuario({ papel: 'ADMINISTRADOR' }))
      const atleta = await usuario({ vinculoAtivo: false })
      const diretor = await usuario({ papel: 'DIRETOR', vinculoAtivo: false })

      const promocao = await api.alterar(atleta.id, { papel: 'DIRETOR' })
      expect(promocao.status).toBe(409)
      expect(erro(promocao).code).toBe('USUARIO_DESATIVADO')

      expect((await api.alterar(diretor.id, { papel: 'ATLETA' })).status).toBe(200)
      expect(await papelDe(diretor.id)).toBe('ATLETA')
    })

    it('mesmo papel: 200 alterado false, sem auditoria nem evento', async () => {
      const api = await como(await usuario({ papel: 'ADMINISTRADOR' }))
      const diretor = await usuario({ papel: 'DIRETOR' })

      const resposta = await api.alterar(diretor.id, { papel: 'DIRETOR' })

      expect(resposta.status).toBe(200)
      expect(resposta.body).toEqual({
        alterado: false,
        usuario: { id: diretor.id, papelAnterior: 'DIRETOR', papel: 'DIRETOR' },
        substituido: null,
      })
      expect(await auditoria()).toEqual([])
      expect(await eventosDeCargo()).toEqual([])
    })
  })
})
