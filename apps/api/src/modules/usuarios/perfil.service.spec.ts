import { ErroLimiteExcedido, type ErroNegocio } from '../../common/erros/erro-negocio'
import type { TransacaoService } from '../../infra/eventos/apos-commit'
import type { EventosDominioService } from '../../infra/eventos/eventos-dominio.service'
import type { PrismaService } from '../../infra/prisma/prisma.service'
import type { SenhaService } from '../../infra/senha/senha.service'
import type { RateLimitService } from '../auth/rate-limit.service'
import type { SessaoService } from '../auth/sessao.service'
import type { UploadsService } from '../uploads/uploads.service'
import { ConfirmacaoSenhaService } from './confirmacao-senha.service'
import { montarPerfil, PerfilService, type DadosPerfil } from './perfil.service'

const callbacksAposCommit: (() => unknown)[] = []

jest.mock('../../infra/eventos/apos-commit', () => ({
  aposCommit: (callback: () => unknown) => callbacksAposCommit.push(callback),
}))

const ID = '6b0e2a52-8e5d-4a43-9d6c-1f0f3c2b7a90'
const ATLETICA_ID = '1f2a3b4c-5d6e-4f70-8a9b-0c1d2e3f4a5b'
const SESSAO_ID = '0d9c8b7a-6f5e-4d3c-8b2a-1f0e9d8c7b6a'
const SOLICITANTE = { id: ID, atleticaId: ATLETICA_ID, sessaoId: SESSAO_ID }
const CHAVE_ATUAL = `usuarios/${ID}/perfil/atual.jpg`
const CHAVE_NOVA = `usuarios/${ID}/perfil/nova.jpg`

function dados(parcial: Partial<DadosPerfil> = {}): DadosPerfil {
  return {
    id: ID,
    nome: 'Ana Souza',
    email: 'ana@exemplo.com',
    fotoKey: null,
    emailVerificado: false,
    criadoEm: new Date('2026-10-02T12:00:00.000Z'),
    vinculos: [{ papel: 'DIRETOR', atletica: { id: ATLETICA_ID, nome: 'Lorde', sigla: 'LORDE' } }],
    membrosTime: [],
    aceitesTermos: [],
    ...parcial,
  }
}

function time(nome: string, capitaoId: string | null) {
  return {
    entradaEm: new Date('2026-08-02T13:00:00.000Z'),
    time: {
      id: `${nome}-id`,
      nome,
      ativo: true,
      capitaoId,
      modalidade: { id: 'm', nome: 'Futsal', icone: 'futsal' },
    },
  }
}

function criarServico({ fotoKey = null as string | null, senhaConfere = true } = {}) {
  const tx = { usuario: { update: jest.fn() } }
  const db = {
    usuario: {
      findUnique: jest.fn().mockResolvedValue({ ...dados(), fotoKey, senhaHash: 'hash-atual' }),
      update: jest.fn(),
    },
  }
  const transacao = { executar: jest.fn((fn: (t: typeof tx) => Promise<unknown>) => fn(tx)) }
  const uploads = {
    urlPublica: jest.fn((key: string | null) => key && `https://img/${key}`),
    validarKey: jest.fn(),
    remover: jest.fn(),
  }
  const senhas = {
    verificar: jest.fn().mockResolvedValue(senhaConfere),
    hash: jest.fn().mockResolvedValue('hash-novo'),
  }
  const limites = { verificar: jest.fn().mockResolvedValue(5), registrar: jest.fn() }
  const sessoes = { revogarTodas: jest.fn().mockResolvedValue(['outra-sessao']) }
  const eventos = { emitirAposCommit: jest.fn() }
  const prisma = { db } as unknown as PrismaService
  const servico = new PerfilService(
    prisma,
    transacao as unknown as TransacaoService,
    uploads as unknown as UploadsService,
    senhas as unknown as SenhaService,
    new ConfirmacaoSenhaService(
      prisma,
      senhas as unknown as SenhaService,
      limites as unknown as RateLimitService,
    ),
    sessoes as unknown as SessaoService,
    eventos as unknown as EventosDominioService,
  )
  return { servico, db, tx, uploads, senhas, limites, sessoes, eventos }
}

async function codigoDoErro(promessa: Promise<unknown>): Promise<string> {
  try {
    await promessa
  } catch (erro) {
    return (erro as ErroNegocio).code
  }
  throw new Error('esperava erro')
}

beforeEach(() => {
  callbacksAposCommit.length = 0
})

describe('montarPerfil', () => {
  it('marca o capitão, converte datas e usa o papel do vínculo', () => {
    const perfil = montarPerfil(
      dados({
        membrosTime: [time('Futsal Masculino', ID), time('Vôlei Misto', 'outro')],
        aceitesTermos: [{ versao: '2026-10-01', aceitoEm: new Date('2026-10-02T12:00:00.000Z') }],
      }),
      'https://img/foto.jpg',
    )

    expect(perfil).toMatchObject({
      papel: 'DIRETOR',
      fotoUrl: 'https://img/foto.jpg',
      atletica: { id: ATLETICA_ID, nome: 'Lorde', sigla: 'LORDE' },
      termosAceitos: { versao: '2026-10-01', aceitoEm: '2026-10-02T12:00:00.000Z' },
      criadoEm: '2026-10-02T12:00:00.000Z',
    })
    expect(perfil.times).toEqual([
      {
        id: 'Futsal Masculino-id',
        nome: 'Futsal Masculino',
        modalidade: { id: 'm', nome: 'Futsal', icone: 'futsal' },
        capitao: true,
        ativo: true,
        entradaEm: '2026-08-02T13:00:00.000Z',
      },
      expect.objectContaining({ nome: 'Vôlei Misto', capitao: false }),
    ])
    expect(perfil).not.toHaveProperty('fotoKey')
  })

  it('sem aceite de termos → termosAceitos null', () => {
    expect(montarPerfil(dados(), null).termosAceitos).toBeNull()
  })

  it('sem vínculo com a atlética do token → 401', async () => {
    expect(
      await codigoDoErro(Promise.resolve().then(() => montarPerfil(dados({ vinculos: [] }), null))),
    ).toBe('UNAUTHENTICATED')
  })
})

describe('PerfilService', () => {
  describe('obter', () => {
    it('filtra na consulta vínculos encerrados e a atlética do token', async () => {
      const { servico, db } = criarServico()
      await servico.obter(SOLICITANTE)

      const [[consulta]] = db.usuario.findUnique.mock.calls as [[{ select: object }]]
      expect(consulta).toMatchObject({
        where: { id: ID },
        select: {
          vinculos: { where: { atleticaId: ATLETICA_ID } },
          membrosTime: {
            where: { atleticaId: ATLETICA_ID, saidaEm: null },
            orderBy: { time: { nome: 'asc' } },
          },
          aceitesTermos: { orderBy: { aceitoEm: 'desc' }, take: 1 },
        },
      })
      expect(consulta.select).not.toHaveProperty('senhaHash')
    })

    it('usuário inexistente → 401', async () => {
      const { servico, db } = criarServico()
      db.usuario.findUnique.mockResolvedValue(null)
      expect(await codigoDoErro(servico.obter(SOLICITANTE))).toBe('UNAUTHENTICATED')
    })
  })

  it('atualizar grava o nome e devolve o perfil relido', async () => {
    const { servico, db } = criarServico()
    const perfil = await servico.atualizar(SOLICITANTE, { nome: 'Ana Souza' })
    expect(db.usuario.update).toHaveBeenCalledWith({
      where: { id: ID },
      data: { nome: 'Ana Souza' },
    })
    expect(perfil.nome).toBe('Ana Souza')
  })

  describe('atualizarFoto', () => {
    it('valida a chave nova, grava e remove a anterior só depois do commit', async () => {
      const { servico, tx, uploads } = criarServico({ fotoKey: CHAVE_ATUAL })

      const resposta = await servico.atualizarFoto(SOLICITANTE, CHAVE_NOVA)

      expect(resposta).toEqual({ fotoUrl: `https://img/${CHAVE_NOVA}` })
      expect(uploads.validarKey).toHaveBeenCalledWith({
        key: CHAVE_NOVA,
        finalidade: 'PERFIL',
        usuarioId: ID,
        atleticaId: ATLETICA_ID,
      })
      expect(tx.usuario.update).toHaveBeenCalledWith({
        where: { id: ID },
        data: { fotoKey: CHAVE_NOVA },
      })
      expect(uploads.remover).not.toHaveBeenCalled()
      await Promise.all(callbacksAposCommit.map((callback) => callback()))
      expect(uploads.remover).toHaveBeenCalledWith(CHAVE_ATUAL)
    })

    it('chave igual à gravada → 200 sem revalidar nem gravar', async () => {
      const { servico, tx, uploads } = criarServico({ fotoKey: CHAVE_ATUAL })
      await servico.atualizarFoto(SOLICITANTE, CHAVE_ATUAL)
      expect(uploads.validarKey).not.toHaveBeenCalled()
      expect(tx.usuario.update).not.toHaveBeenCalled()
    })

    it('chave inválida → erro do validarKey e nada gravado', async () => {
      const { servico, tx, uploads } = criarServico()
      uploads.validarKey.mockRejectedValue({ code: 'UPLOAD_INVALIDO' })
      expect(await codigoDoErro(servico.atualizarFoto(SOLICITANTE, CHAVE_NOVA))).toBe(
        'UPLOAD_INVALIDO',
      )
      expect(tx.usuario.update).not.toHaveBeenCalled()
    })

    it('sem foto anterior não agenda remoção', async () => {
      const { servico } = criarServico()
      await servico.atualizarFoto(SOLICITANTE, CHAVE_NOVA)
      expect(callbacksAposCommit).toHaveLength(0)
    })
  })

  describe('removerFoto', () => {
    it('zera a chave e remove o objeto após o commit', async () => {
      const { servico, tx, uploads } = criarServico({ fotoKey: CHAVE_ATUAL })
      await servico.removerFoto(SOLICITANTE)
      expect(tx.usuario.update).toHaveBeenCalledWith({ where: { id: ID }, data: { fotoKey: null } })
      await Promise.all(callbacksAposCommit.map((callback) => callback()))
      expect(uploads.remover).toHaveBeenCalledWith(CHAVE_ATUAL)
    })

    it('sem foto: nada muda', async () => {
      const { servico, tx } = criarServico()
      await servico.removerFoto(SOLICITANTE)
      expect(tx.usuario.update).not.toHaveBeenCalled()
    })
  })

  describe('alterarSenha', () => {
    const SENHAS = { senhaAtual: 'lorde2026', novaSenha: 'novaSenha9' }

    it('troca o hash e revoga as outras sessões, preservando a atual', async () => {
      const { servico, tx, sessoes, eventos } = criarServico()
      await servico.alterarSenha(SOLICITANTE, SENHAS)

      expect(tx.usuario.update).toHaveBeenCalledWith({
        where: { id: ID },
        data: { senhaHash: 'hash-novo' },
      })
      expect(sessoes.revogarTodas).toHaveBeenCalledWith(tx, ID, 'TROCA_SENHA', {
        exceto: SESSAO_ID,
      })
      expect(eventos.emitirAposCommit).toHaveBeenCalledWith('usuario.sessaoEncerrada', {
        usuarioId: ID,
        sessaoIds: ['outra-sessao'],
        motivo: 'TROCA_SENHA',
        autorId: ID,
      })
    })

    it('sem outras sessões: nenhum evento', async () => {
      const { servico, sessoes, eventos } = criarServico()
      sessoes.revogarTodas.mockResolvedValue([])
      await servico.alterarSenha(SOLICITANTE, SENHAS)
      expect(eventos.emitirAposCommit).not.toHaveBeenCalled()
    })

    it('senha atual errada → SENHA_INCORRETA, registra a falha e nada muda', async () => {
      const { servico, tx, limites } = criarServico({ senhaConfere: false })
      expect(await codigoDoErro(servico.alterarSenha(SOLICITANTE, SENHAS))).toBe('SENHA_INCORRETA')
      expect(limites.registrar).toHaveBeenCalledWith('SENHA_CONFIRMACAO_FALHA', ID)
      expect(tx.usuario.update).not.toHaveBeenCalled()
    })

    it('nova igual à atual → SENHA_IGUAL_ATUAL sem contar falha', async () => {
      const { servico, tx, limites } = criarServico()
      const igual = { senhaAtual: 'lorde2026', novaSenha: 'lorde2026' }
      expect(await codigoDoErro(servico.alterarSenha(SOLICITANTE, igual))).toBe('SENHA_IGUAL_ATUAL')
      expect(limites.registrar).not.toHaveBeenCalled()
      expect(tx.usuario.update).not.toHaveBeenCalled()
    })

    it('limite atingido → 429 antes de conferir a senha', async () => {
      const { servico, limites, senhas } = criarServico()
      limites.verificar.mockRejectedValue(new ErroLimiteExcedido(60))
      expect(await codigoDoErro(servico.alterarSenha(SOLICITANTE, SENHAS))).toBe('RATE_LIMITED')
      expect(senhas.verificar).not.toHaveBeenCalled()
    })
  })
})
