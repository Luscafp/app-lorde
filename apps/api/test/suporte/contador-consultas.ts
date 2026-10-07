interface ModuloPg {
  Client: { prototype: { query: (...args: unknown[]) => unknown } }
}

/** O mesmo `pg` que o `@prisma/adapter-pg` carrega: cada chamada é um comando SQL enviado. */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pg = require(
  require.resolve('pg', { paths: [require.resolve('@prisma/adapter-pg')] }),
) as ModuloPg

/** Número de comandos SQL enviados ao Postgres enquanto `acao` roda. */
export async function contarConsultas(acao: () => Promise<unknown>): Promise<number> {
  const espiao = jest.spyOn(pg.Client.prototype, 'query')
  try {
    await acao()
    return espiao.mock.calls.length
  } finally {
    espiao.mockRestore()
  }
}
