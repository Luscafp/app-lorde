import { execFile } from 'node:child_process'
import { dirname, join } from 'node:path'
import { promisify } from 'node:util'

const RAIZ = join(__dirname, '..', '..', '..', '..', '..')
const ESLINT = join(
  dirname(require.resolve('eslint/package.json', { paths: [RAIZ] })),
  'bin',
  'eslint.js',
)

/** Regra `no-restricted-syntax` efetiva para o caminho (o arquivo não precisa existir). */
async function regraPara(arquivo: string): Promise<unknown> {
  const { stdout } = await promisify(execFile)(
    process.execPath,
    [ESLINT, '--print-config', arquivo],
    {
      cwd: RAIZ,
    },
  )
  return (JSON.parse(stdout) as { rules?: Record<string, unknown> }).rules?.['no-restricted-syntax']
}

/** Regra de lint do `prisma.semEscopo` (convenções §3; épico #3 §7, #44). */
describe('regra de lint do prisma.semEscopo', () => {
  it('proíbe semEscopo fora dos caminhos permitidos e libera nos permitidos', async () => {
    const proibidos = [
      'apps/api/src/modules/eventos/eventos.service.ts',
      'apps/api/src/modules/usuarios/usuarios.service.ts',
      'apps/api/test/eventos/eventos.e2e-spec.ts',
    ]
    const permitidos = [
      'apps/api/src/modules/auth/auth.service.ts',
      'apps/api/src/modules/auth/sessao/sessao.service.ts',
      'apps/api/src/modules/usuarios/conta.service.ts',
      'apps/api/src/modules/health/health.controller.ts',
      'apps/api/src/infra/prisma/prisma.service.ts',
      'apps/api/prisma/seed.ts',
    ]
    const regras = await Promise.all([...proibidos, ...permitidos].map(regraPara))

    for (const regra of regras.slice(0, proibidos.length)) {
      expect(regra).toEqual(
        expect.arrayContaining([
          2,
          expect.objectContaining({ selector: "MemberExpression[property.name='semEscopo']" }),
        ]),
      )
    }
    for (const regra of regras.slice(proibidos.length)) expect(regra).toBeUndefined()
  }, 60_000)
})
