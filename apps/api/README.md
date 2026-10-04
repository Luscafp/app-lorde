# API (NestJS)

Visão geral, scripts e primeiros passos no [README da raiz](../../README.md). Convenções em `docs/issues/00-convencoes.md`.

## Variáveis de ambiente

Validadas por `src/config/env.schema.ts` (Zod): a API não sobe com variável faltando ou inválida e a mensagem lista as variáveis com problema, sem os valores. Exemplo comentado em `.env.example`; nos testes os valores vêm de `.env.test.example` (veja [Testes](#testes)).

| Variável                    | Obrigatória                 | Descrição                                                                                                         |
| --------------------------- | --------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `NODE_ENV`                  | não (`development`)         | `development \| test \| production`                                                                               |
| `APP_ENV`                   | com `NODE_ENV=production`   | `local \| development \| homologacao \| producao` (padrão `local`)                                                |
| `PORT`                      | não (`3000`)                | Porta HTTP                                                                                                        |
| `DATABASE_URL`              | sim                         | `postgresql://...`                                                                                                |
| `LOG_LEVEL`                 | não (`info`)                | Nível do pino                                                                                                     |
| `EMAIL_PROVIDER`            | sim                         | `resend` (homologação/produção — obrigatório com `NODE_ENV=production`), `fake` (testes), `log` (desenvolvimento) |
| `RESEND_API_KEY`            | com `EMAIL_PROVIDER=resend` | Chave da API do Resend (vazia conta como ausente)                                                                 |
| `EMAIL_REMETENTE`           | sim                         | Remetente, ex.: `"Atlética Lorde <nao-responda@dominio>"` (domínio verificado no Resend)                          |
| `CODIGO_PEPPER`             | sim (≥ 32 caracteres)       | Segredo do HMAC dos códigos de verificação. Trocar o valor invalida os códigos pendentes                          |
| `SENTRY_DSN`                | não                         | DSN do Sentry da API; ausente ou vazia = Sentry desligado (veja [Observabilidade](#observabilidade))              |
| `SENTRY_TRACES_SAMPLE_RATE` | não (`0.1`)                 | Fração de traces de 0 a 1: `0.1` em produção, `1.0` em homologação                                                |

## Testes

O Jest tem dois projetos, rodados juntos pelo `pnpm --filter api test` e pelo `test:cov` (a cobertura é medida sobre a soma):

| Projeto       | Arquivos                | Banco                                                       |
| ------------- | ----------------------- | ----------------------------------------------------------- |
| `unit`        | `src/**/*.spec.ts`      | nenhum                                                      |
| `integration` | `test/**/*.e2e-spec.ts` | Postgres real; roda com `--runInBand` (banco compartilhado) |

### Rodar localmente

```bash
pnpm db:up                                 # Postgres de testes na porta 5433 (tmpfs)
pnpm --filter api test:integration         # só integração
pnpm --filter api test:unit                # só unitários, sem banco
```

- **Env:** `test/setup/env.ts` lê `.env.test.example` (versionado, valores fictícios). Para trocar algo localmente, crie `apps/api/.env.test` (fora do Git), que tem precedência; variáveis já definidas no ambiente (CI) têm precedência sobre os dois. `NODE_ENV` é sempre `test` e o `.env` de desenvolvimento é ignorado.
- **`globalSetup`** (`test/setup/global-setup.ts`): roda `prisma migrate deploy` no banco de teste antes da suíte. **Recusa** qualquer `DATABASE_URL` cujo banco não termine em `_test`, para nunca apagar o banco de desenvolvimento.
- **Banco vazio em todo teste:** `test/setup/integracao.ts` chama `limparBanco()` no `beforeEach` de todos os testes de integração. Por isso, **crie os dados no `beforeEach` ou no próprio teste**, nunca no `beforeAll` (seriam apagados antes do primeiro teste).
- **Sem transação por teste** (épico #2 §14): os services abrem as próprias transações interativas (auditoria, #8), incompatíveis com rollback por teste. O isolamento é o `TRUNCATE` + `--runInBand`.

### Utilitários (`test/setup/`)

| Utilitário                           | Uso                                                                                                                                                                                                                   |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `prismaTeste` (`prisma-teste.ts`)    | Cliente Prisma **base** (sem a extensão multi-atlética): enxerga todas as atléticas. Para preparar dados e conferir o banco; o código da API usa o `PrismaService` (#44).                                             |
| `limparBanco()` (`limpar-banco.ts`)  | `TRUNCATE ... RESTART IDENTITY CASCADE` em todas as tabelas do `public`, menos `_prisma_migrations` (lista lida de `pg_tables`). Já roda no `beforeEach`; chame direto só para limpar no meio de um teste.            |
| `criarApp(opcoes?)` (`criar-app.ts`) | Sobe o `AppModule` real com o `configurarApp` do `main.ts` e devolve `{ app, http }`. `opcoes.controllers` acrescenta controllers de teste; `opcoes.ajustar` recebe o `TestingModuleBuilder` (`overrideProvider`...). |

```ts
import request from 'supertest'
import { criarUsuario } from '../fabricas/usuario'
import { criarApp, type AppDeTeste } from '../setup/criar-app'

describe('GET /api/v1/...', () => {
  let contexto: AppDeTeste

  beforeAll(async () => {
    contexto = await criarApp()
  })

  afterAll(async () => {
    await contexto.app.close()
  })

  it('...', async () => {
    const diretor = await criarUsuario({ papel: 'DIRETOR' }) // dados no próprio teste
    const resposta = await request(contexto.http).get('/api/v1/...')
    expect(resposta.status).toBe(200)
  })
})
```

### Fábricas (`test/fabricas/`)

- `criarAtletica(dados?)` — atlética que usa o app, com `slug`, `sigla` e cores válidas (`CHECK atletica_dados_app`). `criarAtletica({ usaAplicativo: false })` cria uma adversária só com o nome. Qualquer campo pode ser sobrescrito.
- `criarUsuario({ papel = 'ATLETA', atleticaId?, nome?, email?, ativo?, vinculoAtivo?, senhaHash? })` — cria o `Usuario` (e-mail único, gravado em minúsculas) e o `VinculoAtletica` com o papel. Sem `atleticaId`, cria uma atlética. Devolve o usuário com `atleticaId` e `vinculo`. `senhaHash` padrão é `SENHA_HASH_FICTICIO`, que não corresponde a nenhuma senha: para login real, passe um hash do `SenhaService` (#45).
- `proximaSequencia()` — número crescente para valores únicos nas fábricas.
- Cada issue de domínio cria as suas em `test/fabricas/<dominio>.ts` (ex.: `eventos.ts` na #70). `tokenPara(usuario, ...)` é da #7.

### Suítes de infraestrutura

- `test/infraestrutura/` — testes dos próprios utilitários (`limparBanco`, fábricas, `criarApp`, proteção do `globalSetup`).
- `test/prisma/constraints.e2e-spec.ts` — um caso aceito e um rejeitado para cada constraint da migration `init` (épico #3 §8.3), conferindo o nome da constraint violada, e a estrutura da migration (tabelas, enums, índices e `CHECK`). Toda constraint nova em SQL entra aqui.
- `test/prisma/extensao-atletica.e2e-spec.ts` — extensão multi-atlética: cada operação com contexto A e dados de A e B, regra de `Time`, transações, falta de contexto e o `500` numa rota.

## Banco de dados e multi-atlética (`src/infra/prisma`, `src/infra/contexto`)

`PrismaModule` e `ContextoModule` são globais (importados no `AppModule`): injete `PrismaService` e, se precisar, `ContextoAtletica`. O `PrismaService` conecta na subida e desconecta no `app.close()` (inclusive nos sinais de término, `enableShutdownHooks`).

### `prisma.db` × `prisma.semEscopo`

| Cliente            | Filtro por atlética | Quando usar                                                                                                                                                   |
| ------------------ | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `prisma.db`        | sim (RNF20)         | **Padrão**, em todos os services.                                                                                                                             |
| `prisma.semEscopo` | não                 | Só operações de conta que atravessam atléticas ou acontecem antes do contexto (login, sessão no guard, exclusão de conta), `/health`, seed e jobs de limpeza. |

A regra de lint `no-restricted-syntax` só permite `semEscopo` em `src/modules/auth/**`, `src/modules/usuarios/conta*.ts`, `src/modules/health/**`, `src/infra/**` e `prisma/seed*.ts` (convenções §3). Qualquer outro uso exige justificativa no PR.

### Como o filtro funciona

A extensão (`extensao-atletica.ts`) lê `atleticaId` do `ContextoAtletica` e, nos **modelos com escopo** (`modelos-com-escopo.ts`: `VinculoAtletica`, `MembroTime`, `SolicitacaoEntrada`, `Evento`, `SerieRecorrencia`, `Participacao`, `Noticia`, `Tag`, `Banner`, `RegistroAuditoria`, `Time`):

- **leituras e escritas por `where`** (`findMany`, `findFirst[OrThrow]`, `findUnique[OrThrow]`, `count`, `aggregate`, `groupBy`, `update`, `updateMany[AndReturn]`, `delete`, `deleteMany`, `upsert`) recebem `atleticaId = contexto` num `AND`, preservando o `where` original. Registro de outra atlética = **não encontrado** (`null`, ou `P2025` → `404 NOT_FOUND`), idêntico ao inexistente;
- **criação** (`create`, `createMany`, `createManyAndReturn`, `upsert.create`) preenche a atlética ausente: `atleticaId` na forma com escalares, `atletica: { connect: { id } }` quando `data` usa relações (`connect`/`create`). `atleticaId` (ou `atletica.connect.id`) diferente do contexto lança `ErroAtleticaDivergente`; `atletica.connect` por outra chave única (ex.: `slug`) recebe o `id` do contexto como filtro (outra atlética → `P2025`); `atletica.create`/`connectOrCreate` são rejeitados. Alterações (`data` de `update*` e `upsert.update`) que movam o registro para outra atlética também lançam `ErroAtleticaDivergente`;
- **sem atlética no contexto**, lança `ErroAtleticaContextoAusente` antes de ir ao banco (falha fechada);
- os dois erros são bugs de programação: o filtro global responde `500 INTERNAL_ERROR` com a mensagem genérica.

Os tipos gerados do Prisma continuam exigindo `atleticaId` na criação: informe-o (do token, `@AtleticaAtual()` da #7, ou de `contexto.atleticaId()`). O preenchimento automático é rede de segurança.

**`Time` (regra especial):** leituras e escritas por `where` enxergam os times da atlética do contexto **e** os de atléticas adversárias sem app (`atletica.usaAplicativo = false`). `create` e `data` de `Time` (inclusive em `update*` e `upsert.update`) não são preenchidos nem conferidos, porque a atlética pode ser uma adversária: o service (#16) valida que é a ativa ou uma adversária e que um `update` não troca a atlética do time.

**Modelos sem escopo:** `Usuario`, `Atletica`, `Modalidade`, `PreferenciaNotificacao`, `DispositivoPush`, `Sessao`, `CodigoVerificacao`, `AceiteTermos`, `TentativaAcesso`, `NoticiaTag`. Todo modelo novo precisa ser classificado em `modelos-com-escopo.ts` (o `typecheck` falha se faltar).

**Transações:** `prisma.db.$transaction(async (tx) => ...)` e `$transaction([...])` também são filtradas. O tipo do `tx` é `TransacaoComEscopo` (`prisma.service.ts`).

**Exclusão lógica** (`excluidoEm`, só em `Evento`, `Noticia` e `Usuario`) **não** é filtrada pela extensão: filtre explicitamente com `naoExcluido` (`nao-excluido.ts`):

```ts
prisma.db.evento.findMany({ where: { ...naoExcluido, timeId } })
```

### Contexto (`ContextoAtletica`)

O middleware do `nestjs-cls` abre um contexto por requisição. O `JwtAuthGuard` (#7) chama `contexto.definir({ atleticaId, usuarioId })`; o resto do código lê `atleticaId()`, `usuarioId()` e `requestId()` (gravado pela #48).

Fora de uma requisição autenticada (login e cadastro antes do token, jobs, seed, rotas públicas), use `executarComAtletica`:

```ts
const eventos = await this.contexto.executarComAtletica(atleticaId, () =>
  this.prisma.db.evento.findMany({ where: naoExcluido }),
)
```

Ele abre um contexto próprio (herda `usuarioId`/`requestId` do externo, que volta intacto ao terminar) e **aguarda `fn` dentro do contexto** — necessário porque as consultas do Prisma são preguiçosas e só executam no `await`. Por isso, não devolva a consulta para executá-la fora: `executarComAtletica` sempre retorna uma `Promise`.

### Limitações conhecidas (épico #3 §10)

- **`include`/`select` aninhados não são filtrados.** Partindo de um registro já filtrado é seguro (os filhos pertencem à mesma atlética, garantido na escrita).
- **Escritas aninhadas** (`create` dentro de `data`) não são preenchidas nem conferidas: informe `atleticaId` explicitamente — a revisão de PR confere.
- **`$queryRaw`/`$executeRaw` não são filtrados:** inclua `"atleticaId" = ${atleticaId}` no SQL.
- **`upsert` em registro de outra atlética** não o altera, mas, como o `where` filtrado não o encontra, o Prisma executa o `create` na atlética do contexto. Se o `create` repetir um campo único, sai `P2002` → `409`. Para "não encontrado", use `update`.

## E-mail transacional (`src/infra/email`)

Importe `EmailModule` no módulo que envia e-mail. Ele exporta `EmailService`, `CodigoVerificacaoService` e o token `EmailProvider`.

### Enviar

```ts
import {
  renderizar,
  escaparHtml,
  type DadosEmail,
  type TemplateEmail,
} from '../../infra/email/templates/base'

interface DadosRecuperarSenha extends DadosEmail {
  codigo: string
}

// Um arquivo por template em src/infra/email/templates/ (ex.: recuperar-senha.ts).
export const recuperarSenha: TemplateEmail<DadosRecuperarSenha> = {
  assunto: ({ atletica }) => `Seu código para redefinir a senha — ${atletica.sigla}`,
  html: ({ codigo }) => `<p>Seu código: <strong>${escaparHtml(codigo)}</strong></p>`,
  texto: ({ codigo }) => `Seu código: ${codigo}`,
}

// No service: `atletica` vem do registro `Atletica` (nome, sigla, corPrimaria) — nada fixo no código.
const mensagem = { para: usuario.email, ...renderizar(recuperarSenha, { atletica, codigo }) }
void this.emailService.enviar(mensagem).catch(() => undefined) // sem aguardar; o erro já foi logado
```

- `renderizar(template, dados)` envolve o HTML no layout base (cabeçalho com sigla/nome e cor da atlética, rodapé) e monta a versão texto. O `html` do template devolve só o miolo; **escape todo dado interpolado** com `escaparHtml`.
- `EmailService.enviar({ para, assunto, html, texto })` usa `EMAIL_REMETENTE` como remetente. Em falha do provider: `logger.error` com o e-mail mascarado (`a***@ex.com`) e sem o conteúdo, `Sentry.captureException` e a promessa é rejeitada.
- Providers: `ResendEmailProvider` (SDK `resend`, timeout de 10 s), `FakeEmailProvider` (memória) e `LogEmailProvider` (loga destinatário e corpo em texto só com `NODE_ENV=development`; fora disso, só o destinatário mascarado e o assunto).

### Testes

Com `EMAIL_PROVIDER=fake` (padrão nos testes), pegue o fake pelo token:

```ts
const email = app.get<FakeEmailProvider>(EmailProvider)
email.limpar() // no beforeEach
expect(email.ultimos()).toEqual([expect.objectContaining({ para: 'ana@ex.com' })])
email.simularFalha() // próximos envios rejeitam (limpar() desfaz)
```

### Códigos de verificação

`CodigoVerificacaoService` (recuperação de senha #62, verificação de e-mail #31):

- `gerarCodigo()` — 6 dígitos com `crypto.randomInt`, zeros à esquerda (`"048213"`).
- `hashCodigo(usuarioId, codigo)` — `HMAC-SHA256(CODIGO_PEPPER, usuarioId + ":" + codigo)` em hex; é isto que vai para `CodigoVerificacao.codigoHash`.
- `codigoConfere(hash, usuarioId, codigo)` — comparação em tempo constante (`timingSafeEqual`).

O código em claro só existe no e-mail: nunca em log, URL, resposta ou Sentry. A única exceção é `EMAIL_PROVIDER=log` com `NODE_ENV=development`, que escreve o corpo do e-mail (com o código) no log para testar o fluxo localmente.

## Observabilidade (`src/infra/logs`, `src/infra/sentry`, `src/instrument.ts`)

### requestId

`request-id.middleware.ts` é o primeiro middleware: aceita o `X-Request-Id` do cliente (#52) **só se for UUID v4**; senão gera um. O valor volta no cabeçalho `X-Request-Id` da resposta, vai para o CLS (`contexto.requestId()`) e para **todo** log da requisição. Use-o para cruzar o erro do app com o log e o evento do Sentry.

### Log de acesso

Uma linha JSON por requisição (`pino-pretty` só com `NODE_ENV=development`), com `msg: "Requisição concluída"`:

| Campo                       | Origem                                                      |
| --------------------------- | ----------------------------------------------------------- |
| `service`, `env`, `version` | fixos: `"api"`, `APP_ENV`, `<versao>+<commit>`              |
| `requestId`                 | `X-Request-Id`                                              |
| `method`, `route`           | padrão da rota (`/api/v1/eventos/:id`), nunca a URL com IDs |
| `statusCode`, `durationMs`  | resposta                                                    |
| `usuarioId`, `atleticaId`   | contexto CLS, preenchido pelo `JwtAuthGuard` (#7)           |
| `appVersion`                | cabeçalho `X-App-Version` (#52)                             |

Nível: `info`; `warn` para 4xx; `error` para 5xx; `debug` para `GET /api/v1/health`.

- **Nunca** vão para o log: corpo da requisição/resposta, URL e query string, cabeçalhos.
- `redact` (`[REDACTED]`) em `authorization`, `cookie`, `senha`, `senhaAtual`, `novaSenha`, `confirmacaoSenha`, `refreshToken`, `accessToken`, `codigo`, `tokenPush` e `email`, no primeiro nível e um nível abaixo (`{ corpo: { senha } }`). Mais fundo que isso não é redigido: não logue objetos de entrada inteiros.
- Consultas Prisma acima de **500 ms** geram `warn` `"Consulta lenta"` com `modelo`, `operacao` e `durationMs`, sem os parâmetros.

**Onde ver na Railway:** serviço da API → aba _Deployments_ → _View logs_ (ou _Observability_). Filtre por `@requestId:<uuid>` ou `@level:50` (erros). A retenção é a do plano da Railway.

### Sentry

- `src/instrument.ts` é a **primeira linha** do `main.ts` e chama `Sentry.init` só se `SENTRY_DSN` estiver definida (lê o `.env` como o `ConfigModule`). Sem DSN, nada é enviado.
- `environment` = `APP_ENV`; `release` = `api@<versao>+<commit>` (commit de `RAILWAY_GIT_COMMIT_SHA`, `local` fora da Railway).
- **Só 5xx** vão ao Sentry, capturados pelo filtro global (`capturarErroHttp`) com tags `requestId`, `route`, `atleticaId` e usuário só com `id`. 4xx nunca.
- Dados pessoais: `dataCollection` mínimo (sem corpos, cookies, query string, variáveis locais dos frames, dados de usuário automáticos — o SDK 11 substituiu `sendDefaultPii` por essa opção) e `beforeSend` remove `request.data`, cookies e `Authorization`, troca e-mails por `[email]` em `message`, `extra` e na mensagem da exceção e deixa o usuário só com `id`.
- Jobs (`@nestjs/schedule` #58, pg-boss #86): capture o erro com `capturarErroJob(nome, erro, contexto)` (tag `job=<nome>`); `contexto` vai para `extra`, sem dado pessoal.
- Testes: `jest.mock('@sentry/nestjs', () => ({ captureException: jest.fn() }))`.

### Rota de diagnóstico

`GET /api/v1/diagnostico/erro` lança um erro inesperado (`500 INTERNAL_ERROR`) para conferir a chegada do evento ao Sentry (#93). Qualquer usuário autenticado acessa (guard global da #7). O módulo **não é registrado** com `APP_ENV=producao`: lá a rota responde `404`.
