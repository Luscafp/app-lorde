import * as shared from '@atletica/shared'
import * as prisma from '../../generated/prisma/enums'

/**
 * Paridade dos enums de domínio entre o shared e o Prisma (épico #3, critério 15).
 * As asserções de tipo quebram o `pnpm typecheck` se um valor existir só de um lado;
 * o teste em tempo de execução cobre o mesmo pelo `pnpm test`.
 */
type Igual<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false

function afirmarIgual<_T extends true>(): void {}

afirmarIgual<Igual<shared.Papel, prisma.Papel>>()
afirmarIgual<Igual<shared.TipoEvento, prisma.TipoEvento>>()
afirmarIgual<Igual<shared.StatusEvento, prisma.StatusEvento>>()
afirmarIgual<Igual<shared.Resultado, prisma.Resultado>>()
afirmarIgual<Igual<shared.StatusSolicitacao, prisma.StatusSolicitacao>>()
afirmarIgual<Igual<shared.StatusNoticia, prisma.StatusNoticia>>()

afirmarIgual<Igual<typeof shared.Papel, typeof prisma.Papel>>()
afirmarIgual<Igual<typeof shared.TipoEvento, typeof prisma.TipoEvento>>()
afirmarIgual<Igual<typeof shared.StatusEvento, typeof prisma.StatusEvento>>()
afirmarIgual<Igual<typeof shared.Resultado, typeof prisma.Resultado>>()
afirmarIgual<Igual<typeof shared.StatusSolicitacao, typeof prisma.StatusSolicitacao>>()
afirmarIgual<Igual<typeof shared.StatusNoticia, typeof prisma.StatusNoticia>>()

describe('paridade de enums shared ↔ Prisma', () => {
  it.each([
    ['Papel', shared.Papel, prisma.Papel],
    ['TipoEvento', shared.TipoEvento, prisma.TipoEvento],
    ['StatusEvento', shared.StatusEvento, prisma.StatusEvento],
    ['Resultado', shared.Resultado, prisma.Resultado],
    ['StatusSolicitacao', shared.StatusSolicitacao, prisma.StatusSolicitacao],
    ['StatusNoticia', shared.StatusNoticia, prisma.StatusNoticia],
  ])('%s tem os mesmos valores', (_nome, doShared, doPrisma) => {
    expect(doShared).toEqual(doPrisma)
  })
})
