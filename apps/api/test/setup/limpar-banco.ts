import { prismaTeste } from './prisma-teste'

let tabelas: string[] | undefined

/**
 * Tabelas do schema `public`, exceto `_prisma_migrations`, lidas uma vez por arquivo de teste.
 * O cache vale porque as migrations só rodam no `globalSetup`, antes de qualquer teste: nenhum
 * teste pode criar ou remover tabelas.
 */
export async function listarTabelas(): Promise<string[]> {
  tabelas ??= (
    await prismaTeste.$queryRaw<{ tablename: string }[]>`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
      ORDER BY tablename`
  ).map(({ tablename }) => tablename)
  return tabelas
}

/**
 * Esvazia o banco de teste (épico #2 §14, estratégia (a)): `TRUNCATE ... RESTART IDENTITY CASCADE`
 * em todas as tabelas, preservando o histórico de migrations. Já roda no `beforeEach` de todo
 * teste de integração (test/setup/integracao.ts); chame direto só para limpar no meio de um teste.
 */
export async function limparBanco(): Promise<void> {
  const lista = await listarTabelas()
  if (lista.length === 0) return
  const nomes = lista.map((tabela) => `"public"."${tabela.replaceAll('"', '""')}"`).join(', ')
  await prismaTeste.$executeRawUnsafe(`TRUNCATE TABLE ${nomes} RESTART IDENTITY CASCADE`)
}

/**
 * Apaga os jobs do schema `pgboss` (filas e crons registrados ficam), já chamado no `beforeEach`
 * de todo teste de integração; o `limparBanco()` só trunca o `public`.
 */
export async function limparFilas(): Promise<void> {
  await prismaTeste.$executeRaw`
    DO $$ BEGIN
      IF to_regclass('pgboss.job') IS NOT NULL THEN DELETE FROM pgboss.job; END IF;
    END $$`
}
