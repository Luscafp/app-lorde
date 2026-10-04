# Runbook — Railway, Cloudflare R2, segredos e backup

Roteiro de provisionamento da infraestrutura da API (épico #4). É executado uma vez pelo responsável humano na **#92**; o código que ele habilita veio da #46 (Dockerfile, `/health`) e da #47 (workflows, scripts, `apps/api/railway.json`). Nenhum segredo vai para o repositório: os valores ficam na Railway, no GitHub e no cofre de senhas.

Titular das contas: decisão pendente na #97 (recomendado: conta institucional da atlética com o desenvolvedor como membro). Registre o inventário de contas e titulares na seção 7.

## Visão geral

```
push na main ──► CI (ci.yml) ──► deploy-api.yml
                                   ├─ job "CI verde"     aguarda a CI do commit
                                   ├─ job homologacao    railway up (RAILWAY_TOKEN_HML) + /health com o commit
                                   └─ job producao       aprovação no environment "producao" + mesmo deploy (RAILWAY_TOKEN_PROD)

Railway (projeto único)            Cloudflare R2
  ├─ homologacao: api + Postgres     ├─ atletica-imagens-hml   (público para leitura, #54)
  └─ producao:    api + Postgres     ├─ atletica-imagens-prod  (público para leitura, #54)
                                     └─ atletica-backups       (privado; prod/ 30 dias, hml/ 14 dias)

backup-db.yml   03:00 diário (prod) / domingo 04:00 (hml): pg_dump → age → R2
restore-test.yml dia 1º 06:00: último backup de prod → Postgres efêmero → consultas de sanidade
```

## 1. Railway

### 1.1 Projeto e ambientes

1. Crie **um** projeto (ex.: `atletica`) com dois ambientes: `homologacao` e `producao` (renomeie o `production` padrão). Os nomes precisam ser exatamente esses: o workflow usa `--environment homologacao|producao`.
2. Em cada ambiente:
   - **PostgreSQL** gerenciado, **major 16** (a mesma do compose, da CI e do `PG_MAJOR` dos workflows de backup). Se a Railway só oferecer outra major, troque o `default` de `versao-postgres` em `.github/actions/preparar-backup/action.yml`: ele vale para o cliente do backup e para o Postgres efêmero do `restore-test.yml`.
   - Serviço **`api`** (nome exato) criado como _Empty Service_, **sem conectar o repositório do GitHub**. O deploy é feito só pelo `railway up` do workflow; com o repositório conectado, o autodeploy nativo faria deploy duplo e sem aprovação. Se o serviço já estiver conectado, desconecte em _Settings → Source_.
3. No serviço `api` de cada ambiente, em _Settings → Config-as-code_, aponte o arquivo para **`/apps/api/railway.json`**. Ele define:
   - build pelo `apps/api/Dockerfile` (contexto = raiz do repositório enviada pelo `railway up`);
   - **pre-deploy** `node node_modules/prisma/build/index.js migrate deploy`: roda uma vez por deploy, antes de a nova versão receber tráfego; se falhar, o deploy é abortado e a versão anterior continua no ar;
   - **healthcheck** em `/api/v1/health` (timeout 120 s): a versão só é trocada quando o novo contêiner responde `200`;
   - reinício `ON_FAILURE` (até 5 vezes).
4. Gere um domínio público para o `api` de cada ambiente (_Settings → Networking → Generate Domain_, ou o domínio customizado decidido na #97). A URL base (sem `/api/v1`) vai para a variável `API_URL` do environment do GitHub (seção 2).

### 1.2 Variáveis do serviço `api`

Cadastre em _Variables_ de cada ambiente. Segredos **diferentes** por ambiente: um token de homologação nunca pode ser aceito em produção (critério 12 do épico).

| Variável                                                                                               | Homologação                                                   | Produção                       | Dona                 |
| ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------- | ------------------------------ | -------------------- |
| `DATABASE_URL`                                                                                         | `${{Postgres.DATABASE_URL}}` (rede privada)                   | idem                           | #43                  |
| `NODE_ENV`                                                                                             | `production`                                                  | `production`                   | #1                   |
| `APP_ENV`                                                                                              | `homologacao`                                                 | `producao`                     | #1                   |
| `LOG_LEVEL`                                                                                            | `info` (ou `debug` para investigar)                           | `info`                         | #48                  |
| `JWT_ACCESS_SECRET`                                                                                    | 32+ bytes aleatórios                                          | **outro** valor                | #7                   |
| `CODIGO_PEPPER`                                                                                        | 32+ bytes aleatórios                                          | **outro** valor                | #61                  |
| `EMAIL_PROVIDER`                                                                                       | `resend`                                                      | `resend`                       | #61                  |
| `RESEND_API_KEY`, `EMAIL_REMETENTE`                                                                    | chave e remetente de homologação (#94)                        | de produção (#94)              | #61                  |
| `SENTRY_DSN`                                                                                           | DSN da API (#93)                                              | idem                           | #48                  |
| `SENTRY_TRACES_SAMPLE_RATE`                                                                            | `1.0`                                                         | `0.1`                          | #48                  |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_IMAGENS`, `R2_PUBLIC_BASE_URL` | bucket `atletica-imagens-hml`                                 | bucket `atletica-imagens-prod` | #54 (quando existir) |
| `GIT_COMMIT_SHA`                                                                                       | **não cadastre**: o workflow grava a cada deploy              | idem                           | #47                  |
| `SEED_ADMIN_EMAIL`, `SEED_ADMIN_NOME`, `SEED_ADMIN_SENHA`                                              | **não cadastre**: só na execução do seed (`seed-producao.md`) | idem                           | #45                  |

- `PORT` é injetada pela Railway; não cadastre.
- Gere segredos com `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`.
- A lista completa e as regras de validação estão em `apps/api/README.md` (Variáveis de ambiente). A API não sobe com variável faltando.
- `GIT_COMMIT_SHA` é variável do serviço porque a Railway passa variáveis como _build args_ ao Dockerfile (`ARG GIT_COMMIT_SHA`). O workflow faz `railway variables --set GIT_COMMIT_SHA=<sha> --skip-deploys` e depois `railway up`; se o deploy falhar, devolve o valor anterior.

### 1.3 Tokens da Railway

Em _Project Settings → Tokens_, crie um **token de projeto por ambiente** (o token de projeto só enxerga o ambiente escolhido):

- `homologacao` → segredo `RAILWAY_TOKEN_HML` do environment `homologacao` no GitHub;
- `producao` → segredo `RAILWAY_TOKEN_PROD` do environment `producao` no GitHub.

Nunca use token de conta/time (acesso a tudo).

### 1.4 Postgres: acesso para o backup e papel `backup_ro`

O `pg_dump` roda no GitHub Actions, fora da rede privada da Railway. Habilite o **TCP Proxy** do Postgres de produção (e de homologação, para o backup semanal) e use a URL pública com SSL. Crie um papel somente-leitura para o backup (se o plano permitir), conectado como `postgres`:

```sql
CREATE ROLE backup_ro LOGIN PASSWORD '<senha forte gerada>';
GRANT CONNECT ON DATABASE railway TO backup_ro;
GRANT pg_read_all_data TO backup_ro;
```

`pg_read_all_data` (PostgreSQL 14+) cobre tabelas criadas por migrations futuras. Monte a URL do backup com esse papel e `sslmode=require`:

```
postgresql://backup_ro:<senha>@<host-do-tcp-proxy>:<porta>/railway?sslmode=require
```

Ela é o segredo `DATABASE_URL_PRODUCAO_BACKUP` (e `DATABASE_URL_HOMOLOGACAO_BACKUP` para homologação). Se não for possível criar o papel, use a URL pública do dono, com senha forte.

### 1.5 Backup do provedor (segunda cópia)

Habilite os backups automáticos do Postgres de produção na Railway (_Postgres → Backups_), conforme o plano contratado. Eles são a cópia mais rápida de restaurar quando a Railway está disponível; o `pg_dump` no R2 é a cópia independente do provedor exigida pelo documento (8.2).

### 1.6 HTTPS e HSTS

- O TLS termina na borda da Railway (TLS 1.2+, certificado automático, inclusive para domínio customizado após o CNAME).
- A API envia `Strict-Transport-Security: max-age=31536000; includeSubDomains` (helmet) e liga `trust proxy` com 1 salto (#46).
- Verifique na #92: `curl -I http://<dominio>/api/v1/health` redireciona para `https://` ou é recusado; SSL Labs (ou `testssl.sh <dominio>`) sem TLS 1.0/1.1.

### 1.7 Criptografia em repouso (RNF08)

Pendente de verificação humana: confirme na documentação/contrato da Railway que os volumes do Postgres do plano escolhido são criptografados em repouso e registre aqui a evidência (link e data). O R2 criptografa todos os objetos em repouso por padrão, e os dumps ainda são criptografados no cliente com `age`.

| Data | Evidência (link/print) | Responsável |
| ---- | ---------------------- | ----------- |
|      |                        |             |

## 2. GitHub

### 2.1 Environments (_Settings → Environments_)

| Environment   | Proteção                                                                                                             | Segredos             | Variáveis                           |
| ------------- | -------------------------------------------------------------------------------------------------------------------- | -------------------- | ----------------------------------- |
| `homologacao` | _Deployment branches_: só `main`                                                                                     | `RAILWAY_TOKEN_HML`  | `API_URL` (URL base, sem `/api/v1`) |
| `producao`    | _Required reviewers_: quem aprova deploys (#97); _Deployment branches_: só `main`; recomendado _Prevent self-review_ | `RAILWAY_TOKEN_PROD` | `API_URL`                           |

Sem aprovação, o job `producao` fica esperando e produção não muda. Para produção totalmente automática (decisão da atlética), basta remover o revisor do environment.

Os jobs de deploy usam concorrência por ambiente: um deploy de produção aguardando aprovação não bloqueia novos deploys de homologação. Se houver dois deploys de produção na fila, rejeite o mais antigo e aprove o mais novo.

### 2.2 Segredos do repositório (_Settings → Secrets and variables → Actions_)

| Segredo                           | Valor                                                        | Usado por                           |
| --------------------------------- | ------------------------------------------------------------ | ----------------------------------- |
| `DATABASE_URL_PRODUCAO_BACKUP`    | URL pública do Postgres de produção com `backup_ro` (1.4)    | `backup-db.yml`                     |
| `DATABASE_URL_HOMOLOGACAO_BACKUP` | idem, homologação                                            | `backup-db.yml` (semanal)           |
| `R2_BACKUP_ACCOUNT_ID`            | Account ID da Cloudflare                                     | `backup-db.yml`, `restore-test.yml` |
| `R2_BACKUP_ACCESS_KEY_ID`         | token do R2 restrito ao bucket `atletica-backups` (3.2)      | idem                                |
| `R2_BACKUP_SECRET_ACCESS_KEY`     | idem                                                         | idem                                |
| `AGE_PUBLIC_KEY`                  | chave pública `age1...` (seção 4)                            | `backup-db.yml`                     |
| `AGE_PRIVATE_KEY_RESTORE_TEST`    | conteúdo do arquivo da chave privada (`AGE-SECRET-KEY-1...`) | `restore-test.yml`                  |

Os tokens da Railway ficam nos environments (2.1), não aqui. Restrinja a lista de administradores do repositório: quem é admin consegue ler indiretamente a chave privada do teste de restauração (decisão técnica do épico, seção 15).

### 2.3 Notificação de falha

Falha de workflow agendado gera e-mail do GitHub para quem editou o cron por último e para quem acompanha o repositório. Os mantenedores devem manter _Settings (perfil) → Notifications → Actions_ com e-mail para execuções com falha. Alertas adicionais: #93.

## 3. Cloudflare R2

### 3.1 Buckets

| Bucket                  | Acesso                                                                   | Ciclo de vida                                                                                       |
| ----------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| `atletica-imagens-hml`  | leitura pública (`r2.dev` ou domínio), escrita só por URL pré-assinada   | nenhum (limpeza de órfãos: #56)                                                                     |
| `atletica-imagens-prod` | leitura pública por domínio customizado, escrita só por URL pré-assinada | nenhum                                                                                              |
| `atletica-backups`      | **privado**: sem `r2.dev` e sem domínio público                          | regra 1: prefixo `prod/`, apagar após **30 dias**; regra 2: prefixo `hml/`, apagar após **14 dias** |

As regras ficam em _R2 → atletica-backups → Settings → Object lifecycle rules_. Chaves dos objetos: `prod/atletica-prod-AAAA-MM-DDTHHMMZ.dump.age` e `hml/atletica-hml-AAAA-MM-DDTHHMMZ.dump.age`.

### 3.2 Tokens de API do R2 (menor privilégio)

_R2 → Manage R2 API Tokens_, permissão **Object Read & Write**, restrito a buckets específicos:

- **API de homologação**: só `atletica-imagens-hml` → variáveis `R2_*` do `api` em homologação;
- **API de produção**: só `atletica-imagens-prod` → variáveis `R2_*` do `api` em produção;
- **Backup**: só `atletica-backups` → segredos `R2_BACKUP_*` do GitHub.

## 4. Chaves `age`

1. Num computador confiável, fora da infraestrutura: `age-keygen -o atletica-backup.key` (a linha `# public key: age1...` é a chave pública).
2. Guarde o arquivo da chave privada em **dois** cofres independentes (ex.: cofre de senhas da atlética e do desenvolvedor). **Perder a chave privada = perder todos os backups do R2.**
3. Chave pública → segredo `AGE_PUBLIC_KEY`. Conteúdo do arquivo da chave privada → segredo `AGE_PRIVATE_KEY_RESTORE_TEST`.
4. Apague o arquivo local depois de conferir os dois cofres. A chave privada nunca vai para a Railway.

Troca da chave: gere um par novo, atualize os dois segredos e os cofres e **mantenha a chave antiga** nos cofres por 30 dias (os backups antigos ainda dependem dela).

## 5. Validação na #92

| Critério do épico                    | Como validar                                                                                                                                     |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1. homologação automática            | merge na `main` com CI verde → job `homologacao` verde; `curl $API_URL/api/v1/health` mostra o `commit` do merge                                 |
| 2. produção com aprovação            | aprovar o environment `producao` → `/health` de produção com o mesmo `commit`; sem aprovação nada muda                                           |
| 3. migration no pre-deploy           | merge com migration nova → log de pre-deploy da Railway com `migrate deploy` antes do novo contêiner                                             |
| 4. migration quebrada                | em homologação, migration com SQL inválido → deploy falha no pre-deploy e `/health` segue `200` com o commit anterior                            |
| 6. HTTPS                             | seção 1.6                                                                                                                                        |
| 7. backup criptografado              | `workflow_dispatch` do `backup-db.yml` → `.dump.age` novo em `prod/`; `pg_restore` direto do arquivo falha; 3 dias seguidos de execução agendada |
| 8. ciclo de vida                     | regras da 3.1 configuradas; após 31 dias o primeiro backup some                                                                                  |
| 9. restauração automática            | `workflow_dispatch` do `restore-test.yml` → resumo com sanidade ok e duração                                                                     |
| 10. bucket privado                   | URL pública de um objeto de `atletica-backups` responde `403`/`404`                                                                              |
| 12. token de homologação em produção | access token emitido em homologação, usado contra produção → `401`                                                                               |

## 6. Migração para outro host

A imagem de `apps/api/Dockerfile` roda em qualquer host com Docker (ex.: servidor do NCA, 8.5). Precisa das variáveis da tabela 1.2, de rodar `node node_modules/prisma/build/index.js migrate deploy` antes de cada nova versão e de um proxy TLS na frente (ajuste `SALTOS_PROXY_CONFIAVEIS` se houver mais de um). O `deploy-api.yml` é específico da Railway; os workflows de backup só dependem da URL do banco.

## 7. Inventário de contas e titulares

| Serviço              | Conta (e-mail) | Titular | Membros com acesso | Cofre da credencial |
| -------------------- | -------------- | ------- | ------------------ | ------------------- |
| Railway              |                |         |                    |                     |
| Cloudflare (R2)      |                |         |                    |                     |
| GitHub (organização) |                |         |                    |                     |
| Domínio / DNS        |                |         |                    |                     |
| Chave privada `age`  | —              |         |                    |                     |
