import 'dotenv/config'
import { defineConfig } from 'prisma/config'

// Prisma 7: a conexão sai do schema e fica aqui. `DATABASE_URL` vem do `.env` (ou do ambiente
// na CI/deploy). Lida sem `env()` para que `prisma generate` funcione sem banco configurado;
// os comandos de migration falham com mensagem clara se ela faltar.
// `SHADOW_DATABASE_URL` (opcional) é o banco sombra exigido pelo
// `migrate diff --from-migrations` (job `prisma` da CI, #41); no Prisma 7 não há mais a flag
// `--shadow-database-url`.
// O comando de seed (`migrations.seed`) é acrescentado pela #45.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: {
    url: process.env.DATABASE_URL,
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL,
  },
})
