import type { Preferencias } from '@atletica/shared'

export type CategoriaNotificacao =
  | 'NOVOS_EVENTOS'
  | 'ALTERACOES_EVENTOS'
  | 'LEMBRETES'
  | 'RESULTADOS'
  | 'NOTICIAS'
  | 'SOLICITACOES'
  | 'AVISOS'
  | 'CARGO'

type ColunaPreferencia = Exclude<keyof Preferencias, 'pushAtivo' | 'antecedenciaLembreteHoras'>

/** Único mapeamento categoria → coluna de `PreferenciaNotificacao`; `CARGO` não tem (RN35). */
export const COLUNA_PREFERENCIA: Readonly<
  Record<Exclude<CategoriaNotificacao, 'CARGO'>, ColunaPreferencia>
> = {
  NOVOS_EVENTOS: 'novosEventos',
  ALTERACOES_EVENTOS: 'alteracoesEventos',
  LEMBRETES: 'lembretes',
  RESULTADOS: 'resultados',
  NOTICIAS: 'noticias',
  SOLICITACOES: 'solicitacoes',
  AVISOS: 'avisos',
}
