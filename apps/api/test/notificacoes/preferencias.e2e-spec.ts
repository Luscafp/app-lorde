import { preferenciasSchema, type Preferencias } from '@atletica/shared'
import request from 'supertest'
import type { RespostaErro } from '../../src/common/erros/erro-negocio'
import { AtleticaPadraoService } from '../../src/modules/atleticas/atletica-padrao.service'
import { criarAtletica } from '../fabricas/atletica'
import { tokenPara } from '../fabricas/auth'
import { criarUsuario, type UsuarioCriado } from '../fabricas/usuario'
import { criarApp, type AppDeTeste } from '../setup/criar-app'
import { prismaTeste } from '../setup/prisma-teste'

const ROTA = '/api/v1/me/preferencias-notificacao'
const erro = (resposta: { body: unknown }) => resposta.body as RespostaErro

const PADRAO: Preferencias = {
  pushAtivo: true,
  novosEventos: true,
  alteracoesEventos: true,
  lembretes: true,
  antecedenciaLembreteHoras: 2,
  resultados: true,
  noticias: true,
  solicitacoes: true,
  avisos: true,
}

describe('Preferências de notificação /me/preferencias-notificacao (#37)', () => {
  let contexto: AppDeTeste
  let padraoId: string

  const usuario = () => criarUsuario({ atleticaId: padraoId })
  const registroDe = (alvo: UsuarioCriado) =>
    prismaTeste.preferenciaNotificacao.findUnique({ where: { usuarioId: alvo.id } })

  async function como(solicitante: UsuarioCriado) {
    const token = await tokenPara(solicitante)
    const autenticar = (teste: request.Test) => teste.set('Authorization', `Bearer ${token}`)
    return {
      obter: () => autenticar(request(contexto.http).get(ROTA)),
      atualizar: (corpo: unknown) =>
        autenticar(
          request(contexto.http)
            .patch(ROTA)
            .send(corpo as object),
        ),
    }
  }

  beforeAll(async () => {
    contexto = await criarApp()
    padraoId = contexto.app.get(AtleticaPadraoService).id()
  })

  beforeEach(async () => {
    await criarAtletica({ id: padraoId, nome: 'Atlética Lorde' })
  })

  afterAll(async () => {
    await contexto.app.close()
  })

  it.each(['get', 'patch'] as const)('%s sem token → 401 (critério 15)', async (metodo) => {
    const resposta = await request(contexto.http)[metodo](ROTA).send({ noticias: false })
    expect(resposta.status).toBe(401)
    expect(erro(resposta).code).toBe('UNAUTHENTICATED')
  })

  describe('GET', () => {
    it('sem registro, cria com os padrões e devolve (critério 1)', async () => {
      const atleta = await usuario()
      expect(await registroDe(atleta)).toBeNull()

      const resposta = await (await como(atleta)).obter()

      expect(resposta.status).toBe(200)
      expect(resposta.headers['cache-control']).toBe('no-store')
      expect(preferenciasSchema.parse(resposta.body)).toEqual(PADRAO)
      expect(await registroDe(atleta)).toMatchObject(PADRAO)
    })

    it('com registro, devolve os valores gravados sem alterá-lo', async () => {
      const atleta = await usuario()
      const gravado = await prismaTeste.preferenciaNotificacao.create({
        data: { usuarioId: atleta.id, noticias: false, antecedenciaLembreteHoras: 24 },
      })

      const resposta = await (await como(atleta)).obter()

      expect(resposta.body).toEqual({ ...PADRAO, noticias: false, antecedenciaLembreteHoras: 24 })
      expect((await registroDe(atleta))?.atualizadoEm).toEqual(gravado.atualizadoEm)
    })
  })

  describe('PATCH', () => {
    it('altera só o campo enviado e persiste (critério 2)', async () => {
      const atleta = await usuario()
      const api = await como(atleta)
      await api.atualizar({ lembretes: false })

      const resposta = await api.atualizar({ noticias: false })

      expect(resposta.status).toBe(200)
      expect(resposta.headers['cache-control']).toBe('no-store')
      const esperado = { ...PADRAO, lembretes: false, noticias: false }
      expect(preferenciasSchema.parse(resposta.body)).toEqual(esperado)
      expect((await api.obter()).body).toEqual(esperado)
    })

    it('sem registro, cria com os padrões e o campo enviado', async () => {
      const atleta = await usuario()

      const resposta = await (await como(atleta)).atualizar({ antecedenciaLembreteHoras: 24 })

      expect(resposta.body).toEqual({ ...PADRAO, antecedenciaLembreteHoras: 24 })
    })

    it('geral desligado mantém as categorias (critério 4)', async () => {
      const atleta = await usuario()
      const api = await como(atleta)
      await api.atualizar({ resultados: false })

      await api.atualizar({ pushAtivo: false })
      const religado = await api.atualizar({ pushAtivo: true })

      expect(religado.body).toEqual({ ...PADRAO, resultados: false })
    })

    it('não altera as preferências de outro usuário', async () => {
      const [eu, outro] = await Promise.all([usuario(), usuario()])
      await (await como(outro)).obter()

      await (await como(eu)).atualizar({ noticias: false })

      expect(await registroDe(outro)).toMatchObject(PADRAO)
    })

    it('antecedência 3 → 400 com details[0].field (critério 8)', async () => {
      const resposta = await (
        await como(await usuario())
      ).atualizar({
        antecedenciaLembreteHoras: 3,
      })

      expect(resposta.status).toBe(400)
      expect(erro(resposta).code).toBe('VALIDATION_ERROR')
      expect(erro(resposta).details[0]?.field).toBe('antecedenciaLembreteHoras')
    })

    it.each([
      ['vazio', {}],
      [
        'campo desconhecido',
        { noticias: false, usuarioId: 'b1b1b1b1-0000-4000-8000-000000000001' },
      ],
      ['tipo errado', { noticias: 'false' }],
      ['sem corpo de objeto', [true]],
    ])('%s → 400 VALIDATION_ERROR (critério 9)', async (_, corpo) => {
      const atleta = await usuario()

      const resposta = await (await como(atleta)).atualizar(corpo)

      expect(resposta.status).toBe(400)
      expect(erro(resposta).code).toBe('VALIDATION_ERROR')
      expect(await registroDe(atleta)).toBeNull()
    })
  })
})
