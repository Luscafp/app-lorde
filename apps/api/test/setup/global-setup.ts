import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
import './env'

const RAIZ_API = join(__dirname, '..', '..')

/** Erro do globalSetup: aborta a execução antes de tocar no banco. */
export class ErroGlobalSetup extends Error {
  override readonly name = 'ErroGlobalSetup'
}

/**
 * Proteção contra apagar o banco de desenvolvimento: os testes aplicam migrations e truncam
 * todas as tabelas, então só rodam em banco cujo nome termina em `_test`.
 * Devolve o nome do banco; a mensagem de erro nunca inclui a senha da URL.
 */
export function garantirBancoDeTeste(url: string | undefined): string {
  if (!url) throw new ErroGlobalSetup('DATABASE_URL não definida para os testes de integração.')

  let banco: string
  try {
    banco = decodeURIComponent(new URL(url).pathname.slice(1))
  } catch {
    throw new ErroGlobalSetup('DATABASE_URL inválida para os testes de integração.')
  }
  if (!banco.endsWith('_test')) {
    throw new ErroGlobalSetup(
      `Testes de integração recusados: o banco "${banco}" não termina em "_test". ` +
        'Os testes apagam todos os dados; aponte DATABASE_URL para o Postgres de testes ' +
        '(ex.: postgresql://atletica:atletica@localhost:5433/atletica_test, `pnpm db:up`).',
    )
  }
  return banco
}

/** `globalSetup` do projeto `integration`: aplica as migrations como no deploy (#4). */
export default function globalSetup(): void {
  garantirBancoDeTeste(process.env.DATABASE_URL)
  try {
    execFileSync(
      process.execPath,
      [require.resolve('prisma/build/index.js'), 'migrate', 'deploy'],
      {
        cwd: RAIZ_API,
        env: process.env,
        stdio: 'pipe',
      },
    )
  } catch (erro) {
    const { stdout, stderr } = erro as { stdout?: Buffer; stderr?: Buffer }
    const detalhe = `${stdout?.toString() ?? ''}${stderr?.toString() ?? ''}`.trim()
    throw new ErroGlobalSetup(
      `Falha ao aplicar as migrations no banco de teste (o Postgres de testes está no ar? ` +
        `\`pnpm db:up\`).\n${detalhe}`,
    )
  }
}
