/** Categoria da notificação; o app a recebe em `data.tipo` (épico #36 §7). */
export type CategoriaNotificacao =
  | 'NOVOS_EVENTOS'
  | 'ALTERACOES_EVENTOS'
  | 'LEMBRETES'
  | 'RESULTADOS'
  | 'NOTICIAS'
  | 'SOLICITACOES'
  | 'AVISOS'
  | 'CARGO'
