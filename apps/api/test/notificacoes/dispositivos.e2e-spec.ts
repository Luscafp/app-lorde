import { dispositivoRegistradoSchema } from '@atletica/shared'
import request from 'supertest'
import type { RespostaErro } from '../../src/common/erros/erro-negocio'
import { SenhaService } from '../../src/infra/senha/senha.service'
import { AtleticaPadraoService } from '../../src/modules/atleticas/atletica-padrao.service'
import { DispositivosService } from '../../src/modules/notificacoes/dispositivos/dispositivos.service'
import { criarAtletica } from '../fabricas/atletica'
import { criarSessao, tokenPara } from '../fabricas/auth'
import { criarDispositivo } from '../fabricas/notificacoes'
import { criarUsuario, type UsuarioCriado } from '../fabricas/usuario'
import { criarApp, type AppDeTeste } from '../setup/criar-app'
import { aguardarCondicao } from '../setup/fila'
import { prismaTeste } from '../setup/prisma-teste'

const ROTA = '/api/v1/me/dispositivos'
const SENHA = 'lorde2026'
const TOKEN_PUSH = 'ExponentPushToken[aparelho-1]'
const DIA_MS = 24 * 60 * 60 * 1000
const erro = (resposta: { body: unknown }) => resposta.body as RespostaErro

describe('Dispositivos push /me/dispositivos (#87)', () => {
  let contexto: AppDeTeste
  let padraoId: string
  let senhaHash: string

  const usuario = () => criarUsuario({ atleticaId: padraoId, senhaHash })
  const dispositivosDe = (alvo: { id: string }) =>
    prismaTeste.dispositivoPush.findMany({ where: { usuarioId: alvo.id }, orderBy: { id: 'asc' } })

  async function como(alvo: UsuarioCriado, sessao?: { id: string }) {
    const token = await tokenPara(alvo, { sessao })
    const autenticar = (teste: request.Test) => teste.set('Authorization', `Bearer ${token}`)
    return {
      registrar: (corpo: object) => autenticar(request(contexto.http).post(ROTA).send(corpo)),
      remover: (id: string) => autenticar(request(contexto.http).delete(`${ROTA}/${id}`)),
    }
  }

  /** Login real: devolve o access token, o refresh token e o id da sessão. */
  async function entrar(alvo: UsuarioCriado) {
    const resposta = await request(contexto.http)
      .post('/api/v1/auth/login')
      .send({ email: alvo.email, senha: SENHA })
    expect(resposta.status).toBe(200)
    const { accessToken, refreshToken } = resposta.body as {
      accessToken: string
      refreshToken: string
    }
    const sessaoId = refreshToken.split('.')[0] ?? ''
    return { accessToken, refreshToken, sessaoId }
  }

  function registrarCom(accessToken: string, tokenPush: string) {
    return request(contexto.http)
      .post(ROTA)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ tokenPush, plataforma: 'android' })
  }

  beforeAll(async () => {
    contexto = await criarApp()
    padraoId = contexto.app.get(AtleticaPadraoService).id()
    senhaHash = await contexto.app.get(SenhaService).hash(SENHA)
  })

  beforeEach(async () => {
    await criarAtletica({ id: padraoId, nome: 'Atlética Lorde' })
  })

  afterAll(async () => {
    await contexto.app.close()
  })

  describe('POST', () => {
    it('sem token → 401 (critério 19)', async () => {
      const resposta = await request(contexto.http)
        .post(ROTA)
        .send({ tokenPush: TOKEN_PUSH, plataforma: 'android' })
      expect(resposta.status).toBe(401)
      expect(erro(resposta).code).toBe('UNAUTHENTICATED')
    })

    it.each([
      ['token fora do formato', { tokenPush: 'token-qualquer', plataforma: 'android' }],
      ['plataforma ios', { tokenPush: TOKEN_PUSH, plataforma: 'ios' }],
      ['campo extra', { tokenPush: TOKEN_PUSH, plataforma: 'android', sessaoId: 'x' }],
    ])('%s → 400', async (_, corpo) => {
      const api = await como(await usuario())

      const resposta = await api.registrar(corpo)

      expect(resposta.status).toBe(400)
      expect(erro(resposta).code).toBe('VALIDATION_ERROR')
    })

    it('registra com a sessão do token (critério 1)', async () => {
      const atleta = await usuario()
      const sessao = await criarSessao({ usuarioId: atleta.id, atleticaId: padraoId })
      const api = await como(atleta, sessao)

      const resposta = await api.registrar({ tokenPush: TOKEN_PUSH, plataforma: 'android' })

      expect(resposta.status).toBe(200)
      expect(resposta.headers['cache-control']).toBe('no-store')
      const corpo = dispositivoRegistradoSchema.parse(resposta.body)
      expect(await dispositivosDe(atleta)).toEqual([
        expect.objectContaining({
          id: corpo.id,
          sessaoId: sessao.id,
          tokenPush: TOKEN_PUSH,
          plataforma: 'android',
          ultimoUsoEm: new Date(corpo.ultimoUsoEm),
        }),
      ])
    })

    it('repetir o registro atualiza ultimoUsoEm sem duplicar', async () => {
      const atleta = await usuario()
      const antigo = await criarDispositivo(atleta, {
        tokenPush: TOKEN_PUSH,
        ultimoUsoEm: new Date(Date.now() - 10 * DIA_MS),
      })
      const api = await como(atleta)

      const resposta = await api.registrar({ tokenPush: TOKEN_PUSH, plataforma: 'android' })

      expect(resposta.status).toBe(200)
      const [dispositivo, ...outros] = await dispositivosDe(atleta)
      expect(outros).toEqual([])
      expect(dispositivo?.id).toBe(antigo.id)
      expect(dispositivo?.ultimoUsoEm.getTime()).toBeGreaterThan(antigo.ultimoUsoEm.getTime())
    })

    it('token de outra conta passa para o usuário atual com a sessão atual', async () => {
      const anterior = await usuario()
      const atual = await usuario()
      const antigo = await criarDispositivo(anterior, { tokenPush: TOKEN_PUSH })
      const sessao = await criarSessao({ usuarioId: atual.id, atleticaId: padraoId })

      const resposta = await (
        await como(atual, sessao)
      ).registrar({ tokenPush: TOKEN_PUSH, plataforma: 'android' })

      expect(resposta.status).toBe(200)
      expect(await dispositivosDe(anterior)).toEqual([])
      expect(await dispositivosDe(atual)).toEqual([
        expect.objectContaining({ id: antigo.id, sessaoId: sessao.id, usuarioId: atual.id }),
      ])
    })

    it('registros simultâneos do mesmo token geram um único dispositivo', async () => {
      const atleta = await usuario()
      const api = await como(atleta)

      const respostas = await Promise.all(
        Array.from({ length: 5 }, () =>
          api.registrar({ tokenPush: TOKEN_PUSH, plataforma: 'android' }),
        ),
      )

      expect(respostas.map(({ status }) => status)).toEqual(Array(5).fill(200))
      expect(await dispositivosDe(atleta)).toHaveLength(1)
    })
  })

  describe('DELETE /:id', () => {
    it('sem token → 401', async () => {
      const dispositivo = await criarDispositivo(await usuario())
      const resposta = await request(contexto.http).delete(`${ROTA}/${dispositivo.id}`)
      expect(resposta.status).toBe(401)
      expect(erro(resposta).code).toBe('UNAUTHENTICATED')
    })

    it('id não-UUID → 400', async () => {
      const resposta = await (await como(await usuario())).remover('abc')
      expect(resposta.status).toBe(400)
      expect(erro(resposta).code).toBe('VALIDATION_ERROR')
    })

    it('de outro usuário → 404 e o dispositivo fica (critério 19)', async () => {
      const dono = await usuario()
      const dispositivo = await criarDispositivo(dono)

      const resposta = await (await como(await usuario())).remover(dispositivo.id)

      expect(resposta.status).toBe(404)
      expect(erro(resposta).code).toBe('NOT_FOUND')
      expect(await dispositivosDe(dono)).toHaveLength(1)
    })

    it('inexistente → 404', async () => {
      const resposta = await (await como(await usuario())).remover(padraoId)
      expect(resposta.status).toBe(404)
    })

    it('do próprio usuário → 204', async () => {
      const atleta = await usuario()
      const dispositivo = await criarDispositivo(atleta)
      const outro = await criarDispositivo(atleta)

      const resposta = await (await como(atleta)).remover(dispositivo.id)

      expect(resposta.status).toBe(204)
      expect((await dispositivosDe(atleta)).map(({ id }) => id)).toEqual([outro.id])
    })
  })

  describe('usuario.sessaoEncerrada', () => {
    const semDispositivosDaSessao = (sessaoId: string) => async () =>
      (await prismaTeste.dispositivoPush.count({ where: { sessaoId } })) === 0

    it('logout remove só o aparelho da sessão; os outros continuam (critério 17)', async () => {
      const atleta = await usuario()
      const celular = await entrar(atleta)
      const tablet = await entrar(atleta)
      await registrarCom(celular.accessToken, 'ExponentPushToken[celular]')
      await registrarCom(tablet.accessToken, 'ExponentPushToken[tablet]')

      const resposta = await request(contexto.http)
        .post('/api/v1/auth/logout')
        .send({ refreshToken: celular.refreshToken })
      expect(resposta.status).toBe(204)

      await aguardarCondicao(semDispositivosDaSessao(celular.sessaoId))
      expect(await dispositivosDe(atleta)).toEqual([
        expect.objectContaining({ tokenPush: 'ExponentPushToken[tablet]' }),
      ])
    })

    it('troca de senha remove só os aparelhos das sessões revogadas (critério 22)', async () => {
      const atleta = await usuario()
      const atual = await entrar(atleta)
      const outra1 = await entrar(atleta)
      const outra2 = await entrar(atleta)
      await registrarCom(atual.accessToken, 'ExponentPushToken[atual]')
      await registrarCom(outra1.accessToken, 'ExponentPushToken[outra-1]')
      await registrarCom(outra2.accessToken, 'ExponentPushToken[outra-2]')

      const resposta = await request(contexto.http)
        .put('/api/v1/me/senha')
        .set('Authorization', `Bearer ${atual.accessToken}`)
        .send({ senhaAtual: SENHA, novaSenha: 'novaSenha9' })
      expect(resposta.status).toBe(204)

      await aguardarCondicao(async () => (await dispositivosDe(atleta)).length === 1)
      expect(await dispositivosDe(atleta)).toEqual([
        expect.objectContaining({
          tokenPush: 'ExponentPushToken[atual]',
          sessaoId: atual.sessaoId,
        }),
      ])
    })

    it('exclusão de conta remove todos, inclusive sem sessão (critério 18)', async () => {
      const atleta = await usuario()
      const atual = await entrar(atleta)
      await registrarCom(atual.accessToken, 'ExponentPushToken[atual]')
      await criarDispositivo(atleta, { sessaoId: null })

      const resposta = await request(contexto.http)
        .delete('/api/v1/me/conta')
        .set('Authorization', `Bearer ${atual.accessToken}`)
        .send({ senha: SENHA })
      expect(resposta.status).toBe(204)

      await aguardarCondicao(async () => (await dispositivosDe(atleta)).length === 0)
    })
  })

  describe('limpeza diária (dispositivos.limpeza)', () => {
    it('apaga quem não é usado há mais de 90 dias; 89 dias permanece', async () => {
      const atleta = await usuario()
      const agora = new Date()
      const velho = await criarDispositivo(atleta, {
        ultimoUsoEm: new Date(agora.getTime() - 91 * DIA_MS),
      })
      const recente = await criarDispositivo(atleta, {
        ultimoUsoEm: new Date(agora.getTime() - 89 * DIA_MS),
      })

      const removidos = await contexto.app.get(DispositivosService).limparInativos(agora)

      expect(removidos).toBe(1)
      const restantes = (await dispositivosDe(atleta)).map(({ id }) => id)
      expect(restantes).toEqual([recente.id])
      expect(restantes).not.toContain(velho.id)
    })

    it('o cron está agendado às 04:00 em America/Fortaleza', async () => {
      const [agenda] = await prismaTeste.$queryRaw<{ cron: string; timezone: string }[]>`
        SELECT cron, options->>'tz' AS timezone FROM pgboss.schedule
        WHERE name = 'dispositivos.limpeza'`
      expect(agenda).toEqual({ cron: '0 4 * * *', timezone: 'America/Fortaleza' })
    })
  })
})
