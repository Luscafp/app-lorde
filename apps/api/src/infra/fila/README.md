# Fila (`infra/fila`, pg-boss)

Dono: #86 (convenções §11.6). Consumidores: #87 (envio de notificações) e #90 (lembretes).

## Versão fixada: `pg-boss@11.1.2`

A v12 é ESM-only e a API compila em CommonJS (`module: Node16`): o `tsc` rejeita o import (TS1479) e o Jest não carrega o pacote. Mesma situação do NestJS 12 — o Dependabot ignora a major e a migração vem num PR próprio. Tudo abaixo vale para a 11.1.2 e foi conferido no código-fonte e em `test/fila/fila.e2e-spec.ts`.

## Registrar uma fila

```ts
// filas-dominio.ts
export interface FilasDominio {
  'notificacao.lembrete': { atleticaId: string; eventoId: string; horas: number }
}

// no onModuleInit do módulo consumidor
await this.fila.criarFila('notificacao.lembrete', { policy: 'stately', retryLimit: 3 })
await this.fila.trabalhar('notificacao.lembrete', (payload, job) => this.lembrar(payload))
await this.fila.enviar('notificacao.lembrete', payload, { startAfter, singletonKey: chave })
```

- Nomes `dominio.acao-kebab` (convenções §2), até 50 caracteres.
- `criarFila` antes de `enviar`, `trabalhar` e `agendar` (o pg-boss recusa fila inexistente). É idempotente; a **política não muda** depois de criada (para trocar, crie outra fila), as demais opções são atualizadas a cada subida.
- `agendar(nome, cron, { tz })` usa `FUSO_PADRAO` (America/Fortaleza) por padrão e grava o cron em `pgboss.schedule`; o pg-boss coordena entre instâncias, um disparo por horário.

## `singletonKey` por política

| Política    | Unicidade por `(fila, singletonKey)`                            | 2 envios com a mesma chave, antes do processamento |
| ----------- | --------------------------------------------------------------- | -------------------------------------------------- |
| `standard`  | nenhuma (só com `singletonSeconds`: um job por janela de tempo) | 2 jobs                                             |
| `short`     | um job `created`; outro pode entrar enquanto o primeiro roda    | 1 job                                              |
| `singleton` | um job `active`; vários podem ficar na fila                     | **2 jobs** (rodam um de cada vez)                  |
| `stately`   | um job por estado (`created`, `retry`, `active`)                | 1 job                                              |
| `exclusive` | um job entre `created`, `retry` e `active`                      | 1 job                                              |

- O envio descartado devolve `null` em `enviar` (sem erro).
- O épico #36 §14 sugeria `singleton` para os lembretes, mas na v11 ela **não deduplica** jobs na fila. Para idempotência use **`stately`** (permite reagendar enquanto um envio roda) ou `exclusive` (um único job vivo por chave).

## Retry

- Padrões do pg-boss: `retryLimit: 2`, `retryDelay: 0`, sem backoff, `expireInSeconds: 900`. Defina por fila em `criarFila` ou por job em `enviar`.
- A tentativa _n_ tem `job.retryCount = n - 1`; o job falha de vez quando `retryCount === retryLimit` (com `retryLimit: 3`, até 4 execuções).
- Com `retryBackoff: true`, a espera é `retryDelay + 2^c/2 × (1 + aleatório)` segundos (c = nº da tentativa), limitada por `retryDelayMax`.
- Só a falha da última tentativa vai ao Sentry (`capturarErroJob`, tag `job=<fila>`, sem payload); as anteriores geram `warn` no log. Exceção: a tentativa que estoura `expireInSeconds` é falhada pelo próprio pg-boss e não chega ao Sentry.
- Erros internos do pg-boss vão ao Sentry com a tag `componente=pg-boss`.
- Com `batchSize > 1`, cada job do lote falha ou conclui sozinho.

## Encerramento

`stop({ graceful: true, timeout: 30 s })` no `onModuleDestroy`: para de buscar jobs, espera os em execução e, passado o limite, marca os restantes como falhos (voltam pelo retry). O `PrismaService` só desconecta depois, no `onApplicationShutdown`.
