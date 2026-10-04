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
| `pnpm build`                                      | build do shared e da API                    |

Um hook de pre-commit (Husky + lint-staged) roda Prettier e ESLint nos arquivos alterados.

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
