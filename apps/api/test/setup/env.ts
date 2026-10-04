import { join } from 'node:path'
import { config } from 'dotenv'

// Env dos testes, carregado pelo `setupFiles` do Jest e pelo `globalSetup`. Precedência: variáveis
// já definidas (CI) > `.env.test` (local, fora do Git) > `.env.test.example` (versionado).
// O `.env` de desenvolvimento é ignorado quando NODE_ENV=test (config.module.ts).
const raiz = join(__dirname, '..', '..')
config({ path: [join(raiz, '.env.test'), join(raiz, '.env.test.example')], quiet: true })
process.env.NODE_ENV = 'test'
