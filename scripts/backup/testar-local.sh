#!/usr/bin/env bash
# Teste local dos scripts de backup e restauração, sem R2 (#47). Uso: scripts/backup/testar-local.sh
# Env: DATABASE_URL de um banco com as migrations e o seed aplicados, sem parâmetros na URL.
# Cria e apaga bancos temporários no mesmo servidor e usa um par de chaves age descartável.
set -euo pipefail

: "${DATABASE_URL:?defina DATABASE_URL}"
dir="$(cd "$(dirname "$0")" && pwd)"
servidor="${DATABASE_URL%/*}"
restaurado="$servidor/backup_teste_restaurado"
vazio="$servidor/backup_teste_vazio"

sql() { PGOPTIONS='-c client_min_messages=warning' psql "$DATABASE_URL" --no-psqlrc -q -v ON_ERROR_STOP=1 -c "$1"; }
apagar_bancos() {
  sql 'DROP DATABASE IF EXISTS backup_teste_restaurado'
  sql 'DROP DATABASE IF EXISTS backup_teste_vazio'
}
falhar() { echo "FALHOU: $1" >&2 && exit 1; }

apagar_bancos
tmp="$(mktemp -d)"
trap 'apagar_bancos; rm -rf "$tmp"' EXIT
sql 'CREATE DATABASE backup_teste_restaurado'
sql 'CREATE DATABASE backup_teste_vazio'

age-keygen -o "$tmp/chave" 2>/dev/null
AGE_PUBLIC_KEY="$(age-keygen -y "$tmp/chave")"
AGE_PRIVATE_KEY="$(cat "$tmp/chave")"
export AGE_PUBLIC_KEY AGE_PRIVATE_KEY

echo "1. backup criptografado"
arquivo="$("$dir/backup.sh" atletica-teste "$tmp")"
[ ! -e "${arquivo%.age}" ] || falhar "dump sem criptografia ficou no disco"

echo "2. pg_restore direto do .dump.age falha"
if pg_restore --no-owner --dbname="$restaurado" "$arquivo" 2>/dev/null; then
  falhar "o .dump.age foi restaurado sem a chave privada"
fi

echo "3. restauração descriptografada num banco vazio e sanidade"
DATABASE_URL="$restaurado" "$dir/restaurar.sh" "$arquivo"
DATABASE_URL="$restaurado" "$dir/sanidade.sh"

echo "4. dump abaixo de 10 kB faz o backup falhar"
if DATABASE_URL="$vazio" "$dir/backup.sh" atletica-vazio "$tmp" >/dev/null 2>&1; then
  falhar "backup de banco vazio terminou com sucesso"
fi
ls "$tmp"/atletica-vazio-* >/dev/null 2>&1 && falhar "backup rejeitado deixou arquivos"

echo "ok: todos os testes passaram"
