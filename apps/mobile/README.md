# App (Expo + Expo Router)

Development build (não Expo Go). Comandos na raiz do monorepo: `pnpm dev:mobile`, `pnpm --filter mobile test`, `pnpm --filter mobile typecheck`.

## Variáveis de ambiente

Copie `.env.example` para `.env`. Variáveis `EXPO_PUBLIC_*` são embutidas no bundle: nunca coloque segredos nelas.

| Variável                 | Exemplo                           | Uso                                                                                       |
| ------------------------ | --------------------------------- | ----------------------------------------------------------------------------------------- |
| `EXPO_PUBLIC_API_URL`    | `http://192.168.0.10:3000/api/v1` | URL base da API, **já com `/api/v1`**. No aparelho, use o IP da máquina, não `localhost`. |
| `EXPO_PUBLIC_AMBIENTE`   | `development`                     | `development \| homologacao \| producao` (convenções §11.11)                              |
| `EXPO_PUBLIC_SENTRY_DSN` | vazio                             | DSN do projeto `atletica-app` (#93). Vazio = Sentry desligado.                            |

Novas variáveis entram em `env.d.ts` (tipagem) e em `src/config/ambiente.ts`. Feature flags versionadas ficam em `src/config/features.ts` (convenções §10.7).

O `app.config.ts` valida as variáveis com Zod e recusa resolver a configuração (mensagem no `expo start`/`eas build`) se `EXPO_PUBLIC_AMBIENTE` não for `development | homologacao | producao` ou se `EXPO_PUBLIC_API_URL` não for URL (`https://` obrigatório fora de `development`). `pnpm --filter mobile config:verificar` resolve os três ambientes com `expo config --type public` (roda na CI).

## Release — EAS Build e EAS Update (#82)

### Ambientes e perfis (`eas.json`)

| Perfil           | Saída           | Distribuição | Canal OTA     | `EXPO_PUBLIC_AMBIENTE` | Nome / pacote                                          |
| ---------------- | --------------- | ------------ | ------------- | ---------------------- | ------------------------------------------------------ |
| `development`    | APK, dev client | internal     | `development` | `development`          | `NOME_APP` / `IDENTIFICADOR_ANDROID`                   |
| `preview`        | APK             | internal     | `homologacao` | `homologacao`          | `NOME_APP (Homolog)` / `IDENTIFICADOR_ANDROID.homolog` |
| `production`     | AAB             | store        | `producao`    | `producao`             | `NOME_APP` / `IDENTIFICADOR_ANDROID`                   |
| `production-apk` | APK             | internal     | `producao`    | `producao`             | `NOME_APP` / `IDENTIFICADOR_ANDROID`                   |

- Homologação tem pacote, nome e ícone (`assets/*-homolog.png`) próprios: as duas versões ficam instaladas lado a lado.
- Nome, pacote base e id do projeto EAS ficam no topo do `app.config.ts` (decisões da #97). O id do projeto (`ID_PROJETO_EAS`) é um placeholder até o `eas init` da #95.
- URLs da API de homologação e produção no `eas.json` são placeholders (`*.preencher.invalid`), trocados na #92/#95; o DSN do Sentry fica vazio (desligado) até a #93/#95.
- Android 8.0 (API 26) mínimo via `expo-build-properties`; `targetSdk`/`compileSdk` são os do SDK Expo. `RECORD_AUDIO` e `SYSTEM_ALERT_WINDOW` bloqueadas.

### Versionamento

- `version` (semver) no `app.config.ts`, alterada à mão a cada release com mudança visível.
- `versionCode` remoto (`cli.appVersionSource: "remote"`), incrementado pelo EAS nos perfis `production` e `production-apk`.
- Cada build de produção recebe a tag Git `app-vX.Y.Z` (ex.: `git tag app-v1.0.0 && git push origin app-v1.0.0`).
- `runtimeVersion` pela política `fingerprint`: muda sozinho quando o código nativo muda, e um OTA só chega a binários com o mesmo runtime.
- A tela Sobre mostra versão (build), runtime, id do OTA ativo (8 caracteres, ou "embutido") e, fora de produção, o canal.

### Comandos

```sh
cd apps/mobile
eas build -p android --profile preview          # development | preview | production | production-apk
eas update --channel homologacao --message "Corrige texto da agenda"
```

- **OTA** (`checkAutomatically: ON_LOAD`, `fallbackToCacheTimeout: 0`): o app abre com o bundle em cache e aplica a atualização na abertura seguinte. Só JS e assets; dependência nativa, permissão ou SDK novos exigem build novo (RNF17).
- **Promoção `homologacao → producao`**: validado em homologação, publicar em produção com `eas update --branch producao --message "..."` ou republicar o mesmo grupo com `eas update:republish --group <id-do-grupo> --destination-channel producao -m "..."`. Para promover a branch inteira, `eas channel:edit producao --branch homologacao`.
- **Rollback**: `eas update:list --branch producao` para achar o grupo anterior e `eas update:republish --group <id-anterior> -m "Rollback"`.
- **Conferir o `minSdkVersion` do APK**: `aapt dump badging app.apk | grep sdkVersion` deve mostrar `sdkVersion:'26'`.

### Variáveis e segredos (configurados na #95)

| Nome                           | Onde                               | Uso                                              |
| ------------------------------ | ---------------------------------- | ------------------------------------------------ |
| `EXPO_PUBLIC_*`                | `env` de cada perfil no `eas.json` | públicas, embutidas no bundle                    |
| `SENTRY_AUTH_TOKEN`            | segredo do EAS (`eas env:create`)  | upload de source maps no build e no `eas update` |
| `SENTRY_ORG`, `SENTRY_PROJECT` | variável do EAS (opcional)         | sobrescrevem os padrões do `app.config.ts`       |
| `EXPO_TOKEN`                   | secret do GitHub                   | builds pela CI, se automatizados                 |

Nenhum segredo vai no `eas.json` nem em `EXPO_PUBLIC_*` (`__tests__/eas-json.test.ts` falha se aparecer).

## Rotas

Grupos oficiais `(publico)` e `(app)/(abas)` (convenções §3 e §11.1).

| Rota                          | Arquivo                                        | Acesso          |
| ----------------------------- | ---------------------------------------------- | --------------- |
| `/login`                      | `app/(publico)/login.tsx`                      | só sem sessão   |
| `/cadastro`                   | `app/(publico)/cadastro.tsx`                   | só sem sessão   |
| `/recuperar-senha`            | `app/(publico)/recuperar-senha/index.tsx`      | só sem sessão   |
| `/recuperar-senha/codigo`     | `app/(publico)/recuperar-senha/codigo.tsx`     | só sem sessão   |
| `/recuperar-senha/nova-senha` | `app/(publico)/recuperar-senha/nova-senha.tsx` | só sem sessão   |
| `/`                           | `app/(app)/(abas)/index.tsx`                   | com sessão      |
| `/agenda`                     | `app/(app)/(abas)/agenda.tsx`                  | com sessão      |
| `/times`                      | `app/(app)/(abas)/times.tsx`                   | com sessão      |
| `/perfil`                     | `app/(app)/(abas)/perfil/index.tsx`            | com sessão      |
| `/perfil/configuracoes/*`     | `app/(app)/(abas)/perfil/configuracoes/`       | com sessão      |
| `/painel`                     | `app/(app)/(abas)/painel.tsx`                  | nível ≥ DIRETOR |
| `/termos`                     | `app/termos.tsx`                               | todos           |
| `/privacidade`                | `app/privacidade.tsx`                          | todos           |
| inexistente                   | `app/+not-found.tsx`                           | todos           |

- **Proteção**: `Stack.Protected` no `app/_layout.tsx` (`(app)` com sessão, `(publico)` sem). Sem sessão, qualquer rota protegida cai em `/login`; ao encerrar a sessão, o app volta a `/login`.
- **Deep link protegido sem sessão**: `app/+native-intent.tsx` guarda o caminho e, depois do login, o layout raiz navega até ele (`src/infra/sessao/destino.ts`).
- **Aba Painel**: aparece só para `temNivelMinimo(papel, Papel.DIRETOR)` (`useVePainel()`); para os demais fica com `href: null` e `/painel` redireciona ao Início. A ocultação é só visual; quem autoriza é a API.
- **Telas de detalhe** (eventos, notícias...) ficam em `app/(app)/...`, acima das abas. Uma aba pode virar pasta com `_layout.tsx` (Stack) + `index.tsx`; tocar de novo na aba ativa volta à raiz dessa pilha.
- **Splash**: fica visível até a sessão (SecureStore) e a atlética (cache ou rede, até 3 s) carregarem e o cache offline ser restaurado.
- **Recuperação de senha** (#62): e-mail → código → nova senha. E-mail e código passam pelo `useRecuperacaoStore` (`src/features/recuperacao-senha`, só em memória), nunca pela URL. Login e cadastro abrem o fluxo com `/recuperar-senha?email=<e-mail>` para a tela vir preenchida. Ao concluir, o app volta a `/login?email=<e-mail>` para o login vir preenchido.

## Sessão — `src/infra/sessao/store.ts`

Store `zustand` (`useSessao`), acessível fora do React com `useSessao.getState()`.

| Campo / ação                                                                 | Descrição                                                                                         |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `status`                                                                     | `'carregando' \| 'autenticado' \| 'anonimo'`                                                      |
| `usuario`                                                                    | `{ id, nome, email, fotoUrl, papel, atleticaId }`                                                 |
| `accessToken`, `refreshToken`, `accessTokenExpiraEm`                         | em memória                                                                                        |
| `iniciarSessao({ accessToken, refreshToken, accessTokenExpiraEm, usuario })` | login/cadastro (#59)                                                                              |
| `atualizarUsuario(parcial)`                                                  | refresh e `['me']` (#13); a aba Painel acompanha o papel                                          |
| `atualizarTokens({ accessToken, refreshToken, accessTokenExpiraEm })`        | refresh (#52)                                                                                     |
| `encerrarSessao({ motivo })`                                                 | apaga SecureStore e AsyncStorage da sessão, fica `'anonimo'` e chama os ouvintes                  |
| `aoEncerrarSessao(ouvinte)`                                                  | registra um ouvinte `({ motivo }) => ...` (ex.: limpar o cache de queries e mostrar o toast, #52) |

`motivo`: `LOGOUT | SESSAO_EXPIRADA | CONTA_DESATIVADA | CONTA_EXCLUIDA`.

Tokens ficam **só** no `expo-secure-store` (`auth.accessToken`, `auth.refreshToken`). `usuario` e `accessTokenExpiraEm` (não sensíveis) ficam também no AsyncStorage (`sessao.v1`).

## Tema por atlética — `src/features/atletica`

- `carregarAtletica()` (splash) lê o cache `atletica.v1` e a data em que foi gravado (`atletica.v1.salvaEm`); sem cache, espera `GET /atletica` por até 3 s, sem repetir. Sem rede e sem cache: tema neutro (`#6B7280`) e nome "Atlética".
- `useConsultaAtletica()` é a consulta crua (para `TelaDados`): `useQuery({ queryKey: chaves.atletica() })` com o `atletica.v1` como dado inicial e `atletica.v1.salvaEm` como `dataUpdatedAt`, que a `FaixaOffline` exibe.
- `useAtletica()` lê a `useConsultaAtletica()`: a rede atualiza tela e cache em segundo plano e tenta de novo ao reconectar (`refetchOnReconnect`). Devolve `{ id, nome, sigla, curso, logoUrl, corPrimaria, corSecundaria, contatoEmail, contatoInstagram, contatoWhatsapp }`, já com o fallback aplicado (`id` é `null` sem dados).
- `ProvedorTema` define `--cor-primaria`/`--cor-secundaria` (`vars()` do NativeWind) no contêiner raiz. Use as classes `bg-primaria`, `text-secundaria`, `border-primaria/40` etc. A paleta escura fixa (`fundo`, `superficie`, `cartao`, `texto`, `texto-suave`, `borda`, `sucesso`, `alerta`, `erro`) está em `paleta.js` e no `tailwind.config.js`.
- `corTextoSobre(hex)` devolve `#FFFFFF` ou `#000000` (maior contraste WCAG), para texto sobre a cor primária.

Nada da atlética fica fixo no código (RNF20): `__tests__/sem-nome-fixo.test.ts` falha se `app/` ou `src/` citarem o nome da atlética.

## Toasts — `src/components/ui/toast.ts`

`toast.sucesso(msg)`, `toast.erro(msg)`, `toast.info(msg)`. O `<Toast config={toastConfig} />` está montado no layout raiz; `src/components/ui/toast-config.tsx` define as variantes `sucesso`, `erro` e `info` (ícone + texto, lidas pelo leitor de tela como "Sucesso: …", "Erro: …", "Aviso: …").

## Cliente HTTP — `src/infra/api`

Telas e hooks falam com a API **só** por `api.get/post/put/patch/delete` (`cliente.ts`), nunca `fetch` direto.

```ts
const evento = await api.get<EventoDto>(`/eventos/${id}`, { sinal: signal })
await api.post('/times/1/solicitacoes', { mensagem }, { consulta: { origem: 'app' } })
```

- Base `EXPO_PUBLIC_API_URL` (já com `/api/v1`), JSON, timeout de 15 s. Cabeçalhos `X-Request-Id` (UUID v4), `X-App-Version` e `Authorization` — este **só** para o domínio da API (URLs pré-assinadas vão sem token).
- Todo erro vira `ApiErro { status, code, message, details, requestId, segundosParaNovaTentativa }` (o último vem do `Retry-After` do `429`). Locais (`status: 0`): `SEM_CONEXAO`, `TEMPO_ESGOTADO`; `SESSAO_ENCERRADA` (`401`) quando o refresh encerrou a sessão.
- **Regra de ouro**: só `401` de `POST /auth/refresh` encerra a sessão. Rede, timeout, 5xx, `400` (ex.: `SENHA_INCORRETA`) e qualquer outro `401` não.
- **Single-flight** (`renovar-sessao.ts`): `401` fora de `/auth/*` chama `renovarSessao()`; chamadas simultâneas aguardam a mesma promessa. Refresh `200` grava os tokens (`atualizarTokens`) antes de liberar a fila e atualiza `usuario`; a requisição é refeita **uma** vez. Um segundo `401` falha sem novo refresh e é registrado (`Sentry.captureMessage` e, em `__DEV__`, `console.warn`).
- Refresh `401` (qualquer `code`) → `encerrarSessao`, cache de queries limpo, volta ao `/login` e toast: `CONTA_DESATIVADA` → "Sua conta está desativada. Procure a diretoria."; demais → "Sua sessão expirou. Entre novamente.".
- **Renovação proativa**: faltando menos de 30 s para `accessTokenExpiraEm`, renova antes de enviar.
- Rotas `/auth/*` nunca disparam refresh: seus erros vão direto para a tela.

`aplicarErrosDaApi(form, erro)` (`aplicar-erros.ts`) leva `details[].field` (notação de ponto, ex.: `tags.0`) ao `setError` do React Hook Form e devolve `true` se aplicou algum.

## Dados — TanStack Query (`src/infra/query`, `src/infra/rede`)

`queryClient` (`query-client.ts`, `PersistQueryClientProvider` no layout raiz): `staleTime` 60 s, `gcTime` 24 h (7 dias nas queries persistidas), `retry` até 2 vezes só para `SEM_CONEXAO`, `TEMPO_ESGOTADO` e 5xx, `refetchOnReconnect`. NetInfo → `onlineManager` (offline quando `isConnected === false` ou `isInternetReachable === false`; `null` conta como online) e `AppState` → `focusManager`, ligados por `configurarRede()` (`online.ts`). `useOnline()` devolve se há conexão.

### Chaves — `chaves.ts`

Fábrica **única** de chaves (convenções §10.4). **Nunca escreva arrays literais nas telas**; chave nova = entrada nova em `chaves.ts`. Invalidação por prefixo: `queryClient.invalidateQueries({ queryKey: chaves.eventos.todos() })` invalida listas e detalhes de eventos.

| Fábrica                                                       | Chave                                                                               |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `chaves.atletica()`                                           | `['atletica']`                                                                      |
| `chaves.me()`                                                 | `['me']`                                                                            |
| `chaves.me.estatisticas()`                                    | `['me', 'estatisticas']`                                                            |
| `chaves.me.preferencias()`                                    | `['me', 'preferencias-notificacao']`                                                |
| `chaves.modalidades(f?)`                                      | `['modalidades', f]`                                                                |
| `chaves.times.lista(f)` / `.detalhe(id)` / `.elenco(id)`      | `['times', 'lista', f]` / `['times', 'detalhe', id]` / `[..., id, 'elenco']`        |
| `chaves.eventos.lista(f)` / `.detalhe(id)` / `.presencas(id)` | `['eventos', 'lista', f]` / `['eventos', 'detalhe', id]` / `[..., id, 'presencas']` |
| `chaves.noticias.lista(f)` / `.detalhe(id)`                   | `['noticias', 'lista', f]` / `['noticias', 'detalhe', id]`                          |
| `chaves.tags(f)`                                              | `['tags', f]`                                                                       |
| `chaves.banners()`                                            | `['banners']`                                                                       |
| `chaves.solicitacoes(f)`                                      | `['solicitacoes', f]`                                                               |
| `chaves.painel.noticias.lista(f)` / `.detalhe(id)`            | `['painel', 'noticias', 'lista', f]` / `['painel', 'noticias', 'detalhe', id]`      |
| `chaves.painel.banners.lista()` / `.detalhe(id)`              | `['painel', 'banners', 'lista']` / `['painel', 'banners', 'detalhe', id]`           |
| `chaves.painel.adversarias.lista(f)` / `.detalhe(id)`         | `['painel', 'atleticas-adversarias', 'lista', f]` / `[..., 'detalhe', id]`          |
| `chaves.painel.alcanceAviso(f)`                               | `['painel', 'avisos', 'alcance', f]`                                                |
| `chaves.usuarios.lista(f)` / `.detalhe(id)`                   | `['usuarios', 'lista', f]` / `['usuarios', 'detalhe', id]`                          |
| `chaves.auditoria(f)`                                         | `['auditoria', f]`                                                                  |

Prefixos: `chaves.times.todos()`, `chaves.eventos.todos()`, `chaves.noticias.todos()`, `chaves.painel.todos()`, `chaves.painel.noticias.todos()`, `chaves.usuarios.todos()`.

Listas infinitas usam `getNextPageParam: proximaPagina` (`proxima-pagina.ts`), que lê `page`, `limit` e `total` da resposta.

### Persistência offline — `persistencia.ts` (#29)

Só vão para o disco as queries com `...persistida` (`meta.persistir` + `gcTime` de 7 dias), conforme a coluna "Persistida" da tabela de chaves das convenções (§10.4). Query nova de leitura que deve aparecer offline recebe `...persistida`; dados do Painel, de usuários e de auditoria nunca.

- AsyncStorage, chave `rq-cache:<usuarioId>`, gravação a cada 1 s no máximo. Sem sessão nada é gravado nem restaurado.
- `maxAge` de 7 dias e `buster` `<versão do app>-<VERSAO_FORMATO_CACHE>`: mude `VERSAO_FORMATO_CACHE` ao alterar o formato de um dado persistido.
- `['me']` guarda só `nome`, `fotoUrl`, `papel` e `times`; `id` e e-mail voltam da sessão na restauração.
- Listas infinitas de eventos e notícias guardam só as 2 primeiras páginas; as de times guardam todas.
- A transição da sessão para `'anonimo'` (logout, exclusão de conta, refresh `401`) apaga o cache do usuário e limpa o `queryClient`.

### Mutações — `useAcaoOnline`

**Toda mutação usa `useAcaoOnline`** (`use-acao-online.ts`); `useMutation` importado em `src/features/**` é erro de lint (única exceção: logout, #60). Mesmas opções do `useMutation`; devolve o resultado dele mais `online`.

```tsx
const { mutate, isPending, online } = useAcaoOnline({
  mutationFn: (dados: Entrada) => api.post('/times', dados),
  onSuccess: () => {
    toast.sucesso('Time criado.')
    void queryClient.invalidateQueries({ queryKey: chaves.times.todos() })
  },
  onError: (erro) => aplicarErrosDaApi(form, erro),
})

<Botao disabled={!online || isPending} onPress={form.handleSubmit((dados) => mutate(dados))} />
```

- Offline, a `mutationFn` não é chamada e aparece "Sem conexão. Conecte-se à internet para concluir esta ação." (`mutateAsync` rejeita com `SEM_CONEXAO`).
- Erros: o `MutationCache` mostra `toast.erro(apiErro.message)` para toda mutação; o sucesso é toast da própria tela.
- Exceção: códigos listados em `meta.errosNaTela` não geram toast, porque a própria tela os mostra (ex.: `CREDENCIAIS_INVALIDAS` no login, `EMAIL_JA_CADASTRADO` no cadastro).
- `<AvisoOffline online={online} />` mostra a mensagem de offline abaixo do botão.

## Estados de tela — `src/components/estado`

| Componente                                                                             | Uso                                                                                                                |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `Esqueleto({ variante? })`                                                             | `lista` (padrão), `cartao`, `detalhe`                                                                              |
| `EstadoVazio({ mensagem, acao? })`                                                     | `acao = { titulo, onPress }`                                                                                       |
| `EstadoErro({ mensagem?, onTentarNovamente })`                                         | padrão "Não foi possível carregar." + "Tentar novamente"                                                           |
| `FaixaOffline({ atualizadoEm? })`                                                      | "Modo offline · dados de dd/mm/aaaa HH:mm" (America/Fortaleza); sem data: "Modo offline"                           |
| `TelaDados({ consulta, vazio?, mensagemVazio?, esqueleto?, faixaOffline?, children })` | escolhe o estado da tela a partir da consulta; `faixaOffline={false}` nas seções de uma tela que já mostra a faixa |

```tsx
const consulta = useQuery({ queryKey: chaves.eventos.lista(filtro), queryFn })

<TelaDados
  consulta={consulta}
  vazio={(dados) => dados.items.length === 0}
  mensagemVazio="Nenhum evento agendado"
>
  {(dados) => <ListaEventos itens={dados.items} />}
</TelaDados>
```

Ordem: sem dados e offline → "Sem conexão. Conecte-se à internet para carregar os dados." + "Tentar novamente"; sem dados e com erro → `EstadoErro`; sem dados → `Esqueleto`; `vazio(dados)` → `EstadoVazio`; com dados (mesmo com erro de atualização) → `children(dados)`, com `FaixaOffline atualizadoEm={consulta.dataUpdatedAt}` no topo se offline. "Tentar novamente" chama `consulta.refetch()`.

A conexão vem do `onlineManager` do TanStack Query (alimentado pelo NetInfo na #52). `FaixaOffline` só apresenta: quem a usa decide se está offline.

## Componentes base — `src/components/ui`

- `Texto({ variante? })`: `titulo` (header), `subtitulo`, `corpo` (padrão), `rotulo`, `legenda`, `erro`.
- `Cartao`: contêiner com borda e fundo `cartao`.
- `Botao({ titulo, variante?, carregando?, disabled? })`: `primaria` (cor da atlética, texto com `corTextoSobre`), `secundaria`, `perigo`. `carregando` mostra o spinner e desabilita. Muda de aparência no `onPressIn`; alvo ≥ 44 px.
- `Campo({ controle, nome, rotulo, ...TextInputProps })`: React Hook Form via `Controller`; o erro aparece abaixo do campo e os valores ficam no formulário após erro da API.
- `CampoCodigo({ valor, aoMudar, erro?, autoFocus? })`: código numérico em 6 caixas (`number-pad`, `oneTimeCode`/`sms-otp`); o foco avança ao digitar e volta no backspace; colar ou o preenchimento automático distribuem os 6 dígitos. Para limpar, o pai passa `valor=''`. Usado na recuperação de senha (#62) e na verificação de e-mail (#31).
- `CampoSenha`: `Campo` com botão de mostrar/ocultar senha.
- `CaixaSelecao({ marcada, aoAlternar, rotulo, children? })`: checkbox acessível; `children` substitui o texto visível (ex.: rótulo com links).
- `Alerta({ variante?, titulo?, children })`: caixa com ícone + título; `erro` (padrão) ou `alerta`.
- `AvisoOffline({ online })`: mensagem de ação offline.
- `TelaRolavel({ centralizada? })` (`src/components`): tela com `ScrollView` e áreas seguras para formulários e textos longos.

Formulário padrão (schema do shared, `zodResolver` em modo `onBlur` — convenções §4.3; `useAcaoOnline` e `aplicarErrosDaApi` são da #52):

```tsx
const form = useForm({ resolver: zodResolver(loginSchema), mode: 'onBlur', defaultValues })
const { online, mutate, isPending } = useAcaoOnline({
  mutationFn: entrar,
  onError: (erro) => aplicarErrosDaApi(form, erro),
})

<Campo controle={form.control} nome="email" rotulo="E-mail" keyboardType="email-address" />
<Botao
  titulo="Entrar"
  carregando={isPending}
  disabled={!online || isPending}
  onPress={() => void form.handleSubmit((dados) => mutate(dados))()}
/>
```

## Sentry — `src/infra/sentry.ts`

- `iniciarSentry()` no layout raiz: sem `EXPO_PUBLIC_SENTRY_DSN` não inicializa; `environment` = `EXPO_PUBLIC_AMBIENTE`; `release`/`dist` do `expo-application` (`<id>@<versão>+<build>`); `enabled: !__DEV__`; `sendDefaultPii: false`.
- Scrubbers: `limparBreadcrumb` remove `Authorization` e o corpo das requisições HTTP; `limparEvento` troca e-mails por `[email]` (message, extra, breadcrumbs e exceções) e deixa o usuário só com `id`. Nada de dado pessoal em `setContext`/`setExtra`.
- Usuário: `Sentry.setUser({ id })` ao autenticar e `setUser(null)` ao ficar anônimo (acompanha `useSessao`).
- Resposta 5xx da API (só do domínio da API) vira breadcrumb `http` com `requestId`, método, rota (sem query) e status, para correlacionar com os logs da API.
- `LimiteErro` (ErrorBoundary) envolve a navegação, dentro do `ProvedorTema` (a tela de erro usa o tema): erro de renderização vai ao Sentry e mostra `TelaErroFatal` ("Recarregar" → `Updates.reloadAsync()`). O layout raiz é exportado com `Sentry.wrap` e registra a navegação (rotas do Expo Router como nome de transação).
- Source maps: plugin `@sentry/react-native/expo` no `app.config.ts` e `getSentryExpoConfig` no `metro.config.js`; o `SENTRY_AUTH_TOKEN` fica só no EAS (#93).
- Abertura (RNF03): `iniciarSpanAbertura()` no layout raiz abre o span `inicio_home_pronta` (sem DSN ou em `__DEV__`, nada); a Home chama `useMarcarHomePronta(comDados)`, que o fecha uma única vez no primeiro render com dados (cache ou rede). Até a #79 a Home provisória o fecha no primeiro render. Dentro dele, o span `restaurar_cache` (`iniciarSpanRestauracao()`) mede a restauração do cache offline.

## Imagens e uploads — `src/components/imagem`, `src/features/uploads`

### `Imagem` — exibição com cache

**Toda imagem remota** passa por `Imagem` (convenções §10.8, RNF04): `expo-image` com `cachePolicy="memory-disk"`, transição de 150 ms e fundo neutro enquanto carrega. Sem URL ou com erro ao carregar, mostra o fallback: as iniciais de `nome` (avatar de perfil) ou um ícone neutro.

```tsx
<Imagem uri={usuario.fotoUrl} nome={usuario.nome} rotulo="Foto de perfil" className="h-12 w-12 rounded-full" />
<Imagem uri={noticia.imagemCapaUrl} className="aspect-video w-full rounded-xl" />
```

### `SeletorImagem` — escolher e enviar num formulário

| Prop                      | Descrição                                                                 |
| ------------------------- | ------------------------------------------------------------------------- |
| `finalidade`              | `PERFIL` (recorte 1:1), `NOTICIA` ou `BANNER` (16:9)                      |
| `valorAtualUrl?`          | URL da imagem já gravada (`fotoUrl`, `imagemCapaUrl`...)                  |
| `onChange`                | recebe a `key` do upload concluído, ou `null` ao tocar em "Remover"       |
| `formato`                 | `circulo` ou `retangulo`                                                  |
| `desabilitado?`           | bloqueia a seleção                                                        |
| `podeRemover?`            | mostra "Remover" quando há imagem (padrão `true`)                         |
| `rotulo?`, `nome?`        | rótulo acessível e iniciais do fallback                                   |
| `onMudarEnviando?`        | `true` enquanto comprime/envia: o formulário mantém o salvar desabilitado |
| `onMudarImagem?`          | URI exibida (local ou atual), ou `null`: alimenta prévias                 |
| `mensagemImagemInvalida?` | substitui as mensagens de formato e tamanho (ex.: capa de notícia)        |

O valor do campo no React Hook Form é a **`key`**; o formulário a envia no `PATCH`/`POST` do recurso (ex.: `PUT /me/foto { fotoKey }`).

```tsx
const [enviandoFoto, setEnviandoFoto] = useState(false)

<Controller
  control={form.control}
  name="fotoKey"
  render={({ field }) => (
    <SeletorImagem
      finalidade="PERFIL"
      formato="circulo"
      valorAtualUrl={usuario.fotoUrl}
      nome={usuario.nome}
      onChange={field.onChange}
      onMudarEnviando={setEnviandoFoto}
    />
  )}
/>
<Botao titulo="Salvar" disabled={!online || isPending || enviandoFoto} ... />
```

Estados: "Preparando imagem…" (comprimindo), barra de progresso (enviando), pré-visualização local desde a escolha, erro com "Tentar novamente" (pede **novo** presign e reenvia a mesma imagem comprimida). Offline fica desabilitado com "Disponível apenas online". Permissão negada mostra o toast "Permita o acesso às fotos nas configurações do Android." (ou "…à câmera…") — tocar nele abre as configurações.

### `useUploadImagem(finalidade, mensagemImagemInvalida?)` — o fluxo

`{ selecionar('galeria' | 'camera'), estado, progresso, key, uriLocal, erro, podeTentarNovamente, tentarNovamente, limpar }`, `estado` ∈ `ocioso | selecionando | comprimindo | enviando | concluido | erro`.

1. Permissão e seleção com recorte (`expo-image-picker`).
2. `comprimir(uri)`: JPEG com no máximo 1080 px de largura, qualidade 0,8 → 0,6 → 0,4 até ≤ 5 MB; senão "Imagem muito grande. Escolha outra imagem."; imagem não decodificável → "Formato de imagem não suportado.".
3. `pedirPresign({ finalidade, contentType: 'image/jpeg', tamanhoBytes })` → `POST /uploads/presign` via `useAcaoOnline` (convenções §10.5), com pedido e resposta validados pelos schemas do shared.
4. `PUT` direto ao R2 (`createUploadTask` de `expo-file-system/legacy`, `BINARY_CONTENT`) com `Content-Type`/`Content-Length` iguais aos do presign e **sem** `Authorization`.

Textos de permissão de fotos e câmera: plugin `expo-image-picker` no `app.config.ts`.
