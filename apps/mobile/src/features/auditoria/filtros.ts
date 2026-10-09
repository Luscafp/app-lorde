import {
  AcaoAuditoria,
  dataLocalValida,
  EntidadeAuditoria,
  formatarDataLocal,
  hojeLocal,
  rotuloAcao,
  rotuloEntidade,
  somarDias,
  type FiltrosAuditoria,
} from '@atletica/shared'
import { z } from 'zod'

export const PERIODOS = ['7', '30', '90', 'PERSONALIZADO'] as const
export type PeriodoAuditoria = (typeof PERIODOS)[number]
export const PERIODO_PADRAO: PeriodoAuditoria = '30'

export const ROTULO_PERIODO: Readonly<Record<PeriodoAuditoria, string>> = {
  '7': '7 dias',
  '30': '30 dias',
  '90': '90 dias',
  PERSONALIZADO: 'Personalizado',
}

export type FiltrosTela = {
  entidade?: EntidadeAuditoria
  entidadeId?: string
  usuarioId?: string
  usuarioNome?: string
  acao?: AcaoAuditoria
  periodo: PeriodoAuditoria
  /** `aaaa-mm-dd`, só no período personalizado. */
  de?: string
  ate?: string
}

/** Search params da rota: os atalhos de usuário e evento abrem a lista já filtrada. */
export type ParametrosAuditoria = { [Chave in keyof FiltrosTela]?: string }

export const FILTROS_PADRAO: FiltrosTela = { periodo: PERIODO_PADRAO }

const entidadeSchema = z.enum(Object.values(EntidadeAuditoria))
const acaoSchema = z.enum(Object.values(AcaoAuditoria))
const idSchema = z.uuid()
const periodoSchema = z.enum(PERIODOS)

function dataValida(data: string | undefined): string | undefined {
  return data && dataLocalValida(data) ? data : undefined
}

/** Parâmetro inválido (deep link antigo, digitado) vale como "sem filtro". */
export function lerParametros(parametros: ParametrosAuditoria): FiltrosTela {
  const entidade = entidadeSchema.safeParse(parametros.entidade).data
  const usuarioId = idSchema.safeParse(parametros.usuarioId).data
  const de = dataValida(parametros.de)
  const periodoLido = periodoSchema.safeParse(parametros.periodo).data ?? PERIODO_PADRAO
  const personalizado = periodoLido === 'PERSONALIZADO' && !!de
  const periodo = periodoLido === 'PERSONALIZADO' && !de ? PERIODO_PADRAO : periodoLido
  return {
    entidade,
    entidadeId: entidade ? idSchema.safeParse(parametros.entidadeId).data : undefined,
    usuarioId,
    usuarioNome: usuarioId ? parametros.usuarioNome : undefined,
    acao: acaoSchema.safeParse(parametros.acao).data,
    periodo,
    de: personalizado ? de : undefined,
    ate: personalizado ? dataValida(parametros.ate) : undefined,
  }
}

/** Toda chave presente: `undefined` remove o parâmetro da rota. */
export function paraParametros(filtros: FiltrosTela): ParametrosAuditoria {
  const { entidade, entidadeId, usuarioId, usuarioNome, acao, periodo, de, ate } = filtros
  return { entidade, entidadeId, usuarioId, usuarioNome, acao, periodo, de, ate }
}

/** Atalhos contam o dia de hoje: "7 dias" = hoje e os 6 anteriores. Os limites do dia são da API. */
export function paraConsulta(filtros: FiltrosTela, hoje = hojeLocal()): FiltrosAuditoria {
  const { entidade, entidadeId, usuarioId, acao, periodo } = filtros
  const limites =
    periodo === 'PERSONALIZADO'
      ? { de: filtros.de, ate: filtros.ate }
      : { de: somarDias(hoje, 1 - Number(periodo)), ate: undefined }
  return { entidade, entidadeId, usuarioId, acao, ...limites }
}

/** `"01/09/2026"` → `"2026-09-01"`; `null` se incompleta ou inexistente. */
export function dataDigitadaParaIso(texto: string): string | null {
  const [, dia, mes, ano] = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(texto) ?? []
  if (!dia || !mes || !ano) return null
  return dataValida(`${ano}-${mes}-${dia}`) ?? null
}

export function isoParaDataDigitada(data: string | undefined): string {
  return data ? formatarDataLocal(data) : ''
}

export type ChaveFiltro = 'entidade' | 'entidadeId' | 'usuarioId' | 'acao' | 'periodo'

export type FiltroAtivo = { chave: ChaveFiltro; rotulo: string }

/** O período padrão (30 dias) não vira chip. */
export function filtrosAtivos(filtros: FiltrosTela): FiltroAtivo[] {
  const ativos: FiltroAtivo[] = []
  if (filtros.entidade) ativos.push({ chave: 'entidade', rotulo: rotuloEntidade(filtros.entidade) })
  if (filtros.entidadeId) ativos.push({ chave: 'entidadeId', rotulo: 'Registro específico' })
  if (filtros.usuarioId) {
    ativos.push({ chave: 'usuarioId', rotulo: `Autor: ${filtros.usuarioNome ?? 'selecionado'}` })
  }
  if (filtros.acao) ativos.push({ chave: 'acao', rotulo: rotuloAcao(filtros.acao) })
  if (filtros.periodo === 'PERSONALIZADO') {
    const fim = filtros.ate ? formatarDataLocal(filtros.ate) : 'hoje'
    ativos.push({ chave: 'periodo', rotulo: `${isoParaDataDigitada(filtros.de)} a ${fim}` })
  } else if (filtros.periodo !== PERIODO_PADRAO) {
    ativos.push({ chave: 'periodo', rotulo: `Últimos ${ROTULO_PERIODO[filtros.periodo]}` })
  }
  return ativos
}

export function removerFiltro(filtros: FiltrosTela, chave: ChaveFiltro): FiltrosTela {
  switch (chave) {
    case 'entidade':
      return { ...filtros, entidade: undefined, entidadeId: undefined }
    case 'usuarioId':
      return { ...filtros, usuarioId: undefined, usuarioNome: undefined }
    case 'periodo':
      return { ...filtros, periodo: PERIODO_PADRAO, de: undefined, ate: undefined }
    default:
      return { ...filtros, [chave]: undefined }
  }
}
