# Scripts de backup e restauração (#47)

Usados pelos workflows `backup-db.yml` e `restore-test.yml` e pelo runbook de restauração (`docs/runbooks/restauracao-banco.md`). Precisam de `bash`, `pg_dump`/`pg_restore`/`psql` da mesma major do servidor (16) e `age`.

| Script            | Faz                                                                                                                                         | Variáveis                                                                                                                                  |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `backup.sh`       | `pg_dump --format=custom --no-owner --no-acl` direto para o `age` (o dump aberto não toca o disco); falha se o arquivo tiver menos de 10 kB | `DATABASE_URL`, `AGE_PUBLIC_KEY`, `TAMANHO_MINIMO_BYTES` (opc.)                                                                            |
| `restaurar.sh`    | descriptografa um `.dump.age` direto para o `pg_restore --no-owner --no-acl --exit-on-error` (o dump aberto não toca o disco)               | `DATABASE_URL` (destino, vazio), `AGE_PRIVATE_KEY`                                                                                         |
| `sanidade.sh`     | última migration aplicada em `_prisma_migrations`; `"Atletica"` e `"Usuario"` com registros                                                 | `DATABASE_URL`, `MIGRATION_ESPERADA` (opc.; padrão: a mais nova do repositório; o `restore-test.yml` passa a do último deploy de produção) |
| `testar-local.sh` | teste de ponta a ponta sem R2 (abaixo)                                                                                                      | `DATABASE_URL` (banco com migrations e seed)                                                                                               |

```bash
scripts/backup/backup.sh atletica-prod /tmp   # imprime /tmp/atletica-prod-2026-10-04T0600Z.dump.age
scripts/backup/restaurar.sh /tmp/atletica-prod-2026-10-04T0600Z.dump.age
scripts/backup/sanidade.sh
```

## Teste local

`testar-local.sh` gera um par de chaves `age` descartável, cria e apaga os bancos `backup_teste_restaurado` e `backup_teste_vazio` no mesmo servidor e verifica:

1. o backup gera só o `.dump.age` (sem dump aberto no disco);
2. `pg_restore` direto do `.dump.age` falha;
3. o backup descriptografado é restaurado num banco vazio e as consultas de sanidade passam;
4. o backup de um banco vazio (arquivo < 10 kB) termina com código ≠ 0.

Contra o Postgres do compose, com as ferramentas num contêiner (a imagem `postgres:16` já traz o cliente; falta o `age`):

```bash
pnpm db:up
pnpm --filter @atletica/shared build
pnpm --filter api prisma:deploy
SEED_ADMIN_EMAIL=admin@exemplo.com.br SEED_ADMIN_NOME="Admin" SEED_ADMIN_SENHA='Senha-Teste-123' \
  pnpm --filter api prisma:seed

printf 'FROM postgres:16\nRUN apt-get update -qq && apt-get install -y -qq age\n' |
  docker build -t atletica-backup-ferramentas -
docker run --rm -v "$PWD:/repo" -w /repo \
  -e DATABASE_URL=postgresql://atletica:atletica@host.docker.internal:5432/atletica_dev \
  atletica-backup-ferramentas scripts/backup/testar-local.sh
```

No Linux, acrescente `--add-host=host.docker.internal:host-gateway` ao `docker run`. A saída termina com `ok: todos os testes passaram`.
