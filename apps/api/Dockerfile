# syntax=docker/dockerfile:1
# Imagem da API (#46). Contexto = raiz do monorepo (README da API, "Docker").

ARG NODE_VERSION=24

# OpenSSL nos dois estágios: o schema-engine baixado no build precisa casar com o do runtime.
FROM node:${NODE_VERSION}-slim AS base
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

FROM base AS build
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH CI=true HUSKY=0
RUN corepack enable
WORKDIR /repo

COPY . .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile --filter api...
RUN pnpm --filter @atletica/shared build && pnpm --filter api build
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm --filter api deploy --prod --legacy /out
# O deploy pode reaproveitar do store o schema-engine de outra variante de OpenSSL; baixa o certo
# para o `migrate deploy` não depender de rede no pre-deploy.
RUN rm -f /out/node_modules/.pnpm/@prisma+engines@*/node_modules/@prisma/engines/schema-engine-* \
    && node /out/node_modules/.pnpm/@prisma+engines@*/node_modules/@prisma/engines/scripts/postinstall.js
# O Prisma CLI só lê o config em JS na imagem (sem fontes .ts).
RUN cd apps/api && node -e " \
    const ts = require('typescript'); \
    const fs = require('node:fs'); \
    const { outputText } = ts.transpileModule(fs.readFileSync('prisma.config.ts', 'utf8'), \
      { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2023 } }); \
    fs.writeFileSync('/out/prisma.config.mjs', outputText);"

FROM base AS runtime
ARG GIT_COMMIT_SHA
ENV NODE_ENV=production GIT_COMMIT_SHA=${GIT_COMMIT_SHA} CHECKPOINT_DISABLE=1
WORKDIR /app

COPY --from=build --chown=node:node /out/package.json /out/prisma.config.mjs ./
COPY --from=build --chown=node:node /out/node_modules ./node_modules
COPY --from=build --chown=node:node /repo/apps/api/dist ./dist
COPY --from=build --chown=node:node /repo/apps/api/prisma/schema.prisma ./prisma/
COPY --from=build --chown=node:node /repo/apps/api/prisma/migrations ./prisma/migrations

USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD node -e "fetch('http://localhost:'+(process.env.PORT||3000)+'/api/v1/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["node", "dist/main.js"]
