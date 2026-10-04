#!/usr/bin/env bash
# Dump do Postgres criptografado com age. Uso: scripts/backup/backup.sh <prefixo> [diretorio]
# Env: DATABASE_URL, AGE_PUBLIC_KEY e, opcional, TAMANHO_MINIMO_BYTES (padrão 10240).
# Imprime na saída padrão só o caminho do <prefixo>-AAAA-MM-DDTHHMMZ.dump.age gerado.
set -euo pipefail

prefixo="${1:?uso: backup.sh <prefixo> [diretorio]}"
destino="${2:-.}"
: "${DATABASE_URL:?defina DATABASE_URL}"
: "${AGE_PUBLIC_KEY:?defina AGE_PUBLIC_KEY}"
minimo="${TAMANHO_MINIMO_BYTES:-10240}"

cifrado="$destino/$prefixo-$(date -u +%Y-%m-%dT%H%MZ).dump.age"
concluido=
trap '[ -n "$concluido" ] || rm -f "$cifrado"' EXIT

pg_dump --format=custom --no-owner --no-acl "$DATABASE_URL" |
  age --encrypt --recipient "$AGE_PUBLIC_KEY" --output "$cifrado"

tamanho=$(wc -c <"$cifrado")
if [ "$tamanho" -lt "$minimo" ]; then
  echo "Backup com $tamanho bytes, abaixo do mínimo de $minimo: banco vazio ou dump incompleto." >&2
  exit 1
fi

resumo="### Backup $(basename "$cifrado")

| Tamanho | SHA-256 |
| --- | --- |
| $tamanho bytes | \`$(sha256sum "$cifrado" | cut -d' ' -f1)\` |"
echo "$resumo" >&2
if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then echo "$resumo" >>"$GITHUB_STEP_SUMMARY"; fi

concluido=1
echo "$cifrado"
