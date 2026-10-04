// Enums com paridade ao Prisma: objeto `as const` + tipo união (convenções §3).
// Toda mudança aqui exige a mesma mudança no schema.prisma (e vice-versa): o teste de paridade
// (apps/api/src/infra/prisma/paridade-enums.spec.ts) quebra o `pnpm typecheck`.
export * from './evento'
export * from './noticia'
export * from './papel'
export * from './solicitacao'
