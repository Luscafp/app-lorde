#!/usr/bin/env bash
# Aguarda o /health responder "ok" com o commit do deploy (#47).
# Uso: aguardar-health.sh <url-base-da-api> <commit>
# Env opcionais: TENTATIVAS (padrão 10) e INTERVALO (segundos entre tentativas, padrão 60).
set -euo pipefail

url="${1%/}/api/v1/health"
esperado="${2:0:7}"

for tentativa in $(seq 1 "${TENTATIVAS:-10}"); do
  sleep "${INTERVALO:-60}"
  corpo=$(curl -fsS --max-time 10 "$url" 2>/dev/null || true)
  echo "Tentativa $tentativa: ${corpo:-sem resposta 200}"
  if [ "$(jq -r '"\(.status) \(.commit)"' <<<"$corpo" 2>/dev/null)" = "ok $esperado" ]; then
    exit 0
  fi
done

echo "::error::$url não respondeu \"ok\" com o commit $esperado."
exit 1
