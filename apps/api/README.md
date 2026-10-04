# API (NestJS)

Visão geral, scripts e primeiros passos no [README da raiz](../../README.md). Convenções em `docs/issues/00-convencoes.md`.

## Variáveis de ambiente

Validadas por `src/config/env.schema.ts` (Zod): a API não sobe com variável faltando ou inválida e a mensagem lista as variáveis com problema, sem os valores. Exemplo comentado em `.env.example`; nos testes os valores vêm de `.env.test.example` (veja [Testes](#testes)).

| Variável                    | Obrigatória                  | Descrição                                                                                                                  |
| --------------------------- | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `NODE_ENV`                  | não (`development`)          | `development \| test \| production`                                                                                        |
| `APP_ENV`                   | com `NODE_ENV=production`    | `local \| development \| homologacao \| producao` (padrão `local`)                                                         |
| `PORT`                      | não (`3000`)                 | Porta HTTP                                                                                                                 |
| `DATABASE_URL`              | sim                          | `postgresql://...`                                                                                                         |
| `LOG_LEVEL`                 | não (`info`)                 | Nível do pino                                                                                                              |
| `EMAIL_PROVIDER`            | sim                          | `resend` (homologação/produção — obrigatório com `NODE_ENV=production`), `fake` (testes), `log` (desenvolvimento)          |
| `RESEND_API_KEY`            | com `EMAIL_PROVIDER=resend`  | Chave da API do Resend (vazia conta como ausente)                                                                          |
| `EMAIL_REMETENTE`           | sim                          | Remetente, ex.: `"Atlética Lorde <nao-responda@dominio>"` (domínio verificado no Resend)                                   |
| `CODIGO_PEPPER`             | sim (≥ 32 caracteres)        | Segredo do HMAC dos códigos de verificação. Trocar o valor invalida os códigos pendentes                                   |
| `JWT_ACCESS_SECRET`         | sim (≥ 32 caracteres)        | Segredo HS256 do access token (#7), distinto por ambiente. Trocar o valor invalida os access tokens em circulação          |
| `R2_ACCOUNT_ID`             | sim (32 hexadecimais)        | Account ID da Cloudflare; endpoint S3 `https://<id>.r2.cloudflarestorage.com` (veja [Uploads](#uploads-srcmodulesuploads)) |
| `R2_ACCESS_KEY_ID`          | sim                          | Chave do token do R2 restrito ao bucket de imagens do ambiente (#92)                                                       |
| `R2_SECRET_ACCESS_KEY`      | sim                          | Segredo do mesmo token                                                                                                     |
| `R2_BUCKET_IMAGENS`         | sim                          | Bucket de imagens (`atletica-imagens-hml` / `atletica-imagens-prod`)                                                       |
| `R2_PUBLIC_BASE_URL`        | sim (https, sem barra final) | URL pública do bucket; as respostas expõem `fotoUrl` = `<base>/<fotoKey>`                                                  |
| `SENTRY_DSN`                | não                          | DSN do Sentry da API; ausente ou vazia = Sentry desligado (veja [Observabilidade](#observabilidade))                       |
| `SENTRY_TRACES_SAMPLE_RATE` | não (`0.1`)                  | Fração de traces de 0 a 1: `0.1` em produção, `1.0` em homologação                                                         |
| `GIT_COMMIT_SHA`            | não                          | Commit do build, injetado no `docker build` (veja [Docker](#docker)). Ausente = `RAILWAY_GIT_COMMIT_SHA` ou `desconhecido` |

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

| Utilitário                           | Uso                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `prismaTeste` (`prisma-teste.ts`)    | Cliente Prisma **base** (sem a extensão multi-atlética): enxerga todas as atléticas. Para preparar dados e conferir o banco; o código da API usa o `PrismaService` (#44).                                                                                                                                                                        |
| `limparBanco()` (`limpar-banco.ts`)  | `TRUNCATE ... RESTART IDENTITY CASCADE` em todas as tabelas do `public`, menos `_prisma_migrations` (lista lida de `pg_tables`). Já roda no `beforeEach`; chame direto só para limpar no meio de um teste.                                                                                                                                       |
| `criarApp(opcoes?)` (`criar-app.ts`) | Sobe o `AppModule` real com o `configurarApp` do `main.ts` e devolve `{ app, http }`. `opcoes.controllers` acrescenta controllers de teste; `opcoes.ajustar` recebe o `TestingModuleBuilder` (`overrideProvider`...). Antes de subir, esvazia o banco e cria a atlética padrão (`prepararAtleticaPadrao`), exigida pelo `AtleticaPadraoService`. |

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
- `prepararAtleticaPadrao(dados?)` — esvazia o banco e cria uma única atlética que usa o app (já chamado pelo `criarApp`). Como o `beforeEach` a apaga, testes que dependem dela a recriam com o id resolvido na subida: `criarAtletica({ id: app.get(AtleticaPadraoService).id() })`.
- `criarUsuario({ papel = 'ATLETA', atleticaId?, nome?, email?, ativo?, vinculoAtivo?, senhaHash? })` — cria o `Usuario` (e-mail único, gravado em minúsculas) e o `VinculoAtletica` com o papel. Sem `atleticaId`, cria uma atlética. Devolve o usuário com `atleticaId` e `vinculo`. `senhaHash` padrão é `SENHA_HASH_FICTICIO`, que não corresponde a nenhuma senha: para login real, passe um hash do `SenhaService` (#45).
- `proximaSequencia()` — número crescente para valores únicos nas fábricas.
- `tokenPara(usuario, { atleticaId?, sessao? })` (`auth.ts`) — cria uma `Sessao` ativa (ou usa a informada) e devolve um access token assinado com `token.config.ts` (`iss`/`aud` incluídos), igual ao que a #10 emitirá. `atleticaId` padrão: a do `criarUsuario`. Use em todo teste de rota protegida:

  ```ts
  const diretor = await criarUsuario({ papel: 'DIRETOR' })
  await request(http)
    .get('/api/v1/...')
    .set('Authorization', `Bearer ${await tokenPara(diretor)}`)
  ```

- `criarSessao({ usuarioId, atleticaId, ...campos })` (`auth.ts`) e `assinarToken(payload, opcoes?)` (`token.ts`, sem banco; serve também aos unitários) — para cenários de sessão revogada/expirada e de tokens inválidos (`{ secret }`, `{ algorithm }`; `{ issuer: undefined }` assina sem `iss`).
- `simularArmazenamento()` (`uploads.ts`) — R2 mockado: `{ s3: { send }, assinar, ajustar }`. Passe `ajustar` ao `criarApp`; por padrão o `HeadObject` responde um JPEG de 800 kB e o presigner, uma URL fictícia. Use em todo teste que passe pelo `UploadsService` (`s3.send.mockRejectedValueOnce(new NotFound(...))` simula upload não concluído).
- Cada issue de domínio cria as suas em `test/fabricas/<dominio>.ts` (ex.: `eventos.ts` na #70).

### Suítes de infraestrutura

- `test/infraestrutura/` — testes dos próprios utilitários (`limparBanco`, fábricas, `criarApp`, proteção do `globalSetup`).
- `test/prisma/constraints.e2e-spec.ts` — um caso aceito e um rejeitado para cada constraint da migration `init` (épico #3 §8.3), conferindo o nome da constraint violada, e a estrutura da migration (tabelas, enums, índices e `CHECK`). Toda constraint nova em SQL entra aqui.
- `test/prisma/extensao-atletica.e2e-spec.ts` — extensão multi-atlética: cada operação com contexto A e dados de A e B, regra de `Time`, transações, falta de contexto e o `500` numa rota.
- `test/auditoria/auditoria.e2e-spec.ts` e `test/eventos/eventos-dominio.e2e-spec.ts` — atomicidade da auditoria, lotes, imutabilidade (extensão e trigger) e eventos só após o commit.

### Eventos (`test/eventos.ts`)

- `espiarEventos(app)` — spy no `EventEmitter2`; chame no `beforeEach` (reaproveita o spy e o limpa). `emitidos()` devolve `{ nome, payload }[]` na ordem; `nomes()`, só os nomes. Use para conferir "emitido só após o commit" e "nada emitido em rollback/4xx" (convenções §9).
- `aguardarOuvintes()` — uma volta do event loop, para ouvintes `{ async: true }` sem I/O. Se o ouvinte consulta o banco, espere uma promessa resolvida pelo próprio ouvinte de teste (ver `test/eventos/eventos-dominio.e2e-spec.ts`).

## Autenticação e autorização (`src/modules/auth`)

Toda rota exige access token por padrão (RN03). Dois guards globais, nesta ordem:

1. **`JwtAuthGuard`** — lê `Authorization: Bearer <token>`, verifica HS256 com `iss`/`aud` (`token.config.ts`) e faz **uma** consulta via `semEscopo` (sessão + usuário + vínculo da atlética `atl`), sem cache: logout, desativação e troca de papel valem na requisição seguinte. Em caso de sucesso preenche `request.usuario` e chama `contexto.definir({ atleticaId, usuarioId })`, ativando o filtro do `prisma.db`.
2. **`PapelGuard`** — confere `@PapelMinimo` com o papel lido pelo guard anterior.

| Falha                                                                                                                                                             | Resposta               |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| sem token, token inválido, `iss`/`aud`/payload errados, sessão revogada/expirada/de outro usuário, conta excluída ou `Usuario.ativo=false`, sem vínculo com `atl` | `401 UNAUTHENTICATED`  |
| `exp` vencido há 10 s ou mais                                                                                                                                     | `401 TOKEN_EXPIRED`    |
| `VinculoAtletica.ativo = false`                                                                                                                                   | `401 CONTA_DESATIVADA` |
| papel abaixo do `@PapelMinimo`                                                                                                                                    | `403 FORBIDDEN`        |

### Decorators

| Decorator                     | Uso                                                                                                                           |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `@Publico()`                  | Rota (ou controller) sem token e **sem** contexto de atlética. Só para as rotas públicas da convenção §4.7; justifique no PR. |
| `@PapelMinimo(Papel.DIRETOR)` | Nível mínimo; a hierarquia libera os superiores (`PRESIDENTE` inclui o Vice). Sem ele, qualquer autenticado.                  |
| `@UsuarioAtual()`             | Parâmetro `UsuarioAutenticado`; `@UsuarioAtual('id')` devolve um campo. `undefined` em rota pública.                          |
| `@AtleticaAtual()`            | Parâmetro com o `atleticaId` do contexto da requisição. Em rota pública é erro de programação (500).                          |

```ts
interface UsuarioAutenticado {
  id: string
  nome: string
  email: string
  atleticaId: string // `atl` do token
  sessaoId: string // `sid` do token
  papel: Papel // lido do VinculoAtletica a cada requisição
  nivel: 1 | 2 | 3 | 4
}
```

```ts
@Controller('eventos')
export class EventosController {
  @Get() // qualquer autenticado
  listar() {}

  @Post()
  @PapelMinimo(Papel.DIRETOR)
  criar(@Body() dto: CriarEventoDto, @UsuarioAtual() usuario: UsuarioAutenticado) {}
}
```

- Regras que dependem do recurso (posse, `podeAgirSobre` do shared) ficam no **service**; os guards só tratam autenticação e nível mínimo.
- `401` é exclusivo da autenticação do token: senha atual errada numa rota autenticada é `400 SENHA_INCORRETA`.
- Hierarquia e rótulos (`NIVEL_PAPEL`, `temNivelMinimo`, `podeAgirSobre`, `ehDiretoria`, `ehPresidencia`, `ehAdministrador`, `ROTULO_PAPEL`) ficam em `@atletica/shared` (`src/auth/papeis.ts`).
- Swagger: toda rota não pública recebe o cadeado e a resposta 401 (`swagger.ts`); `@PapelMinimo` acrescenta a 403.

### Cadastro e login (`AuthController`, `AuthService`)

`POST /api/v1/auth/cadastro` (201) e `POST /api/v1/auth/login` (200), ambas `@Publico()` e `Cache-Control: no-store`. Entrada validada por `cadastroSchema`/`loginSchema` (`@atletica/shared`, `.strict()`: campo desconhecido → 400). Resposta única, também usada pelo refresh (#58) via `RespostaSessaoService.montar(usuario, sessao)` (assina o access token; `fotoUrl` = `R2_PUBLIC_BASE_URL/fotoKey`):

```ts
{ accessToken, refreshToken, accessTokenExpiraEm, usuario: { id, nome, email, fotoUrl, papel, atleticaId } }
```

- **Cadastro:** limite de 10 tentativas por IP na hora (`CADASTRO`, chave `chaveCadastro(ip)`, contadas antes da validação para não facilitar a enumeração de e-mails); `versaoTermos ≠ TERMOS_VERSAO` → `409 TERMOS_DESATUALIZADOS`; e-mail existente → `409 EMAIL_JA_CADASTRADO` (checagem prévia e `P2002`, para corrida). Uma transação cria `Usuario`, `VinculoAtletica` (`ATLETA`, atlética padrão), `PreferenciaNotificacao`, `AceiteTermos` e `Sessao`; após o commit emite `usuario.cadastrado`.
- **Login:** chave do limite `chaveLogin(email, ip)` = `email|ip`, 5 falhas em 15 min → `429` por 15 min (`Retry-After`); a 4ª falha avisa "Última tentativa antes do bloqueio.". E-mail inexistente verifica um hash fictício (mesmo tempo da senha errada) e responde o mesmo `401 CREDENCIAIS_INVALIDAS`. `401 CONTA_DESATIVADA` só com a senha correta. Hash com parâmetros antigos é refeito (`precisaRefazerHash`).
- **Tokens:** `TokenAcessoService.assinar({ sub, atl, sid })` (HS256, 15 min, `iss`/`aud`); `SessaoService.criar(tx, { usuarioId, atleticaId, userAgent?, ip? })` devolve `{ sessaoId, refreshToken }` com `refreshToken = <sessaoId>.<segredo>` (32 bytes base64url); no banco fica só `hashSegredo(segredo)` (SHA-256 hex), `expiraEm = agora + 30 dias`.

### Limite de tentativas (`RateLimitService`)

Único mecanismo de limite do projeto (convenções §4.6, §11.3; nada de `@nestjs/throttler`), persistido em `TentativaAcesso`. Exportado pelo `AuthModule`:

```ts
verificar(tipo, chave, { maximo, janelaMs, bloqueioMs? }, agora?): Promise<number> // tentativas restantes
registrar(tipo, chave, agora?): Promise<void>
consumir(tipo, chave, limite, agora?): Promise<number> // verificar + registrar atômicos
limpar(tipo, chave): Promise<void>
```

- Bloqueado quando as `maximo` tentativas mais recentes cabem em `janelaMs`: sem `bloqueioMs`, até a mais antiga delas sair da janela (janela deslizante, ex.: 10 cadastros/h); com `bloqueioMs`, até `última + bloqueioMs` (login: 15 min após a 5ª falha). `verificar` lança `ErroLimiteExcedido` → `429 RATE_LIMITED` com `Retry-After` em segundos (o filtro global põe o cabeçalho).
- Fluxo: `consumir` quando toda tentativa conta (cadastro: `verificar` + `registrar` sob `pg_advisory_xact_lock`, sem furo com requisições simultâneas); `verificar` antes e `registrar` depois do resultado (login registra a falha; presign registra a URL emitida, nunca a falha do R2); `limpar` quando o sucesso zera a contagem.
- `tipo` ∈ `TipoTentativa`: `LOGIN_FALHA`, `CADASTRO`, `RECUPERACAO_ENVIO`, `CODIGO_TENTATIVA`, `SENHA_CONFIRMACAO_FALHA`, `PRESIGN`, `VERIFICACAO_ENVIO`, `AVISO_ENVIO`. Tipo novo: acrescente ao catálogo (sem migration; `VarChar(30)`). `chave` até 300 caracteres (ex.: `email|ip`, `usuarioId`).

## Uploads (`src/modules/uploads`)

Imagens vão do app direto ao Cloudflare R2 por URL `PUT` pré-assinada (épico #9); a API nunca recebe os bytes. As entidades guardam só a **chave** (`fotoKey`, `imagemCapaKey`, `imagemKey`) e as respostas expõem a URL pública.

### `POST /api/v1/uploads/presign`

Qualquer autenticado; `NOTICIA` e `BANNER` exigem DIRETOR (conferido no service, `403 FORBIDDEN`). Corpo `presignRequestSchema` (`@atletica/shared`, `.strict()`): `{ finalidade, contentType: image/jpeg|png|webp, tamanhoBytes: 1–5.242.880 }`. Resposta `201 { uploadUrl, key, publicUrl, expiresAt }`, com `Cache-Control: no-store`.

- A API gera a chave (o app nunca a escolhe), com a extensão derivada do `contentType`:

  | Finalidade | Chave                                                      |
  | ---------- | ---------------------------------------------------------- |
  | `PERFIL`   | `usuarios/{usuarioId}/perfil/{uuid}.{ext}`                 |
  | `NOTICIA`  | `atleticas/{atleticaId}/noticias/{usuarioId}/{uuid}.{ext}` |
  | `BANNER`   | `atleticas/{atleticaId}/banners/{usuarioId}/{uuid}.{ext}`  |

- A URL vale 300 s e assina `content-type` e `content-length`: o `PUT` (sem `Authorization`) precisa enviar exatamente o tipo e o tamanho declarados.
- Limite: 30 presigns por usuário por hora (`RateLimitService`, tipo `PRESIGN`, chave `usuarioId`) → `429 RATE_LIMITED` com `Retry-After`. Só a URL emitida conta.
- Falha ao assinar (credenciais, R2) → `503 ARMAZENAMENTO_INDISPONIVEL`, sem contar no limite.
- O `S3Client` (`armazenamento.ts`: endpoint `https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com`, `region: 'auto'`, path-style) e o presigner (token `ASSINAR_URL`) são providers; nos testes, `simularArmazenamento()` os troca por mocks.

### `UploadsService` (para os recursos com imagem)

Importe o `UploadsModule` e injete o `UploadsService`:

```ts
validarKey({ key, finalidade, usuarioId, atleticaId }): Promise<void>
urlPublica(key: string | null): string | null // `${R2_PUBLIC_BASE_URL}/${key}`
remover(key: string): Promise<void>
```

- **`validarKey`** é o único validador (não existem `confirmar` nem `validarChave`). Na ordem: formato da finalidade (regex estrita: sem `..`, barra extra ou chave de outra finalidade), `usuarioId` do caminho = usuário atual, `atleticaId` do caminho = atlética do token (`NOTICIA`/`BANNER`) e `HeadObject` (existe, ≤ 5 MB, tipo permitido). Falhas: `422 UPLOAD_INVALIDO` "Imagem inválida. Envie a imagem novamente." ou, se o objeto não existe, `422 UPLOAD_NAO_ENCONTRADO` "O envio da imagem não foi concluído. Tente novamente.". R2 inacessível → `503 ARMAZENAMENTO_INDISPONIVEL`.
- **Só chame `validarKey` quando a chave mudar** (diferente da gravada): um diretor que edita a notícia de outro mantém a capa sem revalidar a posse.
- **`remover`** é de melhor esforço (a falha só gera `warn`; a limpeza de órfãos da #56 recolhe o objeto). Chame-o **depois do commit**, via `aposCommit`, nunca dentro da transação:

```ts
if (fotoKey !== anterior) {
  await this.uploads.validarKey({ key: fotoKey, finalidade: 'PERFIL', usuarioId, atleticaId })
}
await this.transacao.executar(async (tx) => {
  await tx.usuario.update({ where: { id: usuarioId }, data: { fotoKey } })
  if (anterior && anterior !== fotoKey) aposCommit(() => this.uploads.remover(anterior))
})
return { fotoUrl: this.uploads.urlPublica(fotoKey) }
```

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

### Seed (`prisma/seed.ts`)

```bash
pnpm --filter @atletica/shared build   # o seed usa o senhaSchema do shared
pnpm --filter api prisma:deploy        # banco com as migrations
pnpm --filter api prisma:seed          # lê SEED_* do apps/api/.env (ou do ambiente)
```

Idempotente: pode rodar quantas vezes quiser, sem duplicar nem sobrescrever o que existe.

1. **Atlética Lorde** (`slug = 'lorde'`), única com `usaAplicativo = true`: o seed falha se encontrar outra.
2. **Administrador inicial** (`SEED_ADMIN_EMAIL`, `SEED_ADMIN_NOME`, `SEED_ADMIN_SENHA`, obrigatórias e validadas antes de gravar qualquer coisa; a senha segue o `senhaSchema`). Criado só se a Lorde não tiver vínculo `ADMINISTRADOR`; a senha de um admin existente **nunca** é alterada.
3. **Modalidades básicas** — as que já existem (mesmo nome, sem diferenciar maiúsculas) ficam como estão.
4. **Demonstração** (`SEED_DEMO=true`): adversária, dois times, eventos, notícias e um usuário por papel (`<papel>@demo.exemplo.com.br`, senha `lorde2026`). Recusado com `APP_ENV=producao`.

Em **produção** o seed é executado uma única vez, por uma pessoa, na implantação (#92) — nunca no deploy automático.

## Auditoria (`src/modules/auditoria`)

`AuditoriaService` (global) é o **único** meio de gravar `RegistroAuditoria`, sempre **na mesma transação** da alteração (convenções §7): se a auditoria falha, a alteração é desfeita, e vice-versa.

```ts
await this.transacao.executar(async (tx) => {
  const antes = await tx.evento.findUniqueOrThrow({ where: { id } })
  const depois = await tx.evento.update({ where: { id }, data: dto })
  const diff = diferenca(antes, depois, ['inicio', 'local', 'observacoes', 'timeAdversarioId'])
  if (!diff) return // sem mudança: 200 sem auditoria nem evento
  await this.auditoria.registrar(tx, {
    acao: 'EVENTO_ALTERADO',
    entidade: 'Evento',
    entidadeId: id,
    dados: diff,
  })
  this.eventos.emitirAposCommit('evento.alterado', {
    atleticaId,
    eventoIds: [id],
    timeId,
    campos,
    autorId,
  })
})
```

- **`registrar(tx, { acao, entidade, entidadeId, dados, usuarioId? })`** — `tx` é obrigatório e precisa ser o cliente da transação (`prisma.db` não compila). `acao` e `entidade` vêm do catálogo `ACOES_POR_ENTIDADE` de `@atletica/shared` (`src/auditoria/acoes.ts`): combinação fora dele não compila. `atleticaId` e `requestId` vêm do contexto; o ator (`usuarioId`) também, e sem usuário no contexto é obrigatório passar `usuarioId: null` (ação do sistema, jobs) — senão lança `ErroAuditoria`.
- **`registrarVarios(tx, entradas)`** — mesmas regras, um `createMany` (um `INSERT`) por lote de 500. Use em operações sobre muitos registros (ex.: "esta e as seguintes" numa série).
- **`dados = { antes, depois, contexto? }`**: criação → `antes: null`; exclusão → `depois: null`; alteração → só os campos alterados, calculados por `diferenca(antes, depois, campos?)` (datas por `getTime()`, arrays e objetos por igualdade profunda, ignora `criadoEm`/`atualizadoEm`; `null` se nada mudou). Alteração com `antes` e `depois` vazios (inclusive depois de sanitizar) não grava; criação e exclusão sempre gravam. `contexto` guarda ids auxiliares (`{ serieId, escopo }`, `{ timeId, usuarioId, ... }`).
- **Só ids e valores de domínio.** `sanitizar` remove, em qualquer nível e com `warn` no log (só os caminhos), `senhaHash`, `refreshTokenHash`, `refreshTokenAnteriorHash`, `codigoHash`, `tokenPush`, `email`, `nome`, `fotoKey`, `ip`, `userAgent`, `accessToken`, `refreshToken` e qualquer `*Hash`. `nome` é mantido só em `antes.nome`/`depois.nome` de `Modalidade`, `Atletica` e `Time`, onde é dado da própria entidade; em `contexto` ou aninhado, é removido. Pessoas sempre por `usuarioId`.
- **Máximo de 16 KB** por registro serializado (`ErroAuditoria` acima disso): para textos longos (notícias), registre indicadores como `{ conteudoAlterado: true }`.
- **Imutável:** a extensão `src/infra/prisma/extensao-auditoria-imutavel.ts` (nos dois clientes do `PrismaService`) rejeita `update*`, `upsert` e `delete*` com `ErroAuditoriaImutavel`, e o trigger `registro_auditoria_imutavel` (migration `auditoria_imutavel`) bloqueia `UPDATE`/`DELETE` em SQL cru. `TRUNCATE` (limpeza dos testes) não é afetado.
- **Nova ação:** PR alterando `ACOES_POR_ENTIDADE` e a convenção §7 (sem migration: as colunas são `VARCHAR(40)`), com o rótulo correspondente (#39).

### Operações obrigatórias

Toda ação do catálogo é gravada pela issue indicada na convenção §7, e o teste da issue confere o registro: modalidades (#15), adversárias, times e capitão (#16), elenco (#16, #18, #12, #34), solicitações avaliadas (#18), eventos (#19, #21), séries (#20), presenças (#35), notícias (#26), banners (#33), desativação, reativação e cargo (#27, #28), exclusão de conta (#12, um registro por atlética) e avisos (#38, entidade `Aviso` com UUID gerado).

**Sem auditoria:** perfil (#13), participação do atleta (#24), preferências (#37), consulta (#39) e criação/cancelamento de solicitação pelo atleta (#18). Operação sem mudança responde 200 sem registro.

## Eventos de domínio (`src/infra/eventos`)

`EventosModule` (global) registra o `EventEmitterModule` uma única vez e exporta `TransacaoService` e `EventosDominioService` (convenções §8).

- **`TransacaoService.executar(fn)`** — wrapper de `prisma.db.$transaction` que abre uma unidade no CLS. **Toda operação que emite evento ou agenda efeito externo usa `executar`**, não `$transaction` direto. Dentro de outro `executar` (ex.: `ElencoService.encerrarVinculo` na exclusão de conta), reutiliza a transação externa com uma fila própria: se a `fn` interna lança, os callbacks dela são descartados (mesmo que a externa capture o erro e confirme); se conclui, entram na fila externa e só rodam no commit externo.
- **`aposCommit(callback)`** — agenda o callback para depois do commit (ex.: remover arquivo do R2, enviar e-mail). Os callbacks rodam em segundo plano, na ordem de registro, sem atrasar o retorno de `executar` nem a resposta; erro em um é logado (`logger.error`) e não impede os seguintes. Nos testes, espere o efeito (ex.: `aguardarOuvintes()` ou uma promessa resolvida pelo próprio callback). Em rollback, a fila é descartada. Fora de `executar`, lança `ErroForaDeTransacao`.
- **`EventosDominioService.emitirAposCommit(nome, payload)`** — único meio de emitir evento de domínio (usa `aposCommit`). Um evento por operação, mesmo em lote. Nada é emitido em rollback, 4xx ou operação sem mudança.
- **Ouvintes:** `@OnEvent('evento.alterado', { async: true })`. Erros são capturados e logados pelo `@nestjs/event-emitter`, sem afetar a requisição. Perda em queda do processo é aceita (sem outbox).

### Acrescentar um evento

Cada issue emissora acrescenta o seu ao mapa `EventosDominio` (`eventos-dominio.ts`), conforme a tabela da convenção §8. Todo payload estende `PayloadBase` (`autorId: string | null`, `null` = sistema; `atleticaId` quando aplicável):

```ts
export interface EventosDominio {
  'evento.alterado': PayloadBase & {
    atleticaId: string
    eventoIds: string[]
    timeId: string
    campos: ('inicio' | 'local' | 'status')[]
  }
}
```

Nome fora do mapa ou payload com tipo errado (ou sem `autorId`) falha no `pnpm typecheck`.

## Atlética padrão (`src/modules/atleticas`)

Enquanto só uma atlética usa o app (seção 8.4), a atlética padrão é a **única** `Atletica` com `usaAplicativo = true`. O `AtleticaPadraoService` a resolve no `onModuleInit` e guarda o `id` em memória; com zero ou mais de uma, a API **não sobe** e o log explica o motivo (`ErroAtleticaPadrao`, convenções §6). A consulta usa `prisma.db`: `Atletica` não tem escopo, e `semEscopo` é proibido em `modules/atleticas` (convenções §3).

Importe `AtleticasModule` e injete `AtleticaPadraoService`:

- `id()` — id da atlética padrão. Usado pelo cadastro/login (#57) para criar o `VinculoAtletica` e definir o `atl` do token, e por rotas públicas que leem modelos com escopo: `contexto.executarComAtletica(atleticaPadrao.id(), () => ...)`.
- `obter()` — marca e contato público (`AtleticaPublica` de `@atletica/shared`), lidos do banco a cada chamada: mudanças valem sem reiniciar a API.

### `GET /api/v1/atletica`

Pública (`@Publico()`): a tela de login já usa a marca. Resposta validada por `atleticaPublicaSchema` (todos os campos sempre presentes, nulos como `null`; nunca `usaAplicativo`, datas internas ou vínculos). `Cache-Control: public, max-age=300`; o `ETag` e o `304` com `If-None-Match` vêm do Express. Sem rate limit (convenções §4.6).

## Senhas (`src/infra/senha`)

Importe `SenhaModule` e injete `SenhaService`: `hash(senha)` (Argon2id, `@node-rs/argon2`, parâmetros em `senha.config.ts` — convenções §5) e `verificar(hash, senha)` (`false` também para hash malformado); `precisaRefazerHash(hash)` indica hash gerado com outros parâmetros (refeito no login). Valide a entrada com `senhaSchema` de `@atletica/shared` (política do UC06), sem redefini-la.

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
- `redact` (`[REDACTED]`) em `authorization`, `cookie`, `senha`, `senhaAtual`, `novaSenha`, `confirmacaoSenha`, `refreshToken`, `accessToken`, `codigo`, `tokenPush` e `email`, no primeiro nível e um nível abaixo (`{ corpo: { senha } }`), além de `req.body.senha`, `req.body.refreshToken`, `res.body.accessToken` e `res.body.refreshToken` (#57; `test/auth/logs-sem-segredos.e2e-spec.ts` garante que senha e tokens não aparecem no log). Mais fundo que isso não é redigido: não logue objetos de entrada inteiros.
- Consultas Prisma acima de **500 ms** geram `warn` `"Consulta lenta"` com `model`, `operation` e `durationMs`, sem os parâmetros.

**Onde ver na Railway:** serviço da API → aba _Deployments_ → _View logs_ (ou _Observability_). Filtre por `@requestId:<uuid>` ou `@level:50` (erros). A retenção é a do plano da Railway.

### Sentry

- `src/instrument.ts` é a **primeira linha** do `main.ts` e chama `Sentry.init` só se `SENTRY_DSN` estiver definida (lê o `.env` como o `ConfigModule`). Sem DSN, nada é enviado.
- `environment` = `APP_ENV`; `release` = `api@<versao>+<commit>` (7 primeiros caracteres de `GIT_COMMIT_SHA`, ou de `RAILWAY_GIT_COMMIT_SHA`; `desconhecido` sem nenhuma das duas).
- **Só 5xx** vão ao Sentry, capturados pelo filtro global (`capturarErroHttp`) com tags `requestId`, `route`, `atleticaId` e usuário só com `id`. 4xx nunca.
- Dados pessoais: `dataCollection` mínimo (sem corpos, cookies, query string, variáveis locais dos frames, dados de usuário automáticos — o SDK 11 substituiu `sendDefaultPii` por essa opção) e `beforeSend` remove `request.data`, cookies e `Authorization`, troca e-mails por `[email]` em `message`, `extra` e na mensagem da exceção e deixa o usuário só com `id`.
- Jobs (`@nestjs/schedule` #58, pg-boss #86): capture o erro com `capturarErroJob(nome, erro, contexto)` (tag `job=<nome>`); `contexto` vai para `extra`, sem dado pessoal.
- Testes: `jest.mock('@sentry/nestjs', () => ({ captureException: jest.fn() }))`.

### Rota de diagnóstico

`GET /api/v1/diagnostico/erro` lança um erro inesperado (`500 INTERNAL_ERROR`) para conferir a chegada do evento ao Sentry (#93). Qualquer usuário autenticado acessa (guard global da #7). O módulo **não é registrado** com `APP_ENV=producao`: lá a rota responde `404`.

## Health, proxy e encerramento (`src/modules/health`, `src/configurar-app.ts`)

### `GET /api/v1/health`

Público (`@Publico()`), usado pelo healthcheck do deploy e pelo monitor de uptime. Executa `SELECT 1` via `prisma.semEscopo` com timeout de **2 s** e responde com `Cache-Control: no-store`:

| Situação         | Status | Corpo                                                                             |
| ---------------- | ------ | --------------------------------------------------------------------------------- |
| banco responde   | `200`  | `{ "status": "ok", "versao": "0.0.0", "commit": "a1b2c3d", "banco": "ok" }`       |
| falha ou timeout | `503`  | `{ "status": "erro", "versao": "...", "commit": "...", "banco": "indisponivel" }` |

- `versao` vem do `package.json` da API; `commit`, dos 7 primeiros caracteres de `GIT_COMMIT_SHA` (ou `RAILWAY_GIT_COMMIT_SHA`; `desconhecido` sem nenhuma das duas).
- O `503` **não** usa o formato de erro padrão (é lido por monitores, não pelo app) e não expõe o motivo da falha, que vai só para o log (`warn`).
- O log de acesso da rota é `debug` (veja [Log de acesso](#log-de-acesso)).

### `trust proxy`

`configurarApp` liga `trust proxy` com **1 salto** (`SALTOS_PROXY_CONFIAVEIS`): a borda da Railway. `req.ip` é o último IP do `X-Forwarded-For`, o adicionado pelo proxy; IPs que o cliente forjar antes dele são ignorados. Se surgir outro proxy na frente (CDN), aumente o número.

### Encerramento

`enableShutdownHooks()` faz o `SIGTERM` do deploy chamar `app.close()`: o servidor HTTP para de aceitar conexões e o `PrismaService` desconecta (teste em `test/health/health.e2e-spec.ts`; `docker stop` termina com código 0).

## Docker

`apps/api/Dockerfile`, multi-stage, com contexto na **raiz do monorepo** (`.dockerignore` na raiz):

- `build`: `pnpm install --frozen-lockfile` só da API e do shared, client Prisma, build dos dois e `pnpm deploy --prod` para uma árvore enxuta. O `prisma.config.ts` é transpilado para `prisma.config.mjs`.
- `runtime`: `node:24-slim` + OpenSSL, usuário `node`, `NODE_ENV=production`, `HEALTHCHECK` no `/health`, `CMD ["node", "dist/main.js"]`. Leva `dist/`, as dependências de produção, `prisma/schema.prisma` e `prisma/migrations` — sem fontes `.ts`, devDependencies ou `.env`.
- `prisma` e `dotenv` são dependências de produção para o `migrate deploy` rodar dentro da imagem (pre-deploy, #47), com o `schema-engine` já incluído (sem download na hora).
- Tamanho: ~1 GB descompactado, quase todo do CLI do Prisma e do `@sentry/nestjs`. É o custo de rodar o `migrate deploy` de dentro da imagem.

```bash
# na raiz; GIT_COMMIT_SHA vira o "commit" do /health
docker build -f apps/api/Dockerfile --build-arg GIT_COMMIT_SHA=$(git rev-parse HEAD) -t atletica-api .
# ou: GIT_COMMIT_SHA=$(git rev-parse HEAD) pnpm --filter api docker:build

# confere não-root, sem .env, sem .ts e sem devDependencies
pnpm --filter api docker:verificar

# contra o Postgres do compose (pnpm db:up); NODE_ENV=production exige APP_ENV e EMAIL_PROVIDER=resend
docker run --rm -e DATABASE_URL=postgresql://atletica:atletica@host.docker.internal:5432/atletica_dev \
  atletica-api node node_modules/prisma/build/index.js migrate deploy
docker run --rm -p 3000:3000 \
  -e DATABASE_URL=postgresql://atletica:atletica@host.docker.internal:5432/atletica_dev \
  -e APP_ENV=homologacao -e EMAIL_PROVIDER=resend -e RESEND_API_KEY=re_ficticia \
  -e EMAIL_REMETENTE="Atlética <nao-responda@exemplo.com.br>" \
  -e CODIGO_PEPPER=troque-por-um-segredo-aleatorio-de-32-caracteres-ou-mais \
  -e JWT_ACCESS_SECRET=troque-por-um-segredo-aleatorio-de-32-caracteres-ou-mais \
  -e R2_ACCOUNT_ID=0123456789abcdef0123456789abcdef -e R2_ACCESS_KEY_ID=ficticia \
  -e R2_SECRET_ACCESS_KEY=ficticia -e R2_BUCKET_IMAGENS=atletica-imagens-hml \
  -e R2_PUBLIC_BASE_URL=https://imagens.exemplo.com.br \
  atletica-api
curl http://localhost:3000/api/v1/health
```

No Linux, acrescente `--add-host=host.docker.internal:host-gateway` aos `docker run`.

Na Railway, `apps/api/railway.json` define o build por este Dockerfile, o pre-deploy `node node_modules/prisma/build/index.js migrate deploy` e o healthcheck em `/api/v1/health`. O deploy é feito pelo workflow `deploy-api.yml` (runbook em `docs/runbooks/infra-railway-r2.md`).
