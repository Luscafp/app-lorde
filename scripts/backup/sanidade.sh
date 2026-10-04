#!/usr/bin/env bash
# Consultas de sanidade de um banco restaurado. Uso: scripts/backup/sanidade.sh
# Env: DATABASE_URL e, opcional, MIGRATION_ESPERADA (padrão: a mais recente de
# apps/api/prisma/migrations). Termina com código ≠ 0 se alguma verificação falhar.
set -euo pipefail

: "${DATABASE_URL:?defina DATABASE_URL}"
migrations="$(cd "$(dirname "$0")/../.." && pwd)/apps/api/prisma/migrations"
esperada="${MIGRATION_ESPERADA:-$(find "$migrations" -mindepth 1 -maxdepth 1 -type d -printf '%f\n' | sort | tail -n1)}"

consultar() {
  psql "$DATABASE_URL" --no-psqlrc --tuples-only --no-align -v ON_ERROR_STOP=1 -v esperada="$esperada" <<<"$1"
}

falhas=0
verificar() {
  if [ "$2" -gt 0 ]; then echo "- ok: $1"; else echo "- FALHOU: $1" && falhas=$((falhas + 1)); fi
}

verificar "migration \`$esperada\` aplicada" "$(consultar "
  SELECT count(*) FROM _prisma_migrations
  WHERE migration_name = :'esperada' AND finished_at IS NOT NULL AND rolled_back_at IS NULL")"
verificar "\"Atletica\" com registros" "$(consultar 'SELECT count(*) FROM "Atletica"')"
verificar "\"Usuario\" com registros" "$(consultar 'SELECT count(*) FROM "Usuario"')"

[ "$falhas" -eq 0 ]
