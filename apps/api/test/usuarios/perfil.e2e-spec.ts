import { DeleteObjectCommand, HeadObjectCommand, NotFound } from '@aws-sdk/client-s3'
import { fotoAtualizadaSchema, perfilSchema, type Perfil } from '@atletica/shared'
import request from 'supertest'
import type { RespostaErro } from '../../src/common/erros/erro-negocio'
import { TransacaoService } from '../../src/infra/eventos/apos-commit'
import { SenhaService } from '../../src/infra/senha/senha.service'
import { AtleticaPadraoService } from '../../src/modules/atleticas/atletica-padrao.service'
import { SessaoService } from '../../src/modules/auth/sessao.service'
import { aguardarOuvintes, espiarEventos, type EspiaoEventos } from '../eventos'
import { criarAtletica } from '../fabricas/atletica'
import { tokenPara } from '../fabricas/auth'
import { criarModalidade } from '../fabricas/modalidades'
import {
  comandosEnviados,
  simularArmazenamento,
  type ArmazenamentoSimulado,
} from '../fabricas/uploads'
import { criarUsuario, type DadosUsuario, type UsuarioCriado } from '../fabricas/usuario'
import { criarApp, type AppDeTeste } from '../setup/criar-app'
import { prismaTeste } from '../setup/prisma-teste'

const ROTA = '/api/v1/me'
const BASE_PUBLICA = 'https://imagens.teste.local'
const SENHA = 'lorde2026'
const NOVA_SENHA = 'novaSenha9'
const UUID_FOTO = '2b7f5c1e-0d4a-4f8e-9b3c-7a6d5e4f3a21'
const erro = (resposta: { body: unknown }) => resposta.body as RespostaErro

describe('Perfil /me (#13)', () => {
  let contexto: AppDeTeste
  let armazenamento: ArmazenamentoSimulado
  let padraoId: string
  let eventos: EspiaoEventos
  let senhaHash: string

  const usuario = (dados: DadosUsuario = {}) =>
    criarUsuario({ atleticaId: padraoId, senhaHash, ...dados })
  const chaveDe = (alvo: UsuarioCriado, uuid = UUID_FOTO) =>
    `usuarios/${alvo.id}/perfil/${uuid}.jpg`

  async function como(solicitante: UsuarioCriado, sessao?: { id: string }) {
    const token = await tokenPara(solicitante, { sessao })
    const autenticar = (teste: request.Test) => teste.set('Authorization', `Bearer ${token}`)
    return {
      obter: () => autenticar(request(contexto.http).get(ROTA)),
      atualizar: (corpo: object) => autenticar(request(contexto.http).patch(ROTA).send(corpo)),
      definirFoto: (corpo: object) =>
        autenticar(request(contexto.http).put(`${ROTA}/foto`).send(corpo)),
      removerFoto: () => autenticar(request(contexto.http).delete(`${ROTA}/foto`)),
      alterarSenha: (corpo: object) =>
        autenticar(request(contexto.http).put(`${ROTA}/senha`).send(corpo)),
    }
  }

  const perfil = async (solicitante: UsuarioCriado): Promise<Perfil> =>
    perfilSchema.parse((await (await como(solicitante)).obter()).body)

  async function abrirSessao(alvo: UsuarioCriado) {
    return contexto.app
      .get(TransacaoService)
      .executar((tx) =>
        contexto.app.get(SessaoService).criar(tx, { usuarioId: alvo.id, atleticaId: padraoId }),
      )
  }

  async function criarTime(nome: string, dados: { capitaoId?: string; ativo?: boolean } = {}) {
    const modalidade = await criarModalidade({ nome: `Modalidade ${nome}`, icone: 'futsal' })
    return prismaTeste.time.create({
      data: { nome, atleticaId: padraoId, modalidadeId: modalidade.id, ...dados },
    })
  }

  const fotoKeyDe = async (alvo: UsuarioCriado) =>
    (await prismaTeste.usuario.findUniqueOrThrow({ where: { id: alvo.id } })).fotoKey
  const apagadas = () =>
    comandosEnviados(armazenamento.s3.send, DeleteObjectCommand).map(({ input }) => input.Key)

  beforeAll(async () => {
    armazenamento = simularArmazenamento()
    contexto = await criarApp({ ajustar: armazenamento.ajustar })
    padraoId = contexto.app.get(AtleticaPadraoService).id()
    senhaHash = await contexto.app.get(SenhaService).hash(SENHA)
  })

  beforeEach(async () => {
    await criarAtletica({ id: padraoId, nome: 'Atlética Lorde' })
    eventos = espiarEventos(contexto.app)
    armazenamento.s3.send.mockClear()
  })

  afterAll(async () => {
    await contexto.app.close()
  })

  it.each([
    ['get', ROTA],
    ['patch', ROTA],
    ['put', `${ROTA}/foto`],
    ['delete', `${ROTA}/foto`],
    ['put', `${ROTA}/senha`],
  ] as const)('%s %s sem token → 401 (critério 17)', async (metodo, rota) => {
    const resposta = await request(contexto.http)[metodo](rota).send({})
    expect(resposta.status).toBe(401)
    expect(erro(resposta).code).toBe('UNAUTHENTICATED')
  })

  describe('GET /me', () => {
    it('diretor com dois times, capitão de um, por nome (critério 1)', async () => {
      const diretor = await usuario({ papel: 'DIRETOR', nome: 'Ana Souza', email: 'ana@ex.com' })
      const futsal = await criarTime('Futsal Masculino', { capitaoId: diretor.id })
      const volei = await criarTime('Vôlei Misto')
      await prismaTeste.membroTime.createMany({
        data: [
          { atleticaId: padraoId, timeId: volei.id, usuarioId: diretor.id },
          { atleticaId: padraoId, timeId: futsal.id, usuarioId: diretor.id },
        ],
      })
      await prismaTeste.aceiteTermos.createMany({
        data: [
          { usuarioId: diretor.id, versao: '2026-09', aceitoEm: new Date('2026-09-01T12:00:00Z') },
          { usuarioId: diretor.id, versao: '2026-10', aceitoEm: new Date('2026-10-02T12:00:00Z') },
        ],
      })

      const resposta = await (await como(diretor)).obter()

      expect(resposta.status).toBe(200)
      expect(resposta.headers['cache-control']).toBe('no-store')
      const corpo = perfilSchema.parse(resposta.body)
      expect(corpo).toMatchObject({
        id: diretor.id,
        nome: 'Ana Souza',
        email: 'ana@ex.com',
        fotoUrl: null,
        emailVerificado: false,
        papel: 'DIRETOR',
        atletica: { id: padraoId, nome: 'Atlética Lorde' },
        termosAceitos: { versao: '2026-10', aceitoEm: '2026-10-02T12:00:00.000Z' },
        criadoEm: diretor.criadoEm.toISOString(),
      })
      expect(corpo.times.map(({ nome, capitao }) => ({ nome, capitao }))).toEqual([
        { nome: 'Futsal Masculino', capitao: true },
        { nome: 'Vôlei Misto', capitao: false },
      ])
      expect(corpo.times[0]?.modalidade).toEqual({
        id: futsal.modalidadeId,
        nome: 'Modalidade Futsal Masculino',
        icone: 'futsal',
      })
      expect(resposta.body).not.toHaveProperty('senhaHash')
      expect(resposta.body).not.toHaveProperty('fotoKey')
    })

    it('sem times: lista vazia (critério 2)', async () => {
      expect((await perfil(await usuario())).times).toEqual([])
    })

    it('vínculo encerrado, time inativo e time de outra atlética não aparecem (critério 3)', async () => {
      const atleta = await usuario()
      const encerrado = await criarTime('Basquete')
      const inativo = await criarTime('Handebol', { ativo: false })
      const atual = await criarTime('Vôlei')
      const outra = await criarAtletica()
      const modalidade = await criarModalidade()
      const deFora = await prismaTeste.time.create({
        data: { nome: 'Futsal', atleticaId: outra.id, modalidadeId: modalidade.id },
      })
      await prismaTeste.membroTime.createMany({
        data: [
          {
            atleticaId: padraoId,
            timeId: encerrado.id,
            usuarioId: atleta.id,
            entradaEm: new Date(Date.now() - 86_400_000),
            saidaEm: new Date(),
          },
          { atleticaId: padraoId, timeId: inativo.id, usuarioId: atleta.id },
          { atleticaId: padraoId, timeId: atual.id, usuarioId: atleta.id },
          { atleticaId: outra.id, timeId: deFora.id, usuarioId: atleta.id },
        ],
      })

      expect((await perfil(atleta)).times.map(({ id }) => id)).toEqual([atual.id])
    })

    it('papel alterado no banco aparece na próxima chamada, com o mesmo token (critério 4)', async () => {
      const atleta = await usuario()
      const api = await como(atleta)
      expect(perfilSchema.parse((await api.obter()).body).papel).toBe('ATLETA')

      await prismaTeste.vinculoAtletica.update({
        where: { id: atleta.vinculo.id },
        data: { papel: 'DIRETOR' },
      })

      expect(perfilSchema.parse((await api.obter()).body).papel).toBe('DIRETOR')
    })

    it('fotoUrl calculada da chave', async () => {
      const atleta = await usuario()
      await prismaTeste.usuario.update({
        where: { id: atleta.id },
        data: { fotoKey: chaveDe(atleta) },
      })
      expect((await perfil(atleta)).fotoUrl).toBe(`${BASE_PUBLICA}/${chaveDe(atleta)}`)
    })
  })

  describe('PATCH /me', () => {
    it('aplica trim e devolve o perfil (critério 5)', async () => {
      const atleta = await usuario({ nome: 'Ana' })
      const resposta = await (await como(atleta)).atualizar({ nome: '  Ana Souza  ' })

      expect(resposta.status).toBe(200)
      expect(perfilSchema.parse(resposta.body).nome).toBe('Ana Souza')
      expect((await perfil(atleta)).nome).toBe('Ana Souza')
    })

    it.each([
      [{ nome: 'A' }, 'nome'],
      [{ nome: 'x'.repeat(81) }, 'nome'],
    ])('%o → 400 VALIDATION_ERROR (critério 6)', async (corpo, campo) => {
      const atleta = await usuario({ nome: 'Ana' })
      const resposta = await (await como(atleta)).atualizar(corpo)
      expect(resposta.status).toBe(400)
      expect(erro(resposta).code).toBe('VALIDATION_ERROR')
      expect(erro(resposta).details[0]?.field).toBe(campo)
    })

    it.each([{ papel: 'ADMINISTRADOR' }, { email: 'novo@ex.com' }, { ativo: false }])(
      'mass assignment %o → 400 e nada muda',
      async (extra) => {
        const atleta = await usuario({ nome: 'Ana' })
        const resposta = await (await como(atleta)).atualizar({ nome: 'Ana Souza', ...extra })
        expect(resposta.status).toBe(400)
        expect(erro(resposta).code).toBe('VALIDATION_ERROR')
        expect(await perfil(atleta)).toMatchObject({ nome: 'Ana', papel: 'ATLETA' })
      },
    )
  })

  describe('PUT /me/foto', () => {
    it('chave própria: grava, devolve a URL e remove a anterior do R2 (critério 7)', async () => {
      const atleta = await usuario()
      const anterior = chaveDe(atleta, 'a1a1a1a1-0000-4000-8000-000000000001')
      await prismaTeste.usuario.update({ where: { id: atleta.id }, data: { fotoKey: anterior } })

      const resposta = await (await como(atleta)).definirFoto({ fotoKey: chaveDe(atleta) })

      expect(resposta.status).toBe(200)
      expect(fotoAtualizadaSchema.parse(resposta.body)).toEqual({
        fotoUrl: `${BASE_PUBLICA}/${chaveDe(atleta)}`,
      })
      expect(await fotoKeyDe(atleta)).toBe(chaveDe(atleta))
      expect(comandosEnviados(armazenamento.s3.send, HeadObjectCommand)).toHaveLength(1)
      expect(apagadas()).toEqual([anterior])
    })

    it('chave de outro usuário → 422 UPLOAD_INVALIDO e nada muda (critério 9)', async () => {
      const atleta = await usuario()
      const outro = await usuario()
      const resposta = await (await como(atleta)).definirFoto({ fotoKey: chaveDe(outro) })
      expect(resposta.status).toBe(422)
      expect(erro(resposta).code).toBe('UPLOAD_INVALIDO')
      expect(await fotoKeyDe(atleta)).toBeNull()
    })

    it('chave fora do formato → 422 UPLOAD_INVALIDO', async () => {
      const atleta = await usuario()
      const resposta = await (
        await como(atleta)
      ).definirFoto({
        fotoKey: `atleticas/${padraoId}/noticias/${atleta.id}/${UUID_FOTO}.jpg`,
      })
      expect(resposta.status).toBe(422)
      expect(erro(resposta).code).toBe('UPLOAD_INVALIDO')
    })

    it('objeto inexistente no R2 → 422 UPLOAD_NAO_ENCONTRADO (critério 10)', async () => {
      const atleta = await usuario()
      armazenamento.s3.send.mockRejectedValueOnce(
        new NotFound({ message: 'NotFound', $metadata: { httpStatusCode: 404 } }),
      )
      const resposta = await (await como(atleta)).definirFoto({ fotoKey: chaveDe(atleta) })
      expect(resposta.status).toBe(422)
      expect(erro(resposta).code).toBe('UPLOAD_NAO_ENCONTRADO')
      expect(await fotoKeyDe(atleta)).toBeNull()
    })

    it('objeto > 5 MB → 422 UPLOAD_INVALIDO', async () => {
      const atleta = await usuario()
      armazenamento.s3.send.mockResolvedValueOnce({
        ContentLength: 6 * 1024 * 1024,
        ContentType: 'image/jpeg',
      })
      const resposta = await (await como(atleta)).definirFoto({ fotoKey: chaveDe(atleta) })
      expect(resposta.status).toBe(422)
      expect(erro(resposta).code).toBe('UPLOAD_INVALIDO')
    })

    it('mesma chave já gravada → 200 sem consultar o R2', async () => {
      const atleta = await usuario()
      await prismaTeste.usuario.update({
        where: { id: atleta.id },
        data: { fotoKey: chaveDe(atleta) },
      })
      const resposta = await (await como(atleta)).definirFoto({ fotoKey: chaveDe(atleta) })
      expect(resposta.status).toBe(200)
      expect(armazenamento.s3.send).not.toHaveBeenCalled()
    })

    it('corpo com campo extra → 400', async () => {
      const atleta = await usuario()
      const resposta = await (
        await como(atleta)
      ).definirFoto({
        fotoKey: chaveDe(atleta),
        usuarioId: atleta.id,
      })
      expect(resposta.status).toBe(400)
      expect(erro(resposta).code).toBe('VALIDATION_ERROR')
    })
  })

  describe('DELETE /me/foto', () => {
    it('zera a chave e remove o objeto (critério 11)', async () => {
      const atleta = await usuario()
      await prismaTeste.usuario.update({
        where: { id: atleta.id },
        data: { fotoKey: chaveDe(atleta) },
      })

      const resposta = await (await como(atleta)).removerFoto()

      expect(resposta.status).toBe(204)
      expect(await fotoKeyDe(atleta)).toBeNull()
      expect((await perfil(atleta)).fotoUrl).toBeNull()
      expect(apagadas()).toEqual([chaveDe(atleta)])
    })

    it('sem foto → 204 sem chamar o R2 (idempotente)', async () => {
      const resposta = await (await como(await usuario())).removerFoto()
      expect(resposta.status).toBe(204)
      expect(armazenamento.s3.send).not.toHaveBeenCalled()
    })
  })

  describe('PUT /me/senha', () => {
    const TROCA = { senhaAtual: SENHA, novaSenha: NOVA_SENHA }
    const entrar = (email: string, senha: string) =>
      request(contexto.http).post('/api/v1/auth/login').send({ email, senha })
    const renovar = (refreshToken: string) =>
      request(contexto.http).post('/api/v1/auth/refresh').send({ refreshToken })

    it('troca, mantém a sessão atual e revoga as outras com evento só delas (critério 12)', async () => {
      const atleta = await usuario()
      const atual = await abrirSessao(atleta)
      const outra = await abrirSessao(atleta)
      const api = await como(atleta, { id: atual.sessaoId })

      const resposta = await api.alterarSenha(TROCA)
      await aguardarOuvintes()

      expect(resposta.status).toBe(204)
      expect((await api.obter()).status).toBe(200)
      expect((await renovar(atual.refreshToken)).status).toBe(200)
      const revogada = await renovar(outra.refreshToken)
      expect(revogada.status).toBe(401)
      expect(erro(revogada).code).toBe('SESSAO_REVOGADA')
      expect(
        await prismaTeste.sessao.findUniqueOrThrow({ where: { id: outra.sessaoId } }),
      ).toMatchObject({ motivoRevogacao: 'TROCA_SENHA' })
      expect(eventos.emitidos()).toEqual([
        {
          nome: 'usuario.sessaoEncerrada',
          payload: {
            usuarioId: atleta.id,
            sessaoIds: [outra.sessaoId],
            motivo: 'TROCA_SENHA',
            autorId: atleta.id,
          },
        },
      ])
      expect((await entrar(atleta.email, NOVA_SENHA)).status).toBe(200)
      expect((await entrar(atleta.email, SENHA)).status).toBe(401)
    })

    it('sem outras sessões: nenhum evento', async () => {
      const atleta = await usuario()
      expect((await (await como(atleta)).alterarSenha(TROCA)).status).toBe(204)
      await aguardarOuvintes()
      expect(eventos.nomes()).not.toContain('usuario.sessaoEncerrada')
    })

    it('senha atual errada → 400 SENHA_INCORRETA no campo e nada muda (critério 13)', async () => {
      const atleta = await usuario()
      const outra = await abrirSessao(atleta)
      const resposta = await (
        await como(atleta)
      ).alterarSenha({ ...TROCA, senhaAtual: 'errada123' })

      expect(resposta.status).toBe(400)
      expect(erro(resposta).code).toBe('SENHA_INCORRETA')
      expect(erro(resposta).details).toEqual([
        { field: 'senhaAtual', message: 'Senha atual incorreta.' },
      ])
      expect((await renovar(outra.refreshToken)).status).toBe(200)
      expect((await entrar(atleta.email, SENHA)).status).toBe(200)
    })

    it('6ª senha atual errada em 15 min → 429 (critério 14)', async () => {
      const atleta = await usuario()
      const api = await como(atleta)
      for (let tentativa = 0; tentativa < 5; tentativa++) {
        expect((await api.alterarSenha({ ...TROCA, senhaAtual: 'errada123' })).status).toBe(400)
      }
      const bloqueada = await api.alterarSenha(TROCA)
      expect(bloqueada.status).toBe(429)
      expect(erro(bloqueada).code).toBe('RATE_LIMITED')
      expect(bloqueada.headers['retry-after']).toBeDefined()
    })

    it('nova igual à atual → 400 SENHA_IGUAL_ATUAL (critério 15)', async () => {
      const resposta = await (
        await como(await usuario())
      ).alterarSenha({ senhaAtual: SENHA, novaSenha: SENHA })
      expect(resposta.status).toBe(400)
      expect(erro(resposta).code).toBe('SENHA_IGUAL_ATUAL')
    })

    it('nova senha fraca → 400 VALIDATION_ERROR', async () => {
      const resposta = await (
        await como(await usuario())
      ).alterarSenha({ senhaAtual: SENHA, novaSenha: 'curta1' })
      expect(resposta.status).toBe(400)
      expect(erro(resposta).code).toBe('VALIDATION_ERROR')
      expect(erro(resposta).details[0]?.field).toBe('novaSenha')
    })
  })
})
