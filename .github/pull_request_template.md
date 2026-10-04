## O que muda

<!-- Resumo do que foi feito e qual RF/UC/RNF atende. -->

Closes #

## Checklist

Marque o que se aplica; risque (`~~item~~`) o que não se aplica a este PR.

- [ ] Issue vinculada com `Closes #N` e escopo restrito à issue/sub-issue
- [ ] Rotas novas com testes de integração 401/403/404 (convenções §9)
- [ ] Alterou `schema.prisma`? Migration gerada e commitada (o job `prisma` confere)
- [ ] Operações do RNF09 gravam auditoria (convenções §7)
- [ ] Eventos de domínio emitidos só após o commit (convenções §8)
- [ ] Swagger atualizado (DTOs, respostas e códigos de erro)
- [ ] `pnpm lint && pnpm typecheck && pnpm test` passam localmente
- [ ] Auto-revisão feita: diff relido, sem código morto, logs sem senha/token

## Como testar

<!-- Passos para validar manualmente, se houver. -->
