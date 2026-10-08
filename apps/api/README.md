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

`POST /api/v1/auth/cadastro` (201) e `POST /api/v1/auth/login` (200), ambas `@Publico()` e `Cache-Control: no-store`. Entrada validada por `cadastroSchema`/`loginSchema` (`@atletica/shared`, `.strict()`: campo desconhecido → 400). Resposta única, também usada pelo refresh via `RespostaSessaoService.montar(usuario, sessao)` (assina o access token; `fotoUrl` = `R2_PUBLIC_BASE_URL/fotoKey`):

```ts
{ accessToken, refreshToken, accessTokenExpiraEm, usuario: { id, nome, email, fotoUrl, papel, atleticaId } }
```

- **Cadastro:** limite de 10 tentativas por IP na hora (`CADASTRO`, chave `chaveCadastro(ip)`, contadas antes da validação para não facilitar a enumeração de e-mails); `versaoTermos ≠ TERMOS_VERSAO` → `409 TERMOS_DESATUALIZADOS`; e-mail existente → `409 EMAIL_JA_CADASTRADO` (checagem prévia e `P2002`, para corrida). Uma transação cria `Usuario`, `VinculoAtletica` (`ATLETA`, atlética padrão), `PreferenciaNotificacao`, `AceiteTermos` e `Sessao`; após o commit emite `usuario.cadastrado`.
- **Login:** chave do limite `chaveLogin(email, ip)` = `email|ip`, 5 falhas em 15 min → `429` por 15 min (`Retry-After`); a 4ª falha avisa "Última tentativa antes do bloqueio.". E-mail inexistente verifica um hash fictício (mesmo tempo da senha errada) e responde o mesmo `401 CREDENCIAIS_INVALIDAS`. `401 CONTA_DESATIVADA` só com a senha correta. Hash com parâmetros antigos é refeito (`precisaRefazerHash`).
- **Tokens:** `TokenAcessoService.assinar({ sub, atl, sid })` (HS256, 15 min, `iss`/`aud`); `SessaoService.criar(tx, { usuarioId, atleticaId, userAgent?, ip? })` devolve `{ sessaoId, refreshToken }` com `refreshToken = <sessaoId>.<segredo>` (32 bytes base64url); no banco fica só `hashSegredo(segredo)` (SHA-256 hex), `expiraEm = agora + 30 dias`.

### Refresh e logout (`SessaoService`)

`POST /api/v1/auth/refresh` (200, `Cache-Control: no-store`) e `POST /api/v1/auth/logout` (204), ambas `@Publico()` com corpo `{ refreshToken }` (`refreshTokenSchema`).

- **Refresh:** `UPDATE` condicional atômico (hash atual, não revogada, não expirada) grava o hash novo, `refreshTokenAnteriorHash`, `rotacionadaEm` e `expiraEm = agora + 30 dias`, e responde o mesmo contrato do login. Sem linha afetada, a releitura decide: formato inválido, inexistente ou expirada → `401 REFRESH_INVALIDO`; revogada → `401 SESSAO_REVOGADA`; token anterior há menos de 30 s → `401 REFRESH_JA_ROTACIONADO` (sem revogar); qualquer outro → revoga com `REUSO_REFRESH`, `warn` no log e `401 SESSAO_REVOGADA`. Usuário ou vínculo inativo → revoga com `CONTA_DESATIVADA` e `401 CONTA_DESATIVADA`; conta excluída → revoga com `CONTA_EXCLUIDA` e `401 REFRESH_INVALIDO`. O schema aceita qualquer texto em `refreshToken` (formato conferido aqui); campo desconhecido ou ausente → `400 VALIDATION_ERROR`. As revogações são gravadas antes do `401`.
- **Logout:** sempre `204` (inclusive token vazio ou malformado); o token atual ou o anterior de uma sessão não revogada a revoga com `LOGOUT`.
- **Evento:** toda revogação desta issue emite `usuario.sessaoEncerrada { usuarioId, sessaoIds: [sid], motivo, autorId }` após o commit (`autorId` = usuário no logout, `null` no reuso e na conta desativada ou excluída).

Exportado pelo `AuthModule` para #62, #12, #13 e #27:

```ts
revogarTodas(tx, usuarioId, motivo, { exceto?, atleticaId? }?, agora?): Promise<string[]>
revogar(tx, sessaoId, motivo, agora?): Promise<boolean>
```

Quem chama `revogarTodas` emite `usuario.sessaoEncerrada` com a lista devolvida como `sessaoIds`, e só se ela não for vazia (convenções §11.8). `motivo` ∈ `MotivoRevogacao` (`eventos-dominio.ts`).

### Recuperação de senha (`RecuperacaoSenhaService`)

Rotas `@Publico()` do `AuthController` (UC09, épico #11), entrada pelos schemas `esqueciSenhaSchema`, `verificarCodigoSchema` e `redefinirSenhaSchema` (`@atletica/shared`, `.strict()`):

| Rota                                                        | Resposta                         | Faz                                                                                                                                                                                                                                                                                  |
| ----------------------------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `POST /auth/senha/esqueci` `{ email }`                      | `202 { message }` (sempre igual) | Conta o pedido (3/h por e-mail, exista ou não; 10/h por IP). Só conta ativa, não excluída e com vínculo ativo recebe o código: grava `CodigoVerificacao` (`RECUPERAR_SENHA`, `hashCodigo`, 15 min) e envia o template `recuperar-senha` **sem aguardar**.                            |
| `POST /auth/senha/verificar-codigo` `{ email, codigo }`     | `200 { valido: true }`           | Confere sem consumir.                                                                                                                                                                                                                                                                |
| `POST /auth/senha/redefinir` `{ email, codigo, novaSenha }` | `204`                            | Transação: consome o código (`UPDATE ... WHERE usadoEm IS NULL`, protege corrida), grava o `senhaHash`, `revogarTodas(..., 'RECUPERACAO_SENHA')` e apaga as falhas de login do e-mail. Após o commit, se revogou alguma sessão, emite `usuario.sessaoEncerrada` com `autorId: null`. |

- Só vale o código **mais recente** do usuário: um pedido novo invalida os anteriores, mesmo não usados. Código errado, expirado, usado, de outro tipo ou e-mail sem código → o mesmo `400 CODIGO_INVALIDO`. Cada erro soma `tentativas`; na 5ª o código expira. Erros também contam por IP (`CODIGO_TENTATIVA`, 30/h).
- `novaSenha` é validada pelo pipe antes do código: senha fraca → `400 VALIDATION_ERROR` sem gastar tentativa.
- `429` do limite por e-mail: "Limite de 3 envios por hora atingido. Tente novamente em X min." (o app mostra a `message`).

### Agendador (`src/infra/agendador`)

Único registro do `ScheduleModule` (`@nestjs/schedule`, convenções §11.6). Jobs usam `@Cron(expr, { name, timeZone: FUSO_PADRAO })` e recebem o relógio por parâmetro num método separado (o `cron` passa argumentos próprios ao `onTick`). `LimpezaDiariaJob` (`manutencao.limpeza-diaria`, 03:00) apaga `TentativaAcesso` e `CodigoVerificacao` com mais de 24 h e `Sessao` expiradas ou revogadas há mais de 30 dias. `LimpezaOrfaosJob` (`uploads.limpeza-orfaos`, 03:30) fica no `UploadsModule` (ver [Limpeza de órfãos](#limpeza-de-órfãos)).

### Limite de tentativas (`RateLimitService`)

Único mecanismo de limite do projeto (convenções §4.6, §11.3; nada de `@nestjs/throttler`), persistido em `TentativaAcesso`. Exportado pelo `AuthModule`:

```ts
verificar(tipo, chave, { maximo, janelaMs, bloqueioMs? }, agora?): Promise<number> // tentativas restantes
registrar(tipo, chave, agora?): Promise<void>
consumir(tipo, chave, limite, agora?): Promise<number> // verificar + registrar atômicos
limpar(tipo, chave): Promise<void>
limparPorPrefixo(tipo, prefixo, cliente?): Promise<void> // ex.: falhas de login `email|*`; aceita a `tx`
```

- Bloqueado quando as `maximo` tentativas mais recentes cabem em `janelaMs`: sem `bloqueioMs`, até a mais antiga delas sair da janela (janela deslizante, ex.: 10 cadastros/h); com `bloqueioMs`, até `última + bloqueioMs` (login: 15 min após a 5ª falha). `verificar` lança `ErroLimiteExcedido` → `429 RATE_LIMITED` com `Retry-After` em segundos (o filtro global põe o cabeçalho).
- Fluxo: `consumir` quando toda tentativa conta (cadastro: `verificar` + `registrar` sob `pg_advisory_xact_lock`, sem furo com requisições simultâneas); `verificar` antes e `registrar` depois do resultado (login registra a falha; presign registra a URL emitida, nunca a falha do R2); `limpar` quando o sucesso zera a contagem.
- `tipo` ∈ `TipoTentativa`: `LOGIN_FALHA`, `CADASTRO`, `RECUPERACAO_ENVIO`, `CODIGO_TENTATIVA`, `SENHA_CONFIRMACAO_FALHA`, `PRESIGN`, `VERIFICACAO_ENVIO`, `AVISO_ENVIO`. Tipo novo: acrescente ao catálogo (sem migration; `VarChar(30)`). `chave` até 300 caracteres (ex.: `email|ip`, `usuarioId`).

## Uploads (`src/modules/uploads`)

Imagens vão do app direto ao Cloudflare R2 por URL `PUT` pré-assinada (épico #9); a API nunca recebe os bytes. As entidades guardam só a **chave** (`fotoKey`, `imagemCapaKey`, `imagemKey`) e as respostas expõem a URL pública.

### `POST /api/v1/uploads/presign`

Qualquer autenticado; `NOTICIA` e `BANNER` exigem DIRETOR (conferido no service, `403 FORBIDDEN`). Corpo `presignPedidoSchema` (`@atletica/shared`, `.strict()`): `{ finalidade, contentType: image/jpeg|png|webp, tamanhoBytes: 1–5.242.880 }`. Resposta `201 { uploadUrl, key, publicUrl, expiresAt }`, com `Cache-Control: no-store`.

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

### Limpeza de órfãos

`LimpezaOrfaosJob` (`uploads.limpeza-orfaos`) roda todo dia às 03:30 de `America/Fortaleza` (`FUSO_PADRAO`) e chama `LimpezaOrfaosService.executar(agora)`, que apaga do bucket as imagens que nenhum registro referencia (uploads abandonados e imagens substituídas cuja remoção falhou). Sem tabela própria:

- lista o bucket com `ListObjectsV2`, em páginas de até 1000 objetos (`MaxKeys`), e só considera objetos com mais de 24 h e chave num dos formatos acima (o resto do bucket nunca é apagado);
- procura as chaves em `Usuario.fotoKey`, `Noticia.imagemCapaKey` e `Banner.imagemKey` via `prisma.semEscopo` (todas as atléticas, inclusive registros excluídos logicamente) e apaga as demais com um `DeleteObjects` por página, antes de buscar a próxima;
- uma chave que falha só gera `warn` e entra em `falhas`; o log `info` final traz `listados`, `referenciados` (candidatas ainda em uso), `removidos` e `falhas`. Erro na listagem ou no banco interrompe o job e vai para `logger.error` (Sentry): as páginas anteriores já foram limpas, e a próxima execução retoma o restante;
- um disparo enquanto a execução anterior não terminou é ignorado (trava na instância).

Execução manual em desenvolvimento (usa o `.env`, com o bucket do R2 configurado nele; os crons da API ficam parados durante o script, e o `.env` não deve apontar para o bucket de produção):

```bash
pnpm --filter api uploads:limpar-orfaos
```

## Usuários (`src/modules/usuarios`)

Painel de Usuários da Presidência (UC23, #27) e cargos (UC24, #28). As rotas exigem `@PapelMinimo(PRESIDENTE)` — a de papel, `ADMINISTRADOR` — e respondem com `Cache-Control: no-store`.

| Rota                                | Resposta                                                                   |
| ----------------------------------- | -------------------------------------------------------------------------- |
| `GET /api/v1/usuarios`              | `{ items, page, limit, total }`; `busca` (2–100), `papel`, `situacao`      |
| `GET /api/v1/usuarios/:id`          | perfil, times atuais, `estatisticas: null` (#35) e `permissoes`            |
| `PATCH /api/v1/usuarios/:id/status` | `{ ativo }` → `{ id, situacao }`                                           |
| `PUT /api/v1/usuarios/:id/papel`    | `{ papel, confirmarSubstituicao? }` → `{ alterado, usuario, substituido }` |

- A busca usa `unaccent(lower(nome)) LIKE ...` ou `email LIKE ...` via `$queryRaw` (com `atleticaId` no SQL; `%`, `_` e `\` do termo viram literais). Contas excluídas nunca aparecem na lista.
- A desativação grava `VinculoAtletica.ativo` (não `Usuario.ativo`, reservado à exclusão da #12), revoga as sessões da atlética (`CONTA_DESATIVADA`), audita `USUARIO_DESATIVADO`/`USUARIO_REATIVADO` e emite `usuario.sessaoEncerrada` após o commit só quando houve sessão revogada. O guard responde `401 CONTA_DESATIVADA` na requisição seguinte, mesmo com a sessão já revogada.
- Cargos (`CargosService`): Presidente/Vice ocupado por outro → `409 SUBSTITUICAO_NECESSARIA` até o reenvio com `confirmarSubstituicao: true`, que rebaixa o ocupante a Diretor antes do alvo (índices `vinculo_presidente_unico`/`vinculo_vice_unico`; `P2002` → `409 CONFLITO_CONCORRENTE`). Último Administrador ativo → `409 ULTIMO_ADMINISTRADOR`; promover conta desativada → `409 USUARIO_DESATIVADO`. Cada vínculo alterado gera `CARGO_ALTERADO` e `usuario.papelAlterado` após o commit; sem revogar sessões (o guard relê o papel a cada requisição).
- Regra de nível: só sobre nível estritamente inferior (`podeAgirSobre`), com o papel do solicitante relido na transação → `403 NIVEL_INSUFICIENTE`; a própria conta → `403 ALVO_PROPRIO`; excluída → `409 USUARIO_EXCLUIDO`; repetir a situação atual → `200` sem efeito.

### Perfil (`/me`, `PerfilService`)

Perfil do usuário autenticado (UC10, UC11, #13). Só `@UsuarioAtual()`, sem `:id`: qualquer papel acessa e não há 403/404.

| Rota                     | Resposta                                                                              |
| ------------------------ | ------------------------------------------------------------------------------------- |
| `GET /api/v1/me`         | perfil, `papel` do vínculo atual, times atuais, último aceite de termos (`no-store`)  |
| `PATCH /api/v1/me`       | `{ nome }` → perfil                                                                   |
| `PUT /api/v1/me/foto`    | `{ fotoKey }` → `{ fotoUrl }`; `422 UPLOAD_INVALIDO`/`UPLOAD_NAO_ENCONTRADO`          |
| `DELETE /api/v1/me/foto` | `204`, idempotente                                                                    |
| `PUT /api/v1/me/senha`   | `{ senhaAtual, novaSenha }` → `204`; `400 SENHA_INCORRETA`/`SENHA_IGUAL_ATUAL`, `429` |

- `GET /me` é uma consulta só: vínculos com `saidaEm` e times inativos ficam de fora, capitão por `Time.capitaoId`, times por nome.
- Foto: `UploadsService.validarKey` só quando a chave muda; a anterior é removida do R2 em `aposCommit`.
- Senha: 5 senhas atuais erradas em 15 min por usuário (`SENHA_CONFIRMACAO_FALHA`, chave `usuarioId`, o mesmo contador da #12). A troca revoga as outras sessões com `TROCA_SENHA` (`exceto` = sessão do token) e emite `usuario.sessaoEncerrada` só com as revogadas. `SENHA_INCORRETA` é 400 para o app não tentar o refresh.
- Sem auditoria (convenções §7).

### Exclusão de conta (`DELETE /me/conta`, `ContaService`)

`{ senha }` → `204` (UC13, RN33, #12); `400 SENHA_INCORRETA` (campo `senha`), `409 ULTIMO_ADMINISTRADOR`, `429` (mesmo contador de `PUT /me/senha`).

- Uma transação (`TransacaoService.executar`). A senha é conferida antes (`ConfirmacaoSenhaService`, o mesmo de `PUT /me/senha`); dentro dela, a conta é travada (`FOR UPDATE`) e os vínculos de todas as atléticas são lidos por SQL, porque `semEscopo` não participa da transação. O trabalho de cada atlética roda em `executarComAtletica`.
- Ordem: `bloquearPapeis` + `ehUltimoAdministrador` (mensagem própria da exclusão) em cada atlética onde a conta é Administrador ativo → `ElencoService.encerrarVinculo` por time (`EXCLUSAO_CONTA`), solicitações `PENDENTE` → `CANCELADA`, vínculos → `ATLETA`/inativos, auditoria `CONTA_EXCLUIDA` (uma por atlética, `{ antes: { papel }, depois: null, contexto: { timeIds } }`) → anonimização da conta → `revogarTodas(CONTA_EXCLUIDA)`.
- Anonimização: nome `Usuário excluído`, e-mail `excluido+<id>@anonimo.invalid` (libera o original para novo cadastro), `senhaHash = '!'`, sem foto, `ativo = false`, `excluidoEm`. Apaga códigos de verificação, preferências, dispositivos push e as tentativas de login/recuperação do e-mail original. Ficam `AceiteTermos`, participações passadas e autorias.
- Após o commit: `usuario.sessaoEncerrada` com todas as sessões revogadas e remoção da foto no R2 (`UploadsService.apagar`; falha gera `logger.error` + Sentry, sem afetar a resposta).

### `regras-papel.ts` (usado por #12 e #28)

```ts
bloquearPapeis(tx, atleticaId) // pg_advisory_xact_lock(hashtext('papeis:' || atleticaId)), até o commit
garantirNaoUltimoAdministrador(tx, atleticaId, usuarioId) // 409 ULTIMO_ADMINISTRADOR; chame depois do lock
ehUltimoAdministrador(cliente, atleticaId, usuarioId) // mesma contagem, sem lançar
calcularPermissoes(solicitante, alvo, ehUltimoAdmin) // permissoes do detalhe
bloquearVinculo(tx, usuarioId, atleticaId) // vínculo do alvo com FOR UPDATE; depois do lock
papelDoSolicitante(tx, solicitanteId, minimo) // relê o papel sob o lock; 403 FORBIDDEN abaixo do mínimo
```

"Outro Administrador" = vínculo `ADMINISTRADOR` ativo, de conta não excluída, na mesma atlética. Toda alteração de papel ou situação abre `TransacaoService.executar`, chama `bloquearPapeis` primeiro e só então lê o vínculo do alvo (`FOR UPDATE`).

## Banco de dados e multi-atlética (`src/infra/prisma`, `src/infra/contexto`)

`PrismaModule` e `ContextoModule` são globais (importados no `AppModule`): injete `PrismaService` e, se precisar, `ContextoAtletica`. O `PrismaService` conecta na subida e desconecta no `app.close()` (inclusive nos sinais de término, `enableShutdownHooks`).

### `prisma.db` × `prisma.semEscopo`

| Cliente            | Filtro por atlética | Quando usar                                                                                                                                                   |
| ------------------ | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `prisma.db`        | sim (RNF20)         | **Padrão**, em todos os services.                                                                                                                             |
| `prisma.semEscopo` | não                 | Só operações de conta que atravessam atléticas ou acontecem antes do contexto (login, sessão no guard, exclusão de conta), `/health`, seed e jobs de limpeza. |

A regra de lint `no-restricted-syntax` só permite `semEscopo` em `src/modules/auth/**`, `src/modules/usuarios/conta*.ts`, `src/modules/health/**`, `src/modules/uploads/limpeza-orfaos.service.ts` (a limpeza cruza todas as atléticas, #56), `src/infra/**` e `prisma/seed*.ts` (convenções §3). Qualquer outro uso exige justificativa no PR.

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

## Modalidades (`src/modules/modalidades`)

Catálogo **global** (sem `atleticaId`, convenções §6). Schemas, DTOs e o catálogo de ícones `ICONES_MODALIDADE` (chaves do MaterialCommunityIcons) ficam em `@atletica/shared` (`modalidades/`); o nome é normalizado (`trim` + espaços colapsados, 2–40 caracteres) e único sem diferenciar maiúsculas (índice `modalidade_nome_unico`).

| Rota                                | Papel mínimo         | Resposta                                                                                  |
| ----------------------------------- | -------------------- | ----------------------------------------------------------------------------------------- |
| `GET /modalidades?incluirInativas=` | qualquer autenticado | `200 { items }` em ordem alfabética (`pt-BR`); `incluirInativas` só vale para a Diretoria |
| `POST /modalidades`                 | DIRETOR              | `201`; nasce ativa; `409 MODALIDADE_DUPLICADA`                                            |
| `PATCH /modalidades/:id`            | DIRETOR              | `200`; ao menos um de `nome`, `icone`, `ativa`; sem mudança não audita                    |
| `DELETE /modalidades/:id`           | PRESIDENTE           | `204` (exclusão física); com times → `409 MODALIDADE_COM_DEPENDENCIAS`                    |

Toda escrita audita na mesma transação: `MODALIDADE_CRIADA`, `MODALIDADE_ALTERADA` (nome/ícone), `MODALIDADE_ATIVADA`/`MODALIDADE_DESATIVADA` (`ativa`) e `MODALIDADE_EXCLUIDA`. A contagem de times usa `prisma.db` (atlética ativa e adversárias); a FK `Restrict` (`P2003`) cobre os demais. Fábrica de teste: `criarModalidade()` em `test/fabricas/modalidades.ts`.

## Atléticas adversárias (`src/modules/atleticas`)

`Atletica` com `usaAplicativo = false` (RN21). Schemas e DTOs em `@atletica/shared` (`atletica/adversarias.ts`): nome 2–80, sigla até 10 (maiúsculas), curso até 80; opcionais vazios viram `null`; `usaAplicativo` não é aceito no corpo. O nome é único entre adversárias sem diferenciar maiúsculas: não há índice, então a checagem roda na transação sob `pg_advisory_xact_lock(hashtext('atleticas-adversarias'))`.

| Rota                                         | Papel mínimo | Resposta                                                            |
| -------------------------------------------- | ------------ | ------------------------------------------------------------------- |
| `GET /atleticas-adversarias?q=&page=&limit=` | DIRETOR      | `200` paginado, por nome (sem acento nem caixa), com `totalTimes`   |
| `POST /atleticas-adversarias`                | DIRETOR      | `201`; `409 ATLETICA_DUPLICADA`                                     |
| `PATCH /atleticas-adversarias/:id`           | DIRETOR      | `200`; id de atlética que usa o app → `404`; sem mudança não audita |

Auditoria (entidade `Atletica`): `ATLETICA_ADVERSARIA_CRIADA`, `ATLETICA_ADVERSARIA_ALTERADA`.

## Times (`src/modules/times`)

Times da atlética ativa e de adversárias. A extensão multi-atlética lê `Time` com `atleticaId = atual OR atletica.usaAplicativo = false`; na criação, o `atleticaId` vem do service (atlética ativa ou `atleticaAdversariaId`, que precisa ter `usaAplicativo = false`, senão `404`). A atlética do time é imutável. Schemas e `TimeDto` em `@atletica/shared` (`times/`).

| Rota                | Papel mínimo         | Resposta                                                                                                                                                       |
| ------------------- | -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /times`        | qualquer autenticado | `200` paginado; filtros `modalidadeId`, `escopo=PROPRIOS\|ADVERSARIOS`, `atleticaId`, `q`; sem `incluirInativos` (só Diretoria), só ativos de modalidade ativa |
| `GET /times/:id`    | qualquer autenticado | `200` com `minhaSituacao` (`null` em adversário); fora da Diretoria, inativo ou de modalidade inativa → `404`                                                  |
| `POST /times`       | DIRETOR              | `201`; `422 MODALIDADE_INATIVA`, `409 TIME_DUPLICADO` (índice `time_nome_unico`)                                                                               |
| `PATCH /times/:id`  | DIRETOR              | `200`; `nome`, `modalidadeId`, `ativo`; trocar a modalidade de time com eventos → `409 TIME_COM_EVENTOS`                                                       |
| `DELETE /times/:id` | PRESIDENTE           | `204` (exclusão física); com evento, `MembroTime` (inclusive histórico) ou solicitação → `409 TIME_COM_DEPENDENCIAS`                                           |

As listas paginadas (`/times`, `/atleticas-adversarias`) ordenam e filtram por nome em SQL (`unaccent(lower(nome))`) e leem os dados pelo Prisma (`naOrdemDosIds`, `src/common/busca.ts`). Em time adversário, `capitao` é `null` e `totalMembros` é `0`. Auditoria (entidade `Time`): `TIME_CRIADO`, `TIME_ALTERADO` (nome/modalidade), `TIME_ATIVADO`/`TIME_DESATIVADO` e `TIME_EXCLUIDO`. Fábricas: `criarTime`, `criarAtleticaAdversaria`, `criarTimeAdversario` e `adicionarMembro(time, usuario, { entradaEm?, saidaEm? })` em `test/fabricas/times.ts`.

### Elenco e capitão (`ElencoController`, `ElencoService`)

Só times da atlética ativa: time adversário → `422 TIME_ADVERSARIO`; de outra atlética que usa o app → `404`.

| Rota                                  | Papel mínimo         | Resposta                                                                                                                      |
| ------------------------------------- | -------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `GET /times/:id/elenco`               | qualquer autenticado | `200 { items, total }` sem paginação, capitão primeiro e depois por nome; sem e-mail; fora da Diretoria, time inativo → `404` |
| `DELETE /times/:id/elenco/:usuarioId` | DIRETOR              | `204`; sem vínculo ativo → `404 MEMBRO_NAO_ENCONTRADO`                                                                        |
| `PUT /times/:id/capitao`              | DIRETOR              | `200` com o time; `{ usuarioId: null }` remove; fora do elenco → `422 CAPITAO_FORA_DO_ELENCO`                                 |

Auditoria: `CAPITAO_DEFINIDO`/`CAPITAO_REMOVIDO` (entidade `Time`, `{ antes: { capitaoId }, depois: { capitaoId } }`; sem mudança não audita). Usuário excluído aparece como "Usuário excluído", sem foto.

**`encerrarVinculo(tx, { timeId, usuarioId, motivo, executorId })`** — ponto único de saída do elenco (#12 e #34 o chamam; importe `TimesModule`). Roda na transação de quem chama e devolve `{ capitaniaRemovida, participacoesRemovidas }`:

1. trava o `Time` com `FOR UPDATE` (o `PUT /capitao` também trava, então capitão e remoção não se cruzam);
2. preenche `saidaEm` no vínculo ativo; sem vínculo → `404 MEMBRO_NAO_ENCONTRADO`;
3. se era o capitão, `capitaoId = null`;
4. apaga as `Participacao` do usuário em eventos do time `AGENDADO`, futuros e sem presença;
5. audita na entidade `MembroTime` com ator `executorId`: `REMOVIDO_PELA_DIRETORIA` → `MEMBRO_REMOVIDO`, `SAIU` → `MEMBRO_SAIU`, `EXCLUSAO_CONTA` → `MEMBRO_REMOVIDO_EXCLUSAO_CONTA`, com `contexto: { timeId, usuarioId, capitaniaRemovida, participacoesRemovidas }`.

Não emite evento de domínio. Para #34 (`MotivoSaida` exportado por `elenco.service.ts`):

```ts
await this.prisma.db.$transaction((tx) =>
  this.elenco.encerrarVinculo(tx, {
    timeId,
    usuarioId,
    motivo: MotivoSaida.SAIU,
    executorId: usuarioId,
  }),
)
```

## Solicitações de entrada (`src/modules/solicitacoes`)

O usuário é sempre o do token. Schemas e DTOs em `@atletica/shared` (`solicitacoes/`). Sem auditoria na criação e no cancelamento (convenções §7).

| Rota                              | Papel mínimo                  | Resposta                                                                                                                                                                                    |
| --------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /times/:id/solicitacoes`    | qualquer autenticado          | `201 PENDENTE`; ordem: `404` → `422 TIME_ADVERSARIO` → `422 TIME_INATIVO` → `409 JA_E_MEMBRO` → `409 SOLICITACAO_PENDENTE` (checagem e índice `solicitacao_pendente_unica`)                 |
| `POST /solicitacoes/:id/cancelar` | qualquer autenticado (o dono) | `200 CANCELADA`; já cancelada → `200` sem gravar; de outro usuário → `404`; aprovada/rejeitada → `409 SOLICITACAO_JA_AVALIADA`                                                              |
| `GET /solicitacoes`               | DIRETOR                       | `status` repetível (padrão `PENDENTE`), `timeId?`, paginação; só pendentes → `criadaEm ASC`; demais → `COALESCE(avaliadaEm, canceladaEm) DESC`; só nome e foto das pessoas                  |
| `POST /solicitacoes/:id/aprovar`  | DIRETOR                       | `200 APROVADA` + `MembroTime` com `solicitacaoId`; ordem: `404` → `422 TIME_INATIVO` (time ou modalidade) → transição condicional (`409 SOLICITACAO_CANCELADA` / `SOLICITACAO_JA_AVALIADA`) |
| `POST /solicitacoes/:id/rejeitar` | DIRETOR                       | `200 REJEITADA`; sem `MembroTime` e sem checar time inativo; mesmos `404`/`409` do aprovar                                                                                                  |

A criação emite `solicitacao.criada { atleticaId, solicitacaoId, timeId, autorId }` após o commit; o cancelamento não emite. `SolicitacoesService.minhaSituacao(time, usuarioId)` monta o `minhaSituacao` de `GET /times/:id`. Fábrica: `criarSolicitacao(time, usuario, { status? })` em `test/fabricas/solicitacoes.ts`.

A avaliação (`SolicitacoesPainelService`) usa `updateManyAndReturn` com `status = PENDENTE` no `WHERE`: a concorrência com outro diretor ou com o cancelamento é decidida pela própria instrução, e a releitura só escolhe o código do `409`. O vínculo nasce com `INSERT ... ON CONFLICT ("timeId", "usuarioId") WHERE "saidaEm" IS NULL DO NOTHING`, restrito ao índice `membro_time_ativo_unico`: um `P2002` abortaria a transação, e o atleta já no elenco não duplica o vínculo (`contexto.jaEraMembro: true`, sem `MEMBRO_ADICIONADO`). Auditoria `SOLICITACAO_APROVADA`/`SOLICITACAO_REJEITADA` e `MEMBRO_ADICIONADO` na mesma transação; `solicitacao.avaliada { atleticaId, solicitacaoId, timeId, usuarioId, status, autorId }` após o commit (`usuarioId` = solicitante, `autorId` = diretor).

## Notícias (`src/modules/noticias`)

`NoticiasModule` reúne a leitura pública (`/noticias`, #78: só publicadas e não excluídas) e a gestão pelo Painel (`/painel/noticias`, #80). Schemas e DTOs em `@atletica/shared` (`noticias/`): título `trim` 3–120; conteúdo em Markdown restrito até 10 000 (vazio no rascunho); `noticiaPublicacaoSchema` exige conteúdo após `trim` e capa. Exclusão lógica (`excluidoEm`): toda leitura filtra `excluidoEm IS NULL`.

| Rota                                    | Papel mínimo | Resposta                                                                                                 |
| --------------------------------------- | ------------ | -------------------------------------------------------------------------------------------------------- |
| `GET /painel/noticias?status=&q=`       | DIRETOR      | `200` paginado, rascunhos e publicadas por `atualizadoEm` desc; `q` busca no título sem acento nem caixa |
| `GET /painel/noticias/:id`              | DIRETOR      | `200` com `conteudo` e `autor`                                                                           |
| `POST /painel/noticias`                 | DIRETOR      | `201`; `publicar: true` cria já publicada                                                                |
| `PATCH /painel/noticias/:id`            | DIRETOR      | `200`; `titulo`, `conteudo`, `imagemCapaKey` (`null` remove); publicada mantém status e `publicadaEm`    |
| `POST /painel/noticias/:id/publicar`    | DIRETOR      | `200`, idempotente; `422 CAPA_OBRIGATORIA` / `CONTEUDO_OBRIGATORIO` (também ao editar publicada)         |
| `POST /painel/noticias/:id/despublicar` | DIRETOR      | `200`, idempotente; `publicadaEm` é mantida                                                              |
| `DELETE /painel/noticias/:id`           | PRESIDENTE   | `204` (exclusão lógica, em qualquer status)                                                              |

- **Concorrência:** toda escrita bloqueia a linha (`SELECT ... FOR UPDATE`, com atlética e `excluidoEm IS NULL` no SQL); publicar e despublicar usam `updateMany` condicionado ao status. Dois cliques ou dois diretores geram uma publicação só.
- **Capa:** `UploadsService.validarKey` (finalidade `NOTICIA`) só quando a chave muda; a anterior sai do R2 via `aposCommit` ao trocar ou remover. A exclusão lógica mantém a imagem.
- **`noticia.publicada { atleticaId, noticiaId, autorId }`** só na primeira publicação (`autorId` = quem publicou); republicar mantém `publicadaEm` e não emite.
- **Auditoria** (entidade `Noticia`): `NOTICIA_CRIADA` (`{ titulo, status }`), `NOTICIA_ALTERADA` (título e os indicadores `conteudoAlterado`/`capaAlterada`, nunca o texto nem a chave), `NOTICIA_PUBLICADA` (`contexto.primeiraPublicacao`), `NOTICIA_DESPUBLICADA` e `NOTICIA_EXCLUIDA`.
- Fábricas: `criarNoticia` e `chaveDeCapa` em `test/fabricas/noticias.ts`.

## Eventos (`src/modules/eventos`)

Jogos e treinos avulsos (épico #19; escrita da #70). Schemas (`criarEventoSchema`, união discriminada por `tipo`; `editarEventoSchema`) e `EventoDto` em `@atletica/shared` (`eventos/`): `inicio` ISO com fuso entre hoje − 365 e hoje + 730 dias, `local` 2–120, `observacoes` até 500 (vazio → `null`). A modalidade é a do time (RN10). Exclusão **lógica** (`excluidoEm`): toda leitura e escrita filtra `naoExcluido`.

| Rota                         | Papel mínimo | Resposta                                                                                                                                      |
| ---------------------------- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /eventos`              | DIRETOR      | `201 EventoDto` em `AGENDADO`; `422 TIME_INVALIDO`/`TIME_INATIVO`/`MODALIDADE_INATIVA`/`ADVERSARIO_INVALIDO`/`MODALIDADES_DIFERENTES`         |
| `PATCH /eventos/:id`         | DIRETOR      | `200`; `CANCELADO` → `422 EVENTO_CANCELADO`; `FINALIZADO` só `observacoes`; trocar `timeId` com participação → `409 EVENTO_COM_PARTICIPACOES` |
| `POST /eventos/:id/cancelar` | DIRETOR      | `200 { eventoIds, status: 'CANCELADO' }`; `422 EVENTO_FINALIZADO`/`EVENTO_JA_CANCELADO`                                                       |
| `DELETE /eventos/:id`        | PRESIDENTE   | `204`; com participação ou resultado → `409 EVENTO_COM_DEPENDENCIAS` (`details` em `participacoes`/`resultado`)                               |

As regras que dependem do banco ficam no `EventosValidator`, chamado dentro da transação. `EventosService.cancelar(tx, eventoIds, usuario, { statusAtual?, contexto? })` cancela, na transação de quem chama, os eventos `AGENDADO`/`EM_ANDAMENTO`, audita um `EVENTO_CANCELADO` por evento e devolve os ids afetados; quem chama emite `evento.cancelado` uma vez (reutilizado pela #20 e pela #73). Auditoria: `EVENTO_CRIADO`, `EVENTO_ALTERADO` (só campos alterados), `EVENTO_CANCELADO`, `EVENTO_EXCLUIDO`. Eventos de domínio após o commit: `evento.criado`, `evento.alterado` (só se `inicio` ou `local` mudaram) e `evento.cancelado`; a exclusão não emite.

Fábricas (`test/fabricas/eventos.ts`): `criarEvento({ atleticaId, ...campos, participantes? })` (TREINO por padrão, `AGENDADO` amanhã; cria time, adversário da mesma modalidade e autor quando faltam; valores informados, inclusive `null`, vão direto ao banco), `criarJogo`, `criarTreino` e `criarParticipacoes(evento, [{ usuarioId, confirmado?, presente? }])`.

### Treino recorrente (`SeriesRecorrenciaService`, #20)

As mesmas rotas, sem rotas novas. `recorrenciaSchema` e `gerarDatasSerie` ficam em `@atletica/shared` (`eventos/recorrencia.ts`) e são usados pela API e pela prévia do app.

| Rota                                                          | Resposta                                                                                                                                         |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `POST /eventos` com `recorrencia` (no lugar de `inicio`)      | `201 { serie, totalOcorrencias, primeiraOcorrencia, ultimaOcorrencia }`; `422 SERIE_SEM_OCORRENCIAS`; Jogo, início no passado ou > 6 meses → 400 |
| `PATCH /eventos/:id` com `escopo: 'ESTA_E_SEGUINTES'`         | `200 { eventoIds, serieId, serieDividida }`; só `horario`, `local`, `observacoes`; avulso → `422 EVENTO_SEM_SERIE`                               |
| `POST /eventos/:id/cancelar` com `escopo: 'ESTA_E_SEGUINTES'` | `200 { eventoIds, status: 'CANCELADO' }`; série sem `AGENDADO` restante recebe `canceladaEm`                                                     |

- **Geração síncrona**: as ocorrências (até 185) são gravadas na mesma transação da série, com um `createManyAndReturn`, e a resposta já traz o total. Diverge da seção 8.1 do documento de requisitos, que previa a fila pg-boss; a decisão aguarda aprovação do PO (#97) e, até lá, vale a geração síncrona (justificativa na #20 §14).
- **Divisão**: mudar o `horario` a partir de uma ocorrência que não é a 1ª cria uma nova série a partir do dia dela, move para ela as ocorrências seguintes (qualquer status) e encerra a original na véspera (`SERIE_DIVIDIDA`). A partir da 1ª, a série em vigor é atualizada (`SERIE_ALTERADA`).
- Auditoria: uma `SERIE_CRIADA` por série (não uma por ocorrência); `EVENTO_ALTERADO`/`EVENTO_CANCELADO` por ocorrência com `contexto: { serieId, escopo }`. Um único `evento.criado` (com `serieId`), `evento.alterado` ou `evento.cancelado` por operação.

## Participações (`src/modules/participacoes`)

Confirmação "Vou"/"Não vou" do atleta (#24, RN30, UC15). O usuário é sempre o do token; `responderParticipacaoSchema` e `ParticipacaoRespondidaDto` em `@atletica/shared` (`participacoes/`). Sem auditoria e sem evento de domínio.

| Rota                            | Papel mínimo                            | Resposta                                                                                                                                                                                       |
| ------------------------------- | --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PUT /eventos/:id/participacao` | qualquer autenticado (membro do elenco) | `200 { eventoId, confirmado, respondidoEm, contagem }`; ordem de `avaliarResposta`: `403 NAO_MEMBRO_DO_ELENCO` → `422 EVENTO_CANCELADO` → `422 EVENTO_NAO_AGENDADO` → `422 EVENTO_JA_INICIADO` |

Upsert por `(eventoId, usuarioId)`; a mesma resposta não regrava `respondidoEm` e a presença nunca muda. Com o escopo de atlética o upsert não é nativo, então a criação concorrente (`P2002`) repete a transação uma vez. `contagem` vem de `EventosLeituraService.contagem(evento)`, a mesma do `GET /eventos/:id`.

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
