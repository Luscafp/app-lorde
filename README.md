# Atlética Lorde App

Aplicativo mobile para gestão de treinos, jogos e informações da **Atlética Lorde** — associação atlética do curso de Ciência da Computação e Inteligência Artificial (ABI) da UFMA (Universidade Federal do Maranhão).

Hoje a organização da atlética é feita por grupos de WhatsApp; o objetivo do app é centralizar agenda de jogos e treinos, notícias, times/modalidades e a gestão administrativa da diretoria em um único lugar.

## 📌 Status

🚧 Em desenvolvimento

## 📱 Sobre o projeto

- **Plataforma:** Android (React Native + Expo)
- **Stack:** Expo/TypeScript no app · Node.js + NestJS + Prisma na API · PostgreSQL · Cloudflare R2 (imagens) · Expo Push/FCM (notificações)
- **Níveis de acesso:** Atleta < Diretoria < Presidência (Presidente e Vice, mesmas permissões) < Administrador
- **Multi-atlética:** hoje só a Lorde usa o app, mas o código deve nascer preparado para outras atléticas (`atleticaId` nas tabelas, papel por atlética, nada da Lorde fixo no código) — ver seção 8.4 do documento
- **Documentação completa:** ver `/docs` (Documento de Requisitos v1.2, diagramas de classes, casos de uso e arquitetura)

## 🎯 Funcionalidades

**Autenticação e conta**

- Login, cadastro aberto, logout, recuperação de senha e exclusão de conta

**Home**

- Próximos jogos e treinos, notícias com imagem e tags, carrossel de banners

**Agenda**

- Jogos e treinos (filtro por modalidade e tipo), aba Placar (vitória/empate/derrota) e confirmação de participação

**Modalidades e times**

- Modalidades (esporte) e times (grupo de pessoas), elenco com capitão, treinos do time, solicitação de entrada

**Perfil**

- Dados do usuário, estatísticas baseadas em presença registrada, configurações e preferências de notificação

**Diretoria**

- Eventos (jogo ou treino, avulso ou recorrente), status, resultados, presenças, times/adversários, modalidades, solicitações, notícias, banners e avisos

**Administração**

- Presidência: gerenciar usuários e auditoria · Administrador: conceder cargos da diretoria e da presidência

## 🛠️ Desenvolvimento

### Estrutura

Monorepo com pnpm workspaces (sem Turborepo):

| Pacote            | Nome               | Conteúdo                                                                                      |
| ----------------- | ------------------ | --------------------------------------------------------------------------------------------- |
| `apps/api`        | `api`              | API NestJS 11 (prefixo `/api/v1`, Swagger em `/api/docs` fora de produção)                    |
| `apps/mobile`     | `mobile`           | App Expo + Expo Router (development build, não Expo Go)                                       |
| `packages/shared` | `@atletica/shared` | Schemas Zod, DTOs, enums e utilitários usados pela API e pelo app (tsup: CJS + ESM + `.d.ts`) |

O Metro consome o fonte TS do shared (condição `react-native` no `exports`); a API consome o `dist`. Convenções completas em `docs/issues/00-convencoes.md`.

### Versões fixadas

- **Node 24 LTS** (`.nvmrc`) e **pnpm 12** via Corepack (`packageManager` no `package.json`).
- **Expo SDK 57** (React Native 0.86) — decisão D5 (#97): fixar a estável vigente no início e atualizar só entre releases.
- **TypeScript 6.0** em todos os pacotes (versão exigida pelo Expo SDK 57 e suportada pelo `typescript-eslint`).
- **PostgreSQL 16** no Docker local (mesma major da Railway).
- **pnpm em modo isolado** (padrão, sem `node-linker=hoisted`): o Expo SDK ≥ 54 suporta monorepo com instalação isolada. Se um build nativo acusar módulo não encontrado, a alternativa é `node-linker=hoisted` no `.npmrc`.

### Pré-requisitos

- Node 24 (`nvm use`) com Corepack habilitado (`corepack enable`)
- Docker (Postgres local)
- Para o development build Android: Android Studio + SDK (build local) ou conta Expo (build na EAS)

### Primeiros passos

```bash
corepack enable
pnpm install
cp apps/api/.env.example apps/api/.env
cp apps/mobile/.env.example apps/mobile/.env   # ajuste EXPO_PUBLIC_API_URL com o IP da sua máquina
pnpm db:up          # Postgres dev (5432) e de testes (5433, tmpfs)
pnpm --filter api prisma:deploy   # aplica as migrations no banco de dev
pnpm dev            # shared (tsup --watch) + API + Metro em paralelo
```

A API sobe em `http://localhost:3000/api/v1` e o Swagger em `http://localhost:3000/api/docs`. Se uma variável obrigatória faltar ou for inválida, a API não sobe e lista as variáveis com problema.

### Scripts

| Script                                            | Faz                                         |
| ------------------------------------------------- | ------------------------------------------- |
| `pnpm dev`                                        | shared em watch + API + Metro em paralelo   |
| `pnpm dev:api` / `pnpm dev:mobile`                | um só pacote (a API compila o shared antes) |
| `pnpm db:up` / `pnpm db:down`                     | sobe / derruba os contêineres do Postgres   |
| `pnpm lint` / `pnpm format` / `pnpm format:check` | ESLint / Prettier                           |
| `pnpm typecheck`                                  | `tsc --noEmit` em todos os pacotes          |
| `pnpm test`                                       | Jest em todos os pacotes                    |
| `pnpm --filter api test:cov`                      | testes da API com limite de cobertura       |
| `pnpm build`                                      | build do shared e da API                    |

Um hook de pre-commit (Husky + lint-staged) roda Prettier e ESLint nos arquivos alterados.

### Banco de dados (Prisma)

Prisma 7: o schema está em `apps/api/prisma/schema.prisma`, a conexão em `apps/api/prisma.config.ts` (lê `DATABASE_URL` do `apps/api/.env`) e o client é gerado em `apps/api/src/generated/prisma` (fora do Git).

| Comando                                                        | Faz                                                                |
| -------------------------------------------------------------- | ------------------------------------------------------------------ |
| `pnpm --filter api prisma:generate`                            | gera o client (também roda no `pnpm install` e antes do `build`)   |
| `pnpm --filter api prisma:migrate --name <nome>`               | cria e aplica uma migration no banco de dev a partir do schema     |
| `pnpm --filter api prisma:migrate --create-only --name <nome>` | só cria o arquivo da migration, para editar o SQL antes de aplicar |
| `pnpm --filter api prisma:deploy`                              | aplica as migrations pendentes (CI, deploy, banco novo)            |

Nomes de migration em snake_case (`add_presenca_registrada_por`).

> ⚠️ **Revise toda migration gerada.** A migration `init` cria em SQL índices únicos parciais, índices por expressão (`lower(nome)`), `CHECK` e a extensão `unaccent`, que o Prisma não conhece. A lista completa de nomes está no topo do `schema.prisma`. O `migrate diff` não os acusa como divergência, então uma migration gerada não deve conter `DROP INDEX`/`DROP CONSTRAINT` desses nomes. Se contiver, apague essas linhas antes de aplicar.

Para conferir se as migrations batem com o schema (job `prisma` da CI), use um banco sombra vazio em `SHADOW_DATABASE_URL`:

```bash
pnpm --filter api exec prisma migrate diff --from-migrations prisma/migrations --to-schema prisma/schema.prisma --exit-code
```

### CI

O workflow `.github/workflows/ci.yml` (GitHub Actions) roda em todo PR para `main` e em todo push na `main`. Um push novo no mesmo PR cancela a execução anterior. Node vem do `.nvmrc`, pnpm do `packageManager`, com cache do pnpm (`.github/actions/preparar`). A CI não usa segredos: as variáveis de ambiente de teste são fictícias e ficam no próprio workflow.

| Job         | Verifica                                                                                                                                              | Falha quando                                          |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `qualidade` | `pnpm format:check`, `pnpm lint --max-warnings=0`, `pnpm typecheck` (todos reportam, mesmo que um falhe) e `gitleaks` nos commits do PR               | segredo commitado, erro ou aviso de lint/formato/tipo |
| `prisma`    | `prisma validate` e `prisma migrate diff --exit-code` contra um banco sombra (pulado enquanto `apps/api/prisma/schema.prisma` não existir, até a #43) | schema alterado sem migration correspondente          |
| `api`       | Postgres 16 como serviço, `prisma migrate deploy`, `pnpm --filter api test:cov` (projetos Jest `unit` e `integration`) e resumo da cobertura no job   | teste falhando ou cobertura abaixo do limite          |
| `mobile`    | Jest do app (`jest-expo`) e `expo-doctor` (só alerta, não bloqueia)                                                                                   | teste falhando                                        |
| `shared`    | Jest do `@atletica/shared`                                                                                                                            | teste falhando                                        |
| `build`     | `pnpm --filter @atletica/shared build && pnpm --filter api build`                                                                                     | build quebrado                                        |

- **Cobertura (RNF11):** medida só em `apps/api/src/modules/**/*.service.ts`, sobre a soma dos testes unitários e de integração. Cada service precisa de linhas, comandos e funções ≥ 70% e ramos ≥ 60% (`coverageThreshold` em `apps/api/jest.config.js`). O relatório HTML fica no artefato `cobertura-api` da execução. Localmente: `pnpm --filter api test:cov`.
- **Filtro de caminhos:** todos os jobs sempre rodam e reportam status (inclusive em PR só de `docs/`); quando nada relevante mudou, os passos são pulados e o job passa. Os caminhos de cada job ficam em `.github/filtros-ci.yml` — nunca use `paths` no gatilho do workflow, senão os checks obrigatórios ficam pendentes.
- **Dependabot** (`.github/dependabot.yml`): PRs semanais de dependências npm (minor e patch agrupados) e das actions. Majors do Expo SDK e do React Native não são propostos (decisão D5, #97).
- **Template de PR** (`.github/pull_request_template.md`): checklist de issue vinculada, testes 401/403/404, migration, auditoria, eventos de domínio e Swagger.

#### Proteção da `main` (configurada na #91)

Em _Settings → Branches_ (ou _Rulesets_), para a `main`:

- Exigir Pull Request para mesclar; bloquear push direto e force-push.
- Checks obrigatórios (nomes exatos dos jobs): **`qualidade`**, **`prisma`**, **`api`**, **`mobile`**, **`shared`**, **`build`**.
- Exigir branch atualizada com a `main` antes de mesclar.
- Aprovações obrigatórias: conforme a decisão do PO na #97.

### Development build Android

O app usa `expo-dev-client` (não roda no Expo Go). Gere o development build uma vez e depois use só o Metro:

```bash
# Opção 1 — build na nuvem (EAS), perfil "development" do eas.json
cd apps/mobile && npx eas-cli build --profile development --platform android
# instale o APK gerado no aparelho

# Opção 2 — build local (requer Android Studio/SDK e aparelho/emulador conectado)
pnpm --filter mobile android

# Depois, a cada sessão de desenvolvimento:
pnpm dev:mobile     # expo start --dev-client; abra o app instalado e conecte ao Metro
```

Para conferir o bundle sem aparelho: `pnpm --filter mobile exec expo export --platform android`. Gere um novo development build sempre que mudar dependências nativas ou o `app.config.ts`.

## 📄 Documentação

- Documento de Requisitos (`docs/Documento_Requisitos-Aplicativo.docx`): RFs com prioridade (MVP/R2/R3), RNFs, regras de negócio, restrições, casos de uso especificados, modelo de dados e arquitetura técnica
- Diagrama de Classes (`docs/diagrama-classes.mermaid`)
- Diagrama de Casos de Uso (`docs/diagrama-casos-uso.mermaid`)
- Diagrama de Arquitetura (`docs/diagrama-arquitetura.mermaid`)
- Protótipo de interface (`docs/Prototipo interativo app atlética`) — referência visual, defasado em relação ao documento

## 🗺️ Roadmap de desenvolvimento

1. **MVP (R1):** monorepo, CI, banco (Prisma) a partir do Diagrama de Classes, autenticação JWT, agenda de jogos e treinos, times e solicitações, confirmação de participação, placar, notícias, usuários e cargos
2. **R2:** notificações push, registro de presença e estatísticas, banners, tags, verificação de e-mail
3. **R3:** avisos manuais e consulta à auditoria

## 🤝 Contribuindo

1. Crie uma branch a partir de `main`: `feature/<numero-da-issue>-<slug>` (correções: `fix/<numero>-<slug>`)
2. Commits em Conventional Commits, em português (`feat(auth): cadastro e login`)
3. Antes do PR: `pnpm lint && pnpm typecheck && pnpm test`
4. Abra um Pull Request com `Closes #N`, descrevendo o que foi feito e qual RF/UC ele atende

## 👥 Equipe

- Lucas — Desenvolvimento

## 📃 Licença

A definir pela equipe.
