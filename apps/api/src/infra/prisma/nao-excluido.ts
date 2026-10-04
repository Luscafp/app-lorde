/**
 * Filtro de exclusão lógica, aplicado explicitamente pelos services (a extensão não o aplica —
 * épico #3 §14). Só `Evento`, `Noticia` e `Usuario` têm `excluidoEm` (convenções §11.4).
 *
 * @example prisma.db.evento.findMany({ where: { ...naoExcluido, timeId } })
 */
export const naoExcluido = { excluidoEm: null } as const
