import { Injectable, Logger } from '@nestjs/common'
import type { AcaoDaEntidade, EntidadeAuditoria } from '@atletica/shared'
import { ContextoAtletica } from '../../infra/contexto/contexto-atletica.service'
import { ErroAtleticaContextoAusente } from '../../infra/contexto/erros'
import type { TransacaoComEscopo } from '../../infra/prisma/prisma.service'
import type { Prisma } from '../../generated/prisma/client'
import { ErroAuditoria } from './erros'
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

export const TAMANHO_MAXIMO_DADOS = 16 * 1024
export const LIMITE_POR_LOTE = 500

/** Entidades em que `nome` é dado de domínio, não de pessoa. */
const NOME_DE_DOMINIO: ReadonlySet<EntidadeAuditoria> = new Set(['Modalidade', 'Atletica', 'Time'])

/** Alteração com diferença vazia não grava (§7); criação e exclusão sempre gravam. */
function semMudanca({ antes, depois }: DadosAuditoria): boolean {
  return (
    antes !== null &&
    depois !== null &&
    Object.keys(antes).length === 0 &&
    Object.keys(depois).length === 0
  )
}

/** Único meio de gravar `RegistroAuditoria`, sempre na transação da alteração (convenções §7). */
@Injectable()
export class AuditoriaService {
  private readonly logger = new Logger(AuditoriaService.name)

  constructor(private readonly contexto: ContextoAtletica) {}

  async registrar(tx: TransacaoComEscopo, entrada: EntradaAuditoria): Promise<void> {
    await this.registrarVarios(tx, [entrada])
  }

  async registrarVarios(tx: TransacaoComEscopo, entradas: EntradaAuditoria[]): Promise<void> {
    const registros = entradas.flatMap((entrada) => this.montar(entrada) ?? [])
    for (let i = 0; i < registros.length; i += LIMITE_POR_LOTE) {
      await tx.registroAuditoria.createMany({ data: registros.slice(i, i + LIMITE_POR_LOTE) })
    }
  }

  private montar(entrada: EntradaAuditoria): Prisma.RegistroAuditoriaCreateManyInput | null {
    const atleticaId = this.contexto.atleticaId()
    if (!atleticaId) throw new ErroAtleticaContextoAusente('RegistroAuditoria', 'createMany')
    const usuarioId = this.ator(entrada)
    const dados = this.sanitizar(entrada)
    if (semMudanca(dados)) return null

    return {
      atleticaId,
      usuarioId,
      acao: entrada.acao,
      entidade: entrada.entidade,
      entidadeId: entrada.entidadeId,
      dados: this.serializar(entrada.acao, dados),
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

  private sanitizar({ acao, entidade, dados }: EntradaAuditoria): DadosAuditoria {
    const { valor, removidos } = sanitizar(dados, NOME_DE_DOMINIO.has(entidade))
    if (removidos.length > 0) {
      this.logger.warn({ acao, entidade, removidos }, 'Campos proibidos removidos da auditoria')
    }
    return valor
  }

  private serializar(acao: string, dados: DadosAuditoria): Prisma.InputJsonObject {
    const json = JSON.stringify(dados)
    if (Buffer.byteLength(json) > TAMANHO_MAXIMO_DADOS) {
      throw new ErroAuditoria(
        `${acao}: dados da auditoria acima de ${TAMANHO_MAXIMO_DADOS} bytes. ` +
          'Registre indicadores (ex.: { conteudoAlterado: true }) em vez de textos longos.',
      )
    }
    return JSON.parse(json) as Prisma.InputJsonObject
  }
}
