#!/usr/bin/env bash
# Aguarda a CI (ci.yml) do push do commit terminar e falha se não estiver verde.
# Uso: aguardar-ci.sh <commit>. Env: GH_TOKEN, GITHUB_REPOSITORY e, opcional, INTERVALO (s, padrão 30).
set -euo pipefail

commit="${1:?uso: aguardar-ci.sh <commit>}"

while true; do
  execucao=$(gh run list --repo "$GITHUB_REPOSITORY" --workflow ci.yml --commit "$commit" \
    --event push --limit 1 --json status,conclusion,url --jq '.[0] // empty')
  if [ -z "$execucao" ]; then
    echo "CI de $commit ainda não começou."
  elif [ "$(jq -r .status <<<"$execucao")" != completed ]; then
    echo "CI em andamento: $(jq -r .url <<<"$execucao")"
  elif [ "$(jq -r .conclusion <<<"$execucao")" = success ]; then
    echo "CI verde: $(jq -r .url <<<"$execucao")"
    exit 0
  else
    echo "::error::CI de $commit terminou com '$(jq -r .conclusion <<<"$execucao")': $(jq -r .url <<<"$execucao")"
    exit 1
  fi
  sleep "${INTERVALO:-30}"
done
