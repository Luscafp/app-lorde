#!/usr/bin/env bash
# Descriptografa um backup .dump.age e o restaura num banco vazio (#47).
# Uso: scripts/backup/restaurar.sh <arquivo.dump.age>
# Env: DATABASE_URL (banco de destino) e AGE_PRIVATE_KEY (conteúdo da chave privada age).
# O dump descriptografado vai direto para o pg_restore, sem passar pelo disco.
set -euo pipefail

arquivo="${1:?uso: restaurar.sh <arquivo.dump.age>}"
: "${DATABASE_URL:?defina DATABASE_URL}"
: "${AGE_PRIVATE_KEY:?defina AGE_PRIVATE_KEY}"

chave=$(umask 077 && mktemp)
trap 'rm -f "$chave"' EXIT
printf '%s\n' "$AGE_PRIVATE_KEY" >"$chave"

age --decrypt --identity "$chave" "$arquivo" |
  pg_restore --no-owner --no-acl --exit-on-error --dbname="$DATABASE_URL"
