# Runbook — seed de produção

Execução **única**, manual, na implantação (épico #4 §8, #92). Cria a Atlética Lorde, o administrador inicial e as modalidades básicas (`apps/api/README.md`, Seed). O seed é idempotente, mas nunca roda no deploy automático, e as variáveis `SEED_ADMIN_*` **não** ficam cadastradas na Railway.

## Pré-requisitos

- Primeiro deploy de produção concluído (as migrations são aplicadas pelo pre-deploy).
- TCP Proxy do Postgres de produção habilitado (`infra-railway-r2.md`, 1.4): o seed roda na sua máquina, fora da rede privada da Railway.
- Railway CLI autenticada (`railway login`) com acesso ao projeto, Node 24 e pnpm.
- Repositório na `main` atualizada, com `pnpm install` e `pnpm --filter @atletica/shared build`.
- E-mail e nome do administrador inicial definidos pela diretoria.

## Passos

```bash
railway link                      # escolha o projeto da atlética
export SEED_ADMIN_EMAIL='admin@dominio-da-atletica'
export SEED_ADMIN_NOME='Nome do Administrador'
read -rs SEED_ADMIN_SENHA && export SEED_ADMIN_SENHA   # não fica no histórico do shell

# DATABASE_PUBLIC_URL vem das variáveis do serviço Postgres de produção
railway run --service Postgres --environment producao -- \
  sh -c 'DATABASE_URL="$DATABASE_PUBLIC_URL" APP_ENV=producao pnpm --filter api prisma:seed'

unset SEED_ADMIN_EMAIL SEED_ADMIN_NOME SEED_ADMIN_SENHA
```

- Ajuste `--service Postgres` se o serviço do banco tiver outro nome.
- A senha precisa seguir o `senhaSchema` (o seed valida antes de gravar). `SEED_DEMO` **não** deve ser definida; o `APP_ENV=producao` do comando faz o seed recusá-la.
- A saída esperada é `Seed concluído: atlética <id>; administrador criado; 8 modalidade(s) criada(s)`.

## Depois

1. Entre no app de produção com o administrador e troque a senha se ela foi compartilhada.
2. Confira `GET <API_URL>/api/v1/atletica` (nome e cores da Lorde).
3. Registre a execução abaixo. Para homologação, o mesmo roteiro vale com `--environment homologacao` e `APP_ENV=homologacao` (lá `SEED_DEMO=true` é permitido).

| Data | Ambiente | Commit da `main` | Responsável | Observações |
| ---- | -------- | ---------------- | ----------- | ----------- |
|      |          |                  |             |             |
