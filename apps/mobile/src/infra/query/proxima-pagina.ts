type Pagina = { page: number; limit: number; total: number }

/** `getNextPageParam` das listas paginadas pela API. */
export const proximaPagina = ({ page, limit, total }: Pagina) =>
  page * limit < total ? page + 1 : undefined
