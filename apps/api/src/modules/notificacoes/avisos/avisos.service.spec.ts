import type { EnviarAviso } from '@atletica/shared'
import { ErroLimiteExcedido, type ErroNegocio } from '../../../common/erros/erro-negocio'
import type { TransacaoService } from '../../../infra/eventos/apos-commit'
import type { PrismaService } from '../../../infra/prisma/prisma.service'
import type { AuditoriaService } from '../../auditoria/auditoria.service'
import type { RateLimitService } from '../../auth/rate-limit.service'
import type { DestinatariosService } from '../destinatarios.service'
import type { NotificacoesService } from '../notificacoes.service'
import { AvisosService, LIMITE_AVISOS } from './avisos.service'

const ATLETICA = 'a1a1a1a1-0000-4000-8000-000000000001'
const OUTRA = 'a2a2a2a2-0000-4000-8000-000000000002'
const TIME = 'b1b1b1b1-0000-4000-8000-000000000001'
const DIRETOR = { id: 'c9c9c9c9-0000-4000-8000-000000000009', atleticaId: ATLETICA }
const TEXTO = { titulo: 'Treino cancelado hoje', mensagem: 'Por causa da chuva, sem treino.' }
const PARA_TODOS: EnviarAviso = { destino: 'TODOS', ...TEXTO }
const PARA_TIME: EnviarAviso = { destino: 'TIME', timeId: TIME, ...TEXTO }

interface Cenario {
  time?: { atleticaId: string; ativo: boolean } | null
  elegiveis?: number
}

function criarServico({
  time = { atleticaId: ATLETICA, ativo: true },
  elegiveis = 2,
}: Cenario = {}) {
  const ordem: string[] = []
  const tx = {}
  const db = { time: { findUnique: jest.fn().mockResolvedValue(time) } }
  const transacao = { executar: jest.fn((fn: (t: object) => Promise<unknown>) => fn(tx)) }
  const auditoria = { registrar: jest.fn(() => ordem.push('auditoria')) }
  const limites = { consumir: jest.fn().mockResolvedValue(9) }
  const destinatarios = {
    todosDaAtletica: jest.fn().mockResolvedValue(['u1', 'u2', 'u3']),
    elencoDoTime: jest.fn().mockResolvedValue(['u1', 'u2']),
  }
  const notificacoes = {
    contarElegiveis: jest.fn().mockResolvedValue(elegiveis),
    notificar: jest.fn(() => {
      ordem.push('notificar')
      return Promise.resolve({ destinatarios: elegiveis })
    }),
  }
  const servico = new AvisosService(
    { db } as unknown as PrismaService,
    transacao as unknown as TransacaoService,
    auditoria as unknown as AuditoriaService,
    limites as unknown as RateLimitService,
    destinatarios as unknown as DestinatariosService,
    notificacoes as unknown as NotificacoesService,
  )
  return { servico, auditoria, limites, destinatarios, notificacoes, ordem }
}

async function codigoDe(promessa: Promise<unknown>): Promise<string> {
  const erro = (await promessa.then(
    () => {
      throw new Error('esperava erro')
    },
    (e: unknown) => e,
  )) as ErroNegocio
  return `${erro.statusCode} ${erro.code}`
}

describe('AvisosService', () => {
  describe('destinatários', () => {
    it('TODOS: vínculos ativos da atlética', async () => {
      const { servico, destinatarios, notificacoes } = criarServico()
      await servico.enviar(DIRETOR, PARA_TODOS)
      expect(destinatarios.todosDaAtletica).toHaveBeenCalledWith(ATLETICA)
      expect(notificacoes.notificar).toHaveBeenCalledWith(
        expect.objectContaining({ usuarioIds: ['u1', 'u2', 'u3'], categoria: 'AVISOS' }),
      )
    })

    it('TIME: elenco atual do time', async () => {
      const { servico, destinatarios, notificacoes } = criarServico()
      await servico.enviar(DIRETOR, PARA_TIME)
      expect(destinatarios.elencoDoTime).toHaveBeenCalledWith(TIME)
      expect(notificacoes.notificar).toHaveBeenCalledWith(
        expect.objectContaining({ usuarioIds: ['u1', 'u2'] }),
      )
    })

    it.each([
      ['inexistente ou de outra atlética', null, '404 NOT_FOUND'],
      ['adversário', { atleticaId: OUTRA, ativo: true }, '422 TIME_INVALIDO_AVISO'],
      ['inativo', { atleticaId: ATLETICA, ativo: false }, '422 TIME_INVALIDO_AVISO'],
    ])('time %s → %s, sem consumir o limite', async (_, time, codigo) => {
      const { servico, limites, auditoria } = criarServico({ time })
      expect(await codigoDe(servico.enviar(DIRETOR, PARA_TIME))).toBe(codigo)
      expect(await codigoDe(servico.alcance(DIRETOR, { destino: 'TIME', timeId: TIME }))).toBe(
        codigo,
      )
      expect(limites.consumir).not.toHaveBeenCalled()
      expect(auditoria.registrar).not.toHaveBeenCalled()
    })
  })

  describe('enviar', () => {
    it('audita antes de enfileirar, com a contagem de elegíveis', async () => {
      const { servico, auditoria, ordem } = criarServico({ elegiveis: 7 })
      const resposta = await servico.enviar(DIRETOR, PARA_TIME)

      expect(ordem).toEqual(['auditoria', 'notificar'])
      expect(resposta).toEqual({
        avisoId: expect.any(String) as string,
        destinatarios: 7,
        enviadoEm: expect.any(String) as string,
      })
      expect(auditoria.registrar).toHaveBeenCalledWith(expect.anything(), {
        acao: 'AVISO_ENVIADO',
        entidade: 'Aviso',
        entidadeId: resposta.avisoId,
        dados: {
          antes: null,
          depois: { ...TEXTO, destino: 'TIME', timeId: TIME, destinatarios: 7 },
        },
      })
    })

    it('chave de idempotência e rota: TODOS abre a Home; TIME abre o time', async () => {
      const { servico, notificacoes } = criarServico()
      const todos = await servico.enviar(DIRETOR, PARA_TODOS)
      const time = await servico.enviar(DIRETOR, PARA_TIME)

      expect(notificacoes.notificar.mock.calls).toEqual([
        [
          expect.objectContaining({
            titulo: TEXTO.titulo,
            corpo: TEXTO.mensagem,
            url: '/',
            chave: `aviso:${todos.avisoId}`,
          }),
        ],
        [expect.objectContaining({ url: `/times/${TIME}`, chave: `aviso:${time.avisoId}` })],
      ])
      expect(todos.avisoId).not.toBe(time.avisoId)
    })

    it('TODOS grava timeId nulo na auditoria', async () => {
      const { servico, auditoria } = criarServico()
      await servico.enviar(DIRETOR, PARA_TODOS)
      expect(auditoria.registrar).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          dados: expect.objectContaining({
            depois: expect.objectContaining({ destino: 'TODOS', timeId: null }) as object,
          }) as object,
        }),
      )
    })

    it('limite de 10 por hora por remetente, chave atlética:usuário', async () => {
      const { servico, limites } = criarServico()
      await servico.enviar(DIRETOR, PARA_TODOS)
      expect(limites.consumir).toHaveBeenCalledWith(
        'AVISO_ENVIO',
        `${ATLETICA}:${DIRETOR.id}`,
        LIMITE_AVISOS,
      )
      expect(LIMITE_AVISOS).toEqual({ maximo: 10, janelaMs: 3_600_000 })
    })

    it('limite excedido: nada auditado nem enfileirado', async () => {
      const { servico, limites, auditoria, notificacoes } = criarServico()
      limites.consumir.mockRejectedValue(new ErroLimiteExcedido(60))
      expect(await codigoDe(servico.enviar(DIRETOR, PARA_TODOS))).toBe('429 RATE_LIMITED')
      expect(auditoria.registrar).not.toHaveBeenCalled()
      expect(notificacoes.notificar).not.toHaveBeenCalled()
    })

    it('falha na auditoria: nada enfileirado', async () => {
      const { servico, auditoria, notificacoes } = criarServico()
      auditoria.registrar.mockImplementation(() => {
        throw new Error('falhou')
      })
      await expect(servico.enviar(DIRETOR, PARA_TODOS)).rejects.toThrow('falhou')
      expect(notificacoes.notificar).not.toHaveBeenCalled()
    })
  })

  it('alcance: mesma contagem de elegíveis, sem consumir o limite', async () => {
    const { servico, limites, notificacoes } = criarServico({ elegiveis: 142 })
    expect(await servico.alcance(DIRETOR, { destino: 'TODOS' })).toEqual({ destinatarios: 142 })
    expect(notificacoes.contarElegiveis).toHaveBeenCalledWith({
      atleticaId: ATLETICA,
      categoria: 'AVISOS',
      usuarioIds: ['u1', 'u2', 'u3'],
    })
    expect(limites.consumir).not.toHaveBeenCalled()
  })
})
