import type { CategoriaNotificacao, Preferencias } from '@atletica/shared'

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
