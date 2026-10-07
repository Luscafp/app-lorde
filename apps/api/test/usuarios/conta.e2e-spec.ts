import { DeleteObjectCommand } from '@aws-sdk/client-s3'
import { TERMOS_VERSAO } from '@atletica/shared'
import { Logger } from '@nestjs/common'
import request from 'supertest'
import type { RespostaErro } from '../../src/common/erros/erro-negocio'
import { TransacaoService } from '../../src/infra/eventos/apos-commit'
import { SenhaService } from '../../src/infra/senha/senha.service'
import { AtleticaPadraoService } from '../../src/modules/atleticas/atletica-padrao.service'
import { SessaoService } from '../../src/modules/auth/sessao.service'
import { aguardarOuvintes, espiarEventos, type EspiaoEventos } from '../eventos'
import { criarAtletica } from '../fabricas/atletica'
import { tokenPara } from '../fabricas/auth'
import { criarEvento, criarTreino } from '../fabricas/eventos'
import { adicionarMembro, criarTime } from '../fabricas/times'
import {
  comandosEnviados,
  simularArmazenamento,
  type ArmazenamentoSimulado,
} from '../fabricas/uploads'
import { criarUsuario, type DadosUsuario, type UsuarioCriado } from '../fabricas/usuario'
import { criarApp, type AppDeTeste } from '../setup/criar-app'
import { prismaTeste } from '../setup/prisma-teste'

const ROTA = '/api/v1/me/conta'
const SENHA = 'lorde2026'
const DIA_MS = 24 * 60 * 60 * 1000
const erro = (resposta: { body: unknown }) => resposta.body as RespostaErro

describe('Exclusão de conta DELETE /me/conta (#12)', () => {
  let contexto: AppDeTeste
  let armazenamento: ArmazenamentoSimulado
  let padraoId: string
  let eventos: EspiaoEventos
  let senhaHash: string

  const usuario = (dados: DadosUsuario = {}) =>
    criarUsuario({ atleticaId: padraoId, senhaHash, ...dados })

  async function abrirSessao(alvo: UsuarioCriado, atleticaId = padraoId) {
    return contexto.app
      .get(TransacaoService)
      .executar((tx) =>
        contexto.app.get(SessaoService).criar(tx, { usuarioId: alvo.id, atleticaId }),
      )
  }

  async function excluir(alvo: UsuarioCriado, senha = SENHA, sessao?: { id: string }) {
    const token = await tokenPara(alvo, { sessao })
    return request(contexto.http)
      .delete(ROTA)
      .set('Authorization', `Bearer ${token}`)
      .send({ senha })
  }

  const entrar = (email: string, senha = SENHA) =>
    request(contexto.http).post('/api/v1/auth/login').send({ email, senha })
  const renovar = (refreshToken: string) =>
    request(contexto.http).post('/api/v1/auth/refresh').send({ refreshToken })
  const contaDe = (alvo: UsuarioCriado) =>
    prismaTeste.usuario.findUniqueOrThrow({ where: { id: alvo.id } })
  const vinculosDe = (alvo: UsuarioCriado) =>
    prismaTeste.vinculoAtletica.findMany({ where: { usuarioId: alvo.id } })
  const auditoria = (acao: string) =>
    prismaTeste.registroAuditoria.findMany({ where: { acao }, orderBy: { criadoEm: 'asc' } })
  const eventosEncerramento = async () => {
    await aguardarOuvintes()
    return eventos.emitidos().filter(({ nome }) => nome === 'usuario.sessaoEncerrada')
  }

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

  it('sem token → 401 (critério 15)', async () => {
    const resposta = await request(contexto.http).delete(ROTA).send({ senha: SENHA })
    expect(resposta.status).toBe(401)
    expect(erro(resposta).code).toBe('UNAUTHENTICATED')
  })

  it('corpo inválido → 400 VALIDATION_ERROR', async () => {
    const resposta = await excluir(await usuario(), '')
    expect(resposta.status).toBe(400)
    expect(erro(resposta).code).toBe('VALIDATION_ERROR')
  })

  describe('caminho feliz (critério 1)', () => {
    it('anonimiza, sai dos elencos, cancela pendentes e preserva o histórico', async () => {
      const atleta = await usuario({ nome: 'Ana Souza', email: 'ana@ex.com' })
      const fotoKey = `usuarios/${atleta.id}/perfil/2b7f5c1e-0d4a-4f8e-9b3c-7a6d5e4f3a21.jpg`
      await prismaTeste.usuario.update({
        where: { id: atleta.id },
        data: { fotoKey, emailVerificado: true },
      })
      const futsal = await criarTime({ atleticaId: padraoId, capitaoId: atleta.id })
      const volei = await criarTime({ atleticaId: padraoId })
      const basquete = await criarTime({ atleticaId: padraoId })
      await adicionarMembro(futsal, atleta)
      await adicionarMembro(volei, atleta)
      const pendente = await prismaTeste.solicitacaoEntrada.create({
        data: { atleticaId: padraoId, timeId: basquete.id, usuarioId: atleta.id },
      })
      const futuro = await criarTreino({
        atleticaId: padraoId,
        timeId: futsal.id,
        participantes: [{ usuarioId: atleta.id, confirmado: true }],
      })
      for (let dias = 1; dias <= 3; dias++) {
        await criarEvento({
          atleticaId: padraoId,
          timeId: volei.id,
          inicio: new Date(Date.now() - dias * DIA_MS),
          status: 'FINALIZADO',
          participantes: [{ usuarioId: atleta.id, confirmado: true, presente: true }],
        })
      }
      await prismaTeste.codigoVerificacao.create({
        data: {
          usuarioId: atleta.id,
          tipo: 'VERIFICAR_EMAIL',
          codigoHash: 'hash',
          expiraEm: new Date(Date.now() + DIA_MS),
        },
      })
      await prismaTeste.preferenciaNotificacao.create({ data: { usuarioId: atleta.id } })
      await prismaTeste.dispositivoPush.create({
        data: { usuarioId: atleta.id, tokenPush: 'ExponentPushToken[ana]', plataforma: 'android' },
      })
      await prismaTeste.aceiteTermos.create({
        data: { usuarioId: atleta.id, versao: TERMOS_VERSAO },
      })
      await prismaTeste.tentativaAcesso.createMany({
        data: [
          { tipo: 'LOGIN_FALHA', chave: 'ana@ex.com|10.0.0.1' },
          { tipo: 'RECUPERACAO_ENVIO', chave: 'ana@ex.com' },
          { tipo: 'LOGIN_FALHA', chave: 'mariana@ex.com|10.0.0.1' },
        ],
      })
      const atual = await abrirSessao(atleta)
      const outra = await abrirSessao(atleta)

      const resposta = await excluir(atleta, SENHA, { id: atual.sessaoId })
      await aguardarOuvintes()

      expect(resposta.status).toBe(204)
      const conta = await contaDe(atleta)
      expect(conta).toMatchObject({
        nome: 'Usuário excluído',
        email: `excluido+${atleta.id}@anonimo.invalid`,
        fotoKey: null,
        emailVerificado: false,
        ativo: false,
      })
      expect(conta.excluidoEm).toBeInstanceOf(Date)
      expect(await contexto.app.get(SenhaService).verificar(conta.senhaHash, SENHA)).toBe(false)
      expect(await vinculosDe(atleta)).toEqual([
        expect.objectContaining({ papel: 'ATLETA', ativo: false }),
      ])

      const membros = await prismaTeste.membroTime.findMany({ where: { usuarioId: atleta.id } })
      expect(membros).toHaveLength(2)
      expect(membros.every(({ saidaEm }) => saidaEm !== null)).toBe(true)
      expect(await auditoria('MEMBRO_REMOVIDO_EXCLUSAO_CONTA')).toHaveLength(2)
      expect(
        (await prismaTeste.time.findUniqueOrThrow({ where: { id: futsal.id } })).capitaoId,
      ).toBeNull()

      expect(
        await prismaTeste.solicitacaoEntrada.findUniqueOrThrow({ where: { id: pendente.id } }),
      ).toMatchObject({ status: 'CANCELADA', canceladaEm: expect.any(Date) as Date })
      expect(await prismaTeste.participacao.count({ where: { eventoId: futuro.id } })).toBe(0)
      expect(
        await prismaTeste.participacao.count({ where: { usuarioId: atleta.id, presente: true } }),
      ).toBe(3)

      const sessoes = await prismaTeste.sessao.findMany({ where: { usuarioId: atleta.id } })
      expect(sessoes).toHaveLength(2)
      expect(sessoes.every(({ motivoRevogacao }) => motivoRevogacao === 'CONTA_EXCLUIDA')).toBe(
        true,
      )
      expect(await prismaTeste.codigoVerificacao.count({ where: { usuarioId: atleta.id } })).toBe(0)
      expect(
        await prismaTeste.preferenciaNotificacao.count({ where: { usuarioId: atleta.id } }),
      ).toBe(0)
      expect(await prismaTeste.dispositivoPush.count({ where: { usuarioId: atleta.id } })).toBe(0)
      expect(await prismaTeste.aceiteTermos.count({ where: { usuarioId: atleta.id } })).toBe(1)
      expect(await prismaTeste.tentativaAcesso.findMany({ select: { chave: true } })).toEqual([
        { chave: 'mariana@ex.com|10.0.0.1' },
      ])

      const [registro, ...outros] = await auditoria('CONTA_EXCLUIDA')
      expect(outros).toEqual([])
      expect(registro).toMatchObject({
        atleticaId: padraoId,
        entidade: 'Usuario',
        entidadeId: atleta.id,
        usuarioId: atleta.id,
        dados: {
          antes: { papel: 'ATLETA' },
          depois: null,
          contexto: { timeIds: expect.arrayContaining([futsal.id, volei.id]) as string[] },
        },
      })
      const texto = JSON.stringify(registro?.dados)
      expect(texto).not.toContain('Ana Souza')
      expect(texto).not.toContain('ana@ex.com')
      expect(texto).not.toContain(fotoKey)

      expect(await eventosEncerramento()).toEqual([
        {
          nome: 'usuario.sessaoEncerrada',
          payload: {
            usuarioId: atleta.id,
            sessaoIds: expect.arrayContaining([atual.sessaoId, outra.sessaoId]) as string[],
            motivo: 'CONTA_EXCLUIDA',
            autorId: atleta.id,
          },
        },
      ])
      expect(
        comandosEnviados(armazenamento.s3.send, DeleteObjectCommand).map(({ input }) => input.Key),
      ).toEqual([fotoKey])
    })

    it('depois: login, refresh e GET /me → 401; o e-mail pode ser recadastrado (critérios 2–4)', async () => {
      const atleta = await usuario({ email: 'ana@ex.com' })
      const outra = await abrirSessao(atleta)
      const token = await tokenPara(atleta)

      const resposta = await request(contexto.http)
        .delete(ROTA)
        .set('Authorization', `Bearer ${token}`)
        .send({ senha: SENHA })
      expect(resposta.status).toBe(204)

      const login = await entrar('ana@ex.com')
      expect(login.status).toBe(401)
      expect(erro(login).code).toBe('CREDENCIAIS_INVALIDAS')
      const refresh = await renovar(outra.refreshToken)
      expect(refresh.status).toBe(401)
      expect(erro(refresh).code).toBe('SESSAO_REVOGADA')
      const me = await request(contexto.http)
        .get('/api/v1/me')
        .set('Authorization', `Bearer ${token}`)
      expect(me.status).toBe(401)

      const cadastro = await request(contexto.http).post('/api/v1/auth/cadastro').send({
        nome: 'Ana Nova',
        email: 'ana@ex.com',
        senha: 'outraSenha1',
        aceiteTermos: true,
        versaoTermos: TERMOS_VERSAO,
      })
      expect(cadastro.status).toBe(201)
      const nova = await prismaTeste.usuario.findUniqueOrThrow({ where: { email: 'ana@ex.com' } })
      expect(nova.id).not.toBe(atleta.id)
    })

    it('contas de várias atléticas: sai de todas, um CONTA_EXCLUIDA por atlética', async () => {
      const atleta = await usuario({ papel: 'DIRETOR' })
      const outraAtletica = await criarAtletica()
      await prismaTeste.vinculoAtletica.create({
        data: { usuarioId: atleta.id, atleticaId: outraAtletica.id, papel: 'PRESIDENTE' },
      })
      const timeLorde = await criarTime({ atleticaId: padraoId })
      const timeOutra = await criarTime({ atleticaId: outraAtletica.id, capitaoId: atleta.id })
      await adicionarMembro(timeLorde, atleta)
      await adicionarMembro(timeOutra, atleta)
      const pendenteOutra = await prismaTeste.solicitacaoEntrada.create({
        data: {
          atleticaId: outraAtletica.id,
          timeId: (await criarTime({ atleticaId: outraAtletica.id })).id,
          usuarioId: atleta.id,
        },
      })

      expect((await excluir(atleta)).status).toBe(204)

      expect(await vinculosDe(atleta)).toEqual([
        expect.objectContaining({ papel: 'ATLETA', ativo: false }),
        expect.objectContaining({ papel: 'ATLETA', ativo: false }),
      ])
      expect(
        await prismaTeste.membroTime.count({ where: { usuarioId: atleta.id, saidaEm: null } }),
      ).toBe(0)
      expect(
        (await prismaTeste.time.findUniqueOrThrow({ where: { id: timeOutra.id } })).capitaoId,
      ).toBeNull()
      expect(
        (
          await prismaTeste.solicitacaoEntrada.findUniqueOrThrow({
            where: { id: pendenteOutra.id },
          })
        ).status,
      ).toBe('CANCELADA')
      const registros = await auditoria('CONTA_EXCLUIDA')
      expect(registros.map(({ atleticaId }) => atleticaId).sort()).toEqual(
        [padraoId, outraAtletica.id].sort(),
      )
      expect(registros.find(({ atleticaId }) => atleticaId === outraAtletica.id)?.dados).toEqual({
        antes: { papel: 'PRESIDENTE' },
        depois: null,
        contexto: { timeIds: [timeOutra.id] },
      })
    })

    it('Presidente: o cargo fica livre para o Administrador designar outro (critério 11)', async () => {
      const presidente = await usuario({ papel: 'PRESIDENTE' })
      const admin = await usuario({ papel: 'ADMINISTRADOR' })
      const sucessor = await usuario({ papel: 'DIRETOR' })

      expect((await excluir(presidente)).status).toBe(204)
      expect(await vinculosDe(presidente)).toEqual([
        expect.objectContaining({ papel: 'ATLETA', ativo: false }),
      ])

      const designacao = await request(contexto.http)
        .put(`/api/v1/usuarios/${sucessor.id}/papel`)
        .set('Authorization', `Bearer ${await tokenPara(admin)}`)
        .send({ papel: 'PRESIDENTE' })
      expect(designacao.status).toBe(200)
    })

    it('falha ao apagar a foto no R2 não desfaz a exclusão (critério 12)', async () => {
      const atleta = await usuario()
      await prismaTeste.usuario.update({
        where: { id: atleta.id },
        data: { fotoKey: `usuarios/${atleta.id}/perfil/2b7f5c1e-0d4a-4f8e-9b3c-7a6d5e4f3a21.jpg` },
      })
      armazenamento.s3.send.mockRejectedValueOnce(new Error('R2 fora do ar'))
      const logError = jest.spyOn(Logger.prototype, 'error')

      const resposta = await excluir(atleta)
      await aguardarOuvintes()

      expect(resposta.status).toBe(204)
      expect(comandosEnviados(armazenamento.s3.send, DeleteObjectCommand)).toHaveLength(1)
      expect(await contaDe(atleta)).toMatchObject({ fotoKey: null, ativo: false })
      expect(logError).toHaveBeenCalledWith(
        expect.objectContaining({ usuarioId: atleta.id }),
        'Falha ao remover a foto da conta excluída',
      )
      logError.mockRestore()
    })

    it('Diretoria vê "Usuário excluído" sem o e-mail original nem foto (critério 14)', async () => {
      const atleta = await usuario({ nome: 'Ana Souza', email: 'ana@ex.com' })
      await prismaTeste.usuario.update({
        where: { id: atleta.id },
        data: { fotoKey: `usuarios/${atleta.id}/perfil/2b7f5c1e-0d4a-4f8e-9b3c-7a6d5e4f3a21.jpg` },
      })
      const tokenPresidente = await tokenPara(await usuario({ papel: 'PRESIDENTE' }))
      expect((await excluir(atleta)).status).toBe(204)
      await aguardarOuvintes()

      const resposta = await request(contexto.http)
        .get(`/api/v1/usuarios/${atleta.id}`)
        .set('Authorization', `Bearer ${tokenPresidente}`)

      expect(resposta.status).toBe(200)
      expect(resposta.body).toMatchObject({
        nome: 'Usuário excluído',
        fotoUrl: null,
        situacao: 'EXCLUIDO',
        times: [],
      })
      expect(JSON.stringify(resposta.body)).not.toContain('ana@ex.com')
    })
  })

  describe('recusas', () => {
    it('senha errada → 400 SENHA_INCORRETA no campo e nada muda (critério 5)', async () => {
      const atleta = await usuario()
      const time = await criarTime({ atleticaId: padraoId })
      await adicionarMembro(time, atleta)
      const outra = await abrirSessao(atleta)

      const resposta = await excluir(atleta, 'errada123')

      expect(resposta.status).toBe(400)
      expect(erro(resposta)).toMatchObject({
        code: 'SENHA_INCORRETA',
        message: 'Senha incorreta.',
        details: [{ field: 'senha', message: 'Senha incorreta.' }],
      })
      expect(await contaDe(atleta)).toMatchObject({
        nome: atleta.nome,
        ativo: true,
        excluidoEm: null,
      })
      expect(await prismaTeste.membroTime.count({ where: { saidaEm: null } })).toBe(1)
      expect((await renovar(outra.refreshToken)).status).toBe(200)
      expect(await eventosEncerramento()).toEqual([])
    })

    it('6ª tentativa após 5 senhas erradas em 15 min → 429, mesmo correta (critério 6)', async () => {
      const atleta = await usuario()
      for (let tentativa = 0; tentativa < 5; tentativa++) {
        expect((await excluir(atleta, 'errada123')).status).toBe(400)
      }

      const bloqueada = await excluir(atleta)

      expect(bloqueada.status).toBe(429)
      expect(erro(bloqueada).code).toBe('RATE_LIMITED')
      expect(bloqueada.headers['retry-after']).toBeDefined()
      expect((await contaDe(atleta)).excluidoEm).toBeNull()
    })

    it('único Administrador ativo → 409 ULTIMO_ADMINISTRADOR e nada muda (critério 7)', async () => {
      const admin = await usuario({ papel: 'ADMINISTRADOR' })
      await usuario({ papel: 'ADMINISTRADOR', vinculoAtivo: false })
      const time = await criarTime({ atleticaId: padraoId, capitaoId: admin.id })
      await adicionarMembro(time, admin)
      const outra = await abrirSessao(admin)

      const resposta = await excluir(admin)

      expect(resposta.status).toBe(409)
      expect(erro(resposta)).toMatchObject({
        code: 'ULTIMO_ADMINISTRADOR',
        message:
          'Você é o único Administrador. Conceda o cargo a outra pessoa antes de excluir sua conta.',
      })
      expect(await contaDe(admin)).toMatchObject({ ativo: true, excluidoEm: null })
      expect(await vinculosDe(admin)).toEqual([
        expect.objectContaining({ papel: 'ADMINISTRADOR', ativo: true }),
      ])
      expect(await prismaTeste.membroTime.count({ where: { saidaEm: null } })).toBe(1)
      expect((await prismaTeste.time.findUniqueOrThrow({ where: { id: time.id } })).capitaoId).toBe(
        admin.id,
      )
      expect((await renovar(outra.refreshToken)).status).toBe(200)
      expect(await prismaTeste.registroAuditoria.count()).toBe(0)
      expect(await eventosEncerramento()).toEqual([])
    })

    it('com outro Administrador ativo → 204 e resta um (critério 8)', async () => {
      const admin = await usuario({ papel: 'ADMINISTRADOR' })
      await usuario({ papel: 'ADMINISTRADOR' })

      expect((await excluir(admin)).status).toBe(204)
      expect(
        await prismaTeste.vinculoAtletica.count({
          where: { atleticaId: padraoId, papel: 'ADMINISTRADOR', ativo: true },
        }),
      ).toBe(1)
    })

    it('dois Administradores excluindo ao mesmo tempo: um conclui, o outro 409 (critério 9)', async () => {
      const a = await usuario({ papel: 'ADMINISTRADOR' })
      const b = await usuario({ papel: 'ADMINISTRADOR' })

      const respostas = await Promise.all([excluir(a), excluir(b)])

      expect(respostas.map(({ status }) => status).sort()).toEqual([204, 409])
      const recusa = respostas.find(({ status }) => status === 409)
      expect(recusa && erro(recusa).code).toBe('ULTIMO_ADMINISTRADOR')
      expect(
        await prismaTeste.vinculoAtletica.count({
          where: { atleticaId: padraoId, papel: 'ADMINISTRADOR', ativo: true },
        }),
      ).toBe(1)
    })
  })
})
