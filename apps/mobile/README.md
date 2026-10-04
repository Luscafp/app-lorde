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

`toast.sucesso(msg)`, `toast.erro(msg)`, `toast.info(msg)`. O `<Toast />` está montado no layout raiz com a aparência padrão; a aparência própria é da #53.
