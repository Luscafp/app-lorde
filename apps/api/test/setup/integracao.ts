import { limparBanco, limparFilas } from './limpar-banco'
import { prismaTeste } from './prisma-teste'

// `setupFilesAfterEnv` do projeto `integration`: todo teste começa com o banco vazio (épico #2,
// critério 5). Sem transação por teste: os services abrem as próprias transações (épico #2 §14).
beforeEach(async () => {
  await limparBanco()
  await limparFilas()
})

afterAll(async () => {
  await prismaTeste.$disconnect()
})
