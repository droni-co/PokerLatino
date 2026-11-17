# Contexto de build: raíz del monorepo (workspace de pnpm + pnpm-lock.yaml)
#   docker build -f apps/api/Dockerfile .

# ---- App web (Flutter) → se sirve desde public/ ----
# FLUTTER_VERSION debe coincidir con la del proyecto (apps/app/.metadata → revision).
FROM debian:bookworm-slim AS web
ARG FLUTTER_VERSION=3.50.0
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl git unzip xz-utils \
  && rm -rf /var/lib/apt/lists/*
RUN curl -fsSL https://storage.googleapis.com/flutter_infra_release/releases/stable/linux/flutter_linux_${FLUTTER_VERSION}-stable.tar.xz \
  | tar -xJ -C /opt && git config --global --add safe.directory /opt/flutter
ENV PATH=/opt/flutter/bin:$PATH
RUN flutter config --no-analytics --enable-web && flutter precache --web
WORKDIR /src/apps/app
COPY apps/app/pubspec.yaml apps/app/pubspec.lock ./
RUN flutter pub get
COPY apps/app ./
RUN flutter build web --release --output /out

# ---- Base con pnpm (versión de "packageManager" vía corepack) ----
FROM node:24-slim AS base
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/

# ---- Build de la API ----
FROM base AS build
RUN pnpm install --frozen-lockfile --filter @poker-latino/api
COPY apps/api apps/api
# .env de relleno para que los hooks del build puedan arrancar la app; no se usa en runtime
RUN cd apps/api && printf '%s\n' \
  TZ=UTC PORT=3333 HOST=0.0.0.0 NODE_ENV=production LOG_LEVEL=info \
  APP_KEY=build-only-placeholder-key-000000 APP_URL=http://localhost:3333 \
  DB_HOST=localhost DB_PORT=5432 DB_USER=build DB_DATABASE=build > .env
RUN pnpm --filter @poker-latino/api build
# Dependencias de producción autocontenidas (sin symlinks al workspace)
RUN pnpm --filter @poker-latino/api deploy --prod --legacy /prod

# ---- Producción ----
FROM node:24-slim
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /prod/node_modules ./node_modules
COPY --from=build /app/apps/api/build ./
COPY --from=web /out ./public
COPY apps/api/docker/entrypoint.sh /usr/local/bin/entrypoint.sh
USER node
EXPOSE 3333
ENTRYPOINT ["entrypoint.sh"]
CMD ["node", "bin/server.js"]
