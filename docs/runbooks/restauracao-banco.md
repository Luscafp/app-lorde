# Runbook — restauração do banco de produção

**Meta (RNF10):** RTO de **4 horas** (do início do incidente à API respondendo com o banco restaurado) e RPO de 24 horas (backup diário às 03:00).

O teste automático mensal (`restore-test.yml`, dia 1º) garante que o backup mais recente é legível e restaurável. Este runbook é a parte manual: restaurar de verdade em produção e registrar cada teste.

## Quando usar

Perda ou corrupção de dados em produção (migration destrutiva, exclusão indevida, falha do provedor). Para um problema só de código, reverta o deploy; não restaure o banco.

## 0. Declarar o incidente (até 15 min)

- Avise a diretoria: "O aplicativo está indisponível para recuperação de dados. Previsão: até 4 horas. Dados registrados depois de <horário do backup> podem precisar ser lançados de novo."
- Anote o horário de início (conta para o RTO) e quem conduz a restauração.

## 1. Escolher a cópia (até 30 min)

| Cópia                                                | Quando usar                                                                                      |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Backup do provedor (_Postgres → Backups_ na Railway) | Railway disponível e o backup é anterior ao problema: restaure pelo painel e pule para o passo 4 |
| `pg_dump` no R2 (`atletica-backups/prod/`)           | Railway sem o backup certo, provedor indisponível ou migração de host                            |

Para listar os backups do R2 (credenciais do token de backup, no cofre ou nos segredos do GitHub):

```bash
export AWS_ACCESS_KEY_ID=... AWS_SECRET_ACCESS_KEY=... AWS_DEFAULT_REGION=auto
export AWS_ENDPOINT_URL=https://<account-id>.r2.cloudflarestorage.com
aws s3 ls s3://atletica-backups/prod/
aws s3 cp s3://atletica-backups/prod/atletica-prod-AAAA-MM-DDTHHMMZ.dump.age .
```

## 2. Criar um Postgres novo (até 30 min)

1. No ambiente `producao` da Railway: _New → Database → PostgreSQL_, major 16 (a mesma do backup). **Não apague o banco antigo**: ele fica para investigação por 7 dias.
2. Habilite o TCP Proxy do novo banco e copie a `DATABASE_PUBLIC_URL`.

## 3. Restaurar o dump (até 1 h)

Num computador confiável, com `pg_restore`/`psql` 16 e `age` (ou o contêiner de `scripts/backup/README.md`), a partir da raiz do repositório na `main`:

```bash
export DATABASE_URL='<DATABASE_PUBLIC_URL do banco novo>'
read -rs AGE_PRIVATE_KEY && export AGE_PRIVATE_KEY   # cole a linha AGE-SECRET-KEY-1... do cofre e Enter

scripts/backup/restaurar.sh atletica-prod-AAAA-MM-DDTHHMMZ.dump.age
scripts/backup/sanidade.sh   # se o backup for anterior à última migration, use MIGRATION_ESPERADA=<nome>

unset AGE_PRIVATE_KEY
rm atletica-prod-*.dump.age
```

O teste de restauração de rotina (sem incidente) segue os passos 2 e 3 num banco novo de **homologação** e é registrado na tabela do fim.

## 4. Apontar a API para o banco novo (até 30 min)

1. No serviço `api` de produção, troque `DATABASE_URL` para a referência do banco novo (`${{<NomeDoNovoPostgres>.DATABASE_URL}}`). A Railway faz um novo deploy; o pre-deploy aplica as migrations posteriores ao backup.
2. Valide: `curl <API_URL>/api/v1/health` → `200` com `"banco":"ok"`; entre no app com um administrador e confira os dados mais recentes (notícias, eventos).
3. Recrie o papel `backup_ro` no banco novo (papéis não vão no dump; `infra-railway-r2.md`, 1.4) e atualize o segredo `DATABASE_URL_PRODUCAO_BACKUP` no GitHub. Rode o `backup-db.yml` manualmente para confirmar.

## 5. Encerrar

- Comunique a diretoria: horário do backup usado e o que precisa ser lançado de novo.
- Registre na tabela abaixo. Depois de 7 dias sem pendências, apague o banco antigo.

## Registro de restaurações e testes

| Data | Tipo (teste automático / teste manual / incidente) | Backup usado | Duração total | Resultado | Responsável |
| ---- | -------------------------------------------------- | ------------ | ------------- | --------- | ----------- |
|      |                                                    |              |               |           |             |
