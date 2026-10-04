# App (Expo + Expo Router)

Development build (não Expo Go). Comandos na raiz do monorepo: `pnpm dev:mobile`, `pnpm --filter mobile test`, `pnpm --filter mobile typecheck`.

## Variáveis de ambiente

Copie `.env.example` para `.env`. Variáveis `EXPO_PUBLIC_*` são embutidas no bundle: nunca coloque segredos nelas.

| Variável               | Exemplo                           | Uso                                                                                       |
| ---------------------- | --------------------------------- | ----------------------------------------------------------------------------------------- |
| `EXPO_PUBLIC_API_URL`  | `http://192.168.0.10:3000/api/v1` | URL base da API, **já com `/api/v1`**. No aparelho, use o IP da máquina, não `localhost`. |
| `EXPO_PUBLIC_AMBIENTE` | `development`                     | `development \| homologacao \| producao` (convenções §11.11)                              |

Novas variáveis entram em `env.d.ts` (tipagem) e em `src/config/ambiente.ts`.

## Rotas

Grupos oficiais `(publico)` e `(app)/(abas)` (convenções §3 e §11.1).

| Rota        | Arquivo                       | Acesso          |
| ----------- | ----------------------------- | --------------- |
| `/login`    | `app/(publico)/login.tsx`     | só sem sessão   |
| `/cadastro` | `app/(publico)/cadastro.tsx`  | só sem sessão   |
| `/`         | `app/(app)/(abas)/index.tsx`  | com sessão      |
| `/agenda`   | `app/(app)/(abas)/agenda.tsx` | com sessão      |
| `/times`    | `app/(app)/(abas)/times.tsx`  | com sessão      |
| `/perfil`   | `app/(app)/(abas)/perfil.tsx` | com sessão      |
| `/painel`   | `app/(app)/(abas)/painel.tsx` | nível ≥ DIRETOR |
| inexistente | `app/+not-found.tsx`          | todos           |

- **Proteção**: `Stack.Protected` no `app/_layout.tsx` (`(app)` com sessão, `(publico)` sem). Sem sessão, qualquer rota protegida cai em `/login`; ao encerrar a sessão, o app volta a `/login`.
- **Deep link protegido sem sessão**: `app/+native-intent.tsx` guarda o caminho e, depois do login, o layout raiz navega até ele (`src/infra/sessao/destino.ts`).
- **Aba Painel**: aparece só para `temNivelMinimo(papel, Papel.DIRETOR)` (`useVePainel()`); para os demais fica com `href: null` e `/painel` redireciona ao Início. A ocultação é só visual; quem autoriza é a API.
- **Telas de detalhe** (eventos, notícias...) ficam em `app/(app)/...`, acima das abas. Uma aba pode virar pasta com `_layout.tsx` (Stack) + `index.tsx`; tocar de novo na aba ativa volta à raiz dessa pilha.
- **Splash**: fica visível até a sessão (SecureStore) e a atlética (cache ou rede, até 3 s) carregarem.

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

- `carregarAtletica()` aplica o cache `atletica.v1` na hora e busca `GET /atletica` (público, sem token, limite de 3 s) para atualizar tela e cache. Sem rede e sem cache: tema neutro (`#6B7280`) e nome "Atlética".
- `useAtletica()` devolve `{ id, nome, sigla, curso, logoUrl, corPrimaria, corSecundaria, contatoEmail, contatoInstagram, contatoWhatsapp }`, já com o fallback aplicado (`id` é `null` sem dados).
- `ProvedorTema` define `--cor-primaria`/`--cor-secundaria` (`vars()` do NativeWind) no contêiner raiz. Use as classes `bg-primaria`, `text-secundaria`, `border-primaria/40` etc. A paleta escura fixa (`fundo`, `superficie`, `cartao`, `texto`, `texto-suave`, `borda`, `sucesso`, `alerta`, `erro`) está em `paleta.js` e no `tailwind.config.js`.
- `corTextoSobre(hex)` devolve `#FFFFFF` ou `#000000` (maior contraste WCAG), para texto sobre a cor primária.

Nada da atlética fica fixo no código (RNF20): `__tests__/sem-nome-fixo.test.ts` falha se `app/` ou `src/` citarem o nome da atlética.

## Toasts — `src/components/ui/toast.ts`

`toast.sucesso(msg)`, `toast.erro(msg)`, `toast.info(msg)`. O `<Toast config={toastConfig} />` está montado no layout raiz; `src/components/ui/toast-config.tsx` define as variantes `sucesso`, `erro` e `info` (ícone + texto, lidas pelo leitor de tela como "Sucesso: …", "Erro: …", "Aviso: …").

## Estados de tela — `src/components/estado`

| Componente                                                              | Uso                                                                                      |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `Esqueleto({ variante? })`                                              | `lista` (padrão), `cartao`, `detalhe`                                                    |
| `EstadoVazio({ mensagem, acao? })`                                      | `acao = { titulo, onPress }`                                                             |
| `EstadoErro({ mensagem?, onTentarNovamente })`                          | padrão "Não foi possível carregar." + "Tentar novamente"                                 |
| `FaixaOffline({ atualizadoEm? })`                                       | "Modo offline · dados de dd/mm/aaaa HH:mm" (America/Fortaleza); sem data: "Modo offline" |
| `TelaDados({ consulta, vazio?, mensagemVazio?, esqueleto?, children })` | escolhe o estado da tela a partir da consulta                                            |

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
