#!/bin/sh
# Confere a imagem da API (#46; épico #4, critério 11): não-root, sem .env, sem fontes .ts e
# sem devDependencies. Uso: sh scripts/verificar-imagem.sh [imagem]
set -eu

IMAGEM="${1:-atletica-api}"

docker run --rm --entrypoint sh "$IMAGEM" -c '
  set -eu
  falhas=0
  falhar() { echo "FALHOU: $1"; falhas=$((falhas + 1)); }

  [ "$(id -u)" != "0" ] && echo "ok: roda como $(id -un) (uid $(id -u))" || falhar "roda como root"

  envs=$(find / -xdev -name ".env*" -not -path "/proc/*" 2>/dev/null || true)
  [ -z "$envs" ] && echo "ok: sem .env" || falhar "arquivos .env: $envs"

  fontes=$(find /app -name "*.ts" -not -name "*.d.ts" -not -path "*/node_modules/*" || true)
  [ -z "$fontes" ] && echo "ok: sem fontes .ts" || falhar "fontes .ts: $fontes"

  antes=$falhas
  for dev in @nestjs/cli @nestjs/testing jest supertest tsx @swc/jest pino-pretty; do
    [ ! -e "/app/node_modules/$dev" ] || falhar "devDependency na imagem: $dev"
  done
  [ "$falhas" -eq "$antes" ] && echo "ok: sem devDependencies"

  [ "$falhas" -eq 0 ]
'
