# Teste de carga (k6)

Valida o **RNF05**: 200 atletas simultâneos mantendo o **RNF03** (p95 ≤ 500 ms em consultas e ≤ 1 s em gravações). Especificação: épico #30 §3.6; entrega: #83; execução em homologação e aceite: #95.

| Arquivo              | Função                                                                 |
| -------------------- | ---------------------------------------------------------------------- |
| `cenario-atletas.js` | Cenário k6 (`ramping-vus`) com os pesos e thresholds do épico.         |
| `seed-carga.ts`      | Cria a massa de carga (só homologação; idempotente).                   |
| `limpar-carga.ts`    | Remove a massa de carga e nada mais.                                   |
| `massa-carga.ts`     | Trava de ambiente e nomes da massa, compartilhados pelos dois scripts. |

O teste de integração dos scripts fica em `apps/api/test/carga/` e roda na CI com os demais (`pnpm --filter api test`). A CI também roda `k6 inspect` no cenário e o `actionlint` nos workflows (job `carga`).

## Pré-requisitos

- [k6](https://grafana.com/docs/k6/latest/set-up/install-k6/) ≥ 1.0.
- API no ar com as migrations aplicadas e o seed base (`pnpm --filter api prisma:seed`), que cria a atlética padrão e as modalidades.
- Dependências instaladas (`pnpm install`).

## Variáveis

| Variável                                     | Usada por     | Descrição                                                                                                           |
| -------------------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------- |
| `AMBIENTE`                                   | seed, limpeza | Obrigatória: `homologacao`. (`teste` só é aceito em banco cujo nome termina em `_test`, para o teste automatizado.) |
| `DATABASE_URL`                               | seed, limpeza | Banco de homologação.                                                                                               |
| `DATABASE_URL_PRODUCAO`                      | seed, limpeza | Opcional e recomendada: se apontar para o mesmo servidor/banco da `DATABASE_URL`, os scripts recusam.               |
| `APP_ENV`                                    | seed, limpeza | Com `producao`, os scripts recusam.                                                                                 |
| `CARGA_SENHA`                                | seed, k6      | Senha dos 200 usuários de carga (política do UC06). No GitHub, segredo `CARGA_SENHA`.                               |
| `API_URL`                                    | k6            | URL base da API, **sem** `/api/v1` (padrão `http://localhost:3000`).                                                |
| `VUS`, `USUARIOS`                            | k6            | VUs simultâneos (padrão 200) e usuários da massa (padrão 200).                                                      |
| `RAMPA`, `DURACAO`, `DESCIDA`                | k6            | Estágios do `ramping-vus` (padrão `2m`, `10m`, `1m`).                                                               |
| `LIMITE_P95_CONSULTA`, `LIMITE_P95_GRAVACAO` | k6            | Limites do p95 em ms (padrão 500 e 1000). Só para provar a falha do threshold; nunca afrouxe numa execução oficial. |
| `LOGINS_POR_MINUTO`                          | k6            | Ativa o cenário opcional de logins reais (ex.: `20`). Fica fora dos thresholds.                                     |

### Trava de ambiente

`seed-carga` e `limpar-carga` validam o ambiente **antes de abrir conexão** e saem com código 1 e a mensagem `Massa de carga só pode ser criada em homologação.` quando `AMBIENTE` não é `homologacao` (ou está ausente), quando `APP_ENV=producao` ou quando a `DATABASE_URL` coincide com a `DATABASE_URL_PRODUCAO`.

## Massa de carga

- 200 atletas `carga+001@teste.local` … `carga+200@teste.local`, papel `ATLETA`, e-mail verificado, senha `CARGA_SENHA`.
- 10 times `[Carga] Time 01` … `10` na atlética padrão, com 20 atletas cada (`carga+NNN` joga no time `((NNN − 1) % 10) + 1`).
- Atlética adversária `carga-adversaria` (sem app) com um time por modalidade, para os jogos.
- 300 eventos (30 por time): 20 futuros `AGENDADO` (treinos e jogos alternados, a partir de amanhã, a cada 3 dias) e 10 jogos `FINALIZADO` com placar.
- 100 notícias publicadas `[Carga] Notícia 001` … `100`.

O seed é idempotente: completa o que falta e regrava a senha dos usuários de carga com a `CARGA_SENHA` atual. A limpeza remove os usuários `carga+*@teste.local`, os times `[Carga] *` da atlética padrão, a atlética `carga-adversaria` e tudo que depende deles (participações, eventos, elencos, solicitações, sessões, notícias). Os eventos futuros vencem em ~60 dias: para repetir o teste depois disso, limpe e semeie de novo.

## Execução em homologação

```sh
export AMBIENTE=homologacao
export DATABASE_URL='postgresql://...homologacao...'
export DATABASE_URL_PRODUCAO='postgresql://...producao...'
export CARGA_SENHA='...'

pnpm carga:seed          # 1. massa
# 2. k6 — pelo GitHub (recomendado) ou localmente:
k6 run --summary-export=resultado.json -e API_URL=https://api-homolog.exemplo.com.br tests/carga/cenario-atletas.js
# 3. anexe resultado.json (ou o artefato do workflow) à issue de release
pnpm carga:limpar        # 4. limpeza
```

Pelo GitHub: **Actions → Teste de carga (k6) → Run workflow**, com `api_url` (obrigatório, `https://`), `vus` e `duracao`. O workflow só existe como `workflow_dispatch`, lê a senha do segredo `CARGA_SENHA`, publica `resultado.json` como artefato `resultado-carga-<n>`, escreve os p95 no resumo da execução e falha quando o k6 sai com código ≠ 0.

O seed e a limpeza rodam de uma máquina com acesso ao banco de homologação; o workflow não acessa o banco.

## Fumaça local

Com a API do docker-compose no ar (`pnpm db:up`, `pnpm --filter api prisma:deploy`, `pnpm --filter api prisma:seed`, `pnpm dev:api`) e um banco cujo nome termina em `_test`, ou com `AMBIENTE=homologacao` apontando para o banco local:

```sh
AMBIENTE=homologacao DATABASE_URL=postgresql://atletica:atletica@localhost:5432/atletica_dev CARGA_SENHA=carga2026 pnpm carga:seed

k6 run -e CARGA_SENHA=carga2026 -e VUS=5 -e RAMPA=5s -e DURACAO=30s -e DESCIDA=5s tests/carga/cenario-atletas.js
echo $?   # 0

# threshold forçado: precisa sair com 99
k6 run -e CARGA_SENHA=carga2026 -e VUS=5 -e RAMPA=5s -e DURACAO=30s -e DESCIDA=5s -e LIMITE_P95_CONSULTA=1 tests/carga/cenario-atletas.js
echo $?   # 99
```

## Cenário

- `setup()` faz **um login por VU** (cada VU tem a própria sessão, porque o refresh rotaciona o token) e reaproveita os tokens: o Argon2id não é medido a cada iteração. Requisições do `setup` têm a tag `tipo:setup` e ficam fora dos thresholds de latência.
- Cada iteração sorteia uma requisição e pausa 3–8 s (_think time_). O VU renova a sessão sozinho quando o access token está a menos de 1 min de vencer.

| Peso | Requisição                                                      | Tag `tipo` |
| ---- | --------------------------------------------------------------- | ---------- |
| 25%  | `GET /eventos?page=1&limit=20`                                  | consulta   |
| 15%  | `GET /eventos/:id` (um da última lista)                         | consulta   |
| 15%  | `GET /noticias?page=1&limit=20`                                 | consulta   |
| 10%  | `GET /eventos?periodo=PASSADOS&status=FINALIZADO` (placar)      | consulta   |
| 10%  | `GET /me`                                                       | consulta   |
| 5%   | `GET /atletica`                                                 | consulta   |
| 5%   | `GET /times`                                                    | consulta   |
| 10%  | `PUT /eventos/:id/participacao` (evento futuro do próprio time) | gravação   |
| 5%   | `POST /auth/refresh`                                            | gravação   |

O placar usa `periodo=PASSADOS` porque o período padrão da lista (`PROXIMOS`) não inclui eventos finalizados (#75).

## Thresholds

| Métrica                            | Limite       | Origem           |
| ---------------------------------- | ------------ | ---------------- |
| `http_req_duration{tipo:consulta}` | `p(95)<500`  | RNF03            |
| `http_req_duration{tipo:gravacao}` | `p(95)<1000` | RNF03            |
| `http_req_failed`                  | `rate<0.01`  | [Sugestão] épico |
| `checks`                           | `rate>0.99`  | [Sugestão] épico |

Qualquer threshold violado faz o k6 sair com código **99** (falha do job). Código 107 indica erro no script, normalmente o login do `setup` falhando: massa não criada ou `CARGA_SENHA` diferente da usada no seed. No resumo, compare também p50/p95/p99 por rota (tag `rota`) para achar o gargalo.

## Rate limit

Não há limitador global por IP: o único limite é o `RateLimitService` (convenções §11.3), que conta falhas de login, e o cenário só faz logins válidos. Se algum limite atrapalhar, ajuste por variável de ambiente de homologação — **nunca** com um cabeçalho de bypass.

## Cenário opcional: logins reais [Sugestão]

`-e LOGINS_POR_MINUTO=20` adiciona 20 logins/min (taxa constante) durante o patamar, com a tag `tipo:login`, para medir o custo do Argon2id sob carga. Os logins ficam fora dos thresholds de latência; confira o p95 de `http_req_duration{tipo:login}` no resumo.
