#!/usr/bin/env bash
# Dump do Postgres criptografado com age (#47). Uso: scripts/backup/backup.sh <prefixo> [diretorio]
# Env: DATABASE_URL, AGE_PUBLIC_KEY e, opcional, TAMANHO_MINIMO_BYTES (padrão 10240).
# Imprime na saída padrão só o caminho do <prefixo>-AAAA-MM-DDTHHMMZ.dump.age gerado.
set -euo pipefail

prefixo="${1:?uso: backup.sh <prefixo> [diretorio]}"
destino="${2:-.}"
: "${DATABASE_URL:?defina DATABASE_URL}"
: "${AGE_PUBLIC_KEY:?defina AGE_PUBLIC_KEY}"
minimo="${TAMANHO_MINIMO_BYTES:-10240}"

dump="$destino/$prefixo-$(date -u +%Y-%m-%dT%H%MZ).dump"
cifrado="$dump.age"
trap 'rm -f "$dump"' EXIT

pg_dump --format=custom --no-owner --no-acl --file="$dump" "$DATABASE_URL"

tamanho=$(wc -c <"$dump")
if [ "$tamanho" -lt "$minimo" ]; then
  echo "Dump com $tamanho bytes, abaixo do mínimo de $minimo: banco vazio ou dump incompleto." >&2
  exit 1
fi

age --encrypt --recipient "$AGE_PUBLIC_KEY" --output "$cifrado" "$dump"

resumo="### Backup $(basename "$cifrado")

| Dump | Criptografado | SHA-256 (criptografado) |
| --- | --- | --- |
| $tamanho bytes | $(wc -c <"$cifrado") bytes | \`$(sha256sum "$cifrado" | cut -d' ' -f1)\` |"
echo "$resumo" >&2
if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then echo "$resumo" >>"$GITHUB_STEP_SUMMARY"; fi

echo "$cifrado"
