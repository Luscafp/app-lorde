import { Injectable, Logger } from '@nestjs/common'
import type { AcaoDaEntidade, EntidadeAuditoria } from '@atletica/shared'
import { ContextoAtletica } from '../../infra/contexto/contexto-atletica.service'
import { ErroAtleticaContextoAusente } from '../../infra/contexto/erros'
import type { TransacaoComEscopo } from '../../infra/prisma/prisma.service'
import type { Prisma } from '../../generated/prisma/client'
import { sanitizar } from './sanitizar'

type Campos = Record<string, unknown>

/** `{ antes, depois, contexto? }`: criação → `antes: null`; exclusão → `depois: null` (§7). */
export interface DadosAuditoria {
  antes: Campos | null
  depois: Campos | null
  contexto?: Campos
}

/** Só aceita combinações `entidade` × `acao` do catálogo (`ACOES_POR_ENTIDADE`). */
export type EntradaAuditoria = {
  [E in EntidadeAuditoria]: {
    entidade: E
    acao: AcaoDaEntidade<E>
    entidadeId: string
    dados: DadosAuditoria
    /** Padrão: ator do contexto. `null` explícito só para ações do sistema (jobs). */
    usuarioId?: string | null
  }
}[EntidadeAuditoria]

/** Uso incorreto do `AuditoriaService`. Bug de programação: vira 500. */
export class ErroAuditoria extends Error {
  override readonly name = 'ErroAuditoria'
}

export const TAMANHO_MAXIMO_DADOS = 16 * 1024
export const LIMITE_POR_LOTE = 500

/** Entidades em que `nome` é dado de domínio, não de pessoa. */
const NOME_DE_DOMINIO: ReadonlySet<EntidadeAuditoria> = new Set(['Modalidade', 'Atletica', 'Time'])
const PERMITE_NOME: ReadonlySet<string> = new Set(['nome'])

/** Único meio de gravar `RegistroAuditoria`, sempre na transação da alteração (convenções §7). */
@Injectable()
export class AuditoriaService {
  private readonly logger = new Logger(AuditoriaService.name)

  constructor(private readonly contexto: ContextoAtletica) {}

  async registrar(tx: TransacaoComEscopo, entrada: EntradaAuditoria): Promise<void> {
    await this.registrarVarios(tx, [entrada])
  }

  async registrarVarios(tx: TransacaoComEscopo, entradas: EntradaAuditoria[]): Promise<void> {
    if (entradas.length === 0) return
    const registros = entradas.map((entrada) => this.montar(entrada))
    for (let i = 0; i < registros.length; i += LIMITE_POR_LOTE) {
      await tx.registroAuditoria.createMany({ data: registros.slice(i, i + LIMITE_POR_LOTE) })
    }
  }

  private montar(entrada: EntradaAuditoria): Prisma.RegistroAuditoriaCreateManyInput {
    const atleticaId = this.contexto.atleticaId()
    if (!atleticaId) throw new ErroAtleticaContextoAusente('RegistroAuditoria', 'createMany')

    return {
      atleticaId,
      usuarioId: this.ator(entrada),
      acao: entrada.acao,
      entidade: entrada.entidade,
      entidadeId: entrada.entidadeId,
      dados: this.serializar(entrada),
      requestId: this.contexto.requestId() ?? null,
    }
  }

  private ator(entrada: EntradaAuditoria): string | null {
    if (entrada.usuarioId !== undefined) return entrada.usuarioId
    const usuarioId = this.contexto.usuarioId()
    if (!usuarioId) {
      throw new ErroAuditoria(
        `${entrada.acao} sem ator: sem usuário no contexto, informe usuarioId: null (ação do sistema).`,
      )
    }
    return usuarioId
  }

  private serializar(entrada: EntradaAuditoria): Prisma.InputJsonObject {
    const permitidos = NOME_DE_DOMINIO.has(entrada.entidade) ? PERMITE_NOME : undefined
    const { valor, removidos } = sanitizar(entrada.dados, permitidos)
    if (removidos.length > 0) {
      this.logger.warn(
        { acao: entrada.acao, entidade: entrada.entidade, removidos },
        'Campos proibidos removidos da auditoria',
      )
    }

    const json = JSON.stringify(valor)
    if (Buffer.byteLength(json) > TAMANHO_MAXIMO_DADOS) {
      throw new ErroAuditoria(
        `${entrada.acao}: dados da auditoria acima de ${TAMANHO_MAXIMO_DADOS} bytes. ` +
          'Registre indicadores (ex.: { conteudoAlterado: true }) em vez de textos longos.',
      )
    }
    return JSON.parse(json) as Prisma.InputJsonObject
  }
}
