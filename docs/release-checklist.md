# Checklist de release

Checklist repetível de cada versão (épico #30 §3.7). Copie a seção **Checklist** para a issue ou o PR de release, marque cada item com o link da evidência e só publique com todos marcados. O primeiro uso é a v1.0.0 (#95).

**Responsável:** _humano_ = pessoa da equipe com acesso à conta, ao aparelho ou ao ambiente; _agente_ = pode ser conferido por um agente a partir do repositório e da CI.

## Checklist

Versão: `vX.Y.Z` · Data: `AAAA-MM-DD` · Responsável pela release: `@...`

- [ ] **1. Milestone e CI** — todas as issues do milestone fechadas; CI verde na `main`.
      Origem: #41 · Responsável: agente (confere milestone e checks da `main`).
- [ ] **2. Homologação estável** — migrações aplicadas em homologação sem erro; deploy de homologação estável por ≥ 48 h.
      Origem: #47, #92 · Responsável: humano.
- [ ] **3. Desempenho** — teste de carga k6 aprovado (p95 consultas < 500 ms, p95 gravações < 1 s, erro < 1%, checks > 99%) com o `resultado.json` anexado; abertura a frio ≤ 3 s no aparelho de 2 GB registrada.
      Origem: #83 (scripts, `tests/carga/README.md`), #82 (span de abertura), #95 (execução) · Responsável: humano.
- [ ] **4. Validação funcional** — diretoria valida o APK `preview` com o roteiro dos UCs do MVP; aceite registrado.
      Origem: #95 · Responsável: humano.
- [ ] **5. Backup** — backup de produção verificado e último teste de restauração há ≤ 30 dias (RNF10).
      Origem: #47, #92 · Responsável: humano.
- [ ] **6. Sentry** — release criado, _source maps_ enviados (plugin `@sentry/react-native/expo`) e alertas ativos.
      Origem: #48, #49, #93 · Responsável: humano.
- [ ] **7. Administrador inicial** — conta Administrador real criada pelo seed de produção e senha trocada no primeiro acesso.
      Origem: #45 · Responsável: humano.
- [ ] **8. Termos e Privacidade** — texto final (8.5) disponível no app.
      Origem: #14, #59 · Responsável: humano (texto); agente confere que a versão publicada está no app.
- [ ] **9. Versão** — versão incrementada (`apps/mobile` e `apps/api/package.json`, que o `GET /health` devolve em `versao`), tag Git criada e notas da versão escritas.
      Origem: #82 (versionamento), #46 (`/health`) · Responsável: agente (prepara versão e notas); humano (cria a tag).
- [ ] **10. Build de produção** — build gerado; instalação testada em Android 8.0 (API 26) e no aparelho de 2 GB.
      Origem: #82 (configuração), #95 (build e instalação) · Responsável: humano.
- [ ] **11. Plano de rollback** — OTA anterior republicável (`eas update:republish`); imagem Docker anterior da API reimplantável na Railway.
      Origem: #82 (OTA), #47 (deploy da API) · Responsável: humano.

## Evidências

| Item | Link |
| ---- | ---- |
| 3    |      |
| 4    |      |
| 5    |      |
| 6    |      |
| 10   |      |
