# syntax=docker/dockerfile:1

# ---- build: Nx + Vite production build of apps/core ----
FROM node:22-slim AS build
ENV NX_NO_CLOUD=true \
    NX_DAEMON=false \
    CYPRESS_INSTALL_BINARY=0 \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0
WORKDIR /app

# pnpm version comes from "packageManager" in package.json, so CI and the image cannot drift.
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

# Vite inlines VITE_* values into the JS at build time. Railway only passes a service variable to the
# build when the Dockerfile declares it, so declare it here, before the build step. It is not baked
# in as a default: an empty value would reach the app as "" (not undefined), bypass its localhost
# fallback and send API calls to this nginx instead, so fail the build rather than ship that.
ARG VITE_CORE_API_URL
ENV VITE_CORE_API_URL=$VITE_CORE_API_URL
RUN test -n "$VITE_CORE_API_URL" || { echo "ERROR: build arg VITE_CORE_API_URL is required (e.g. https://api.example.com/api/v1)" >&2; exit 1; }
RUN pnpm exec nx build core

# ---- runtime: static files behind nginx ----
FROM nginx:alpine
# The nginx image runs envsubst over /etc/nginx/templates/*.template at start-up, so $PORT lands in the config.
ENV PORT=8080
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist/apps/core /usr/share/nginx/html
EXPOSE 8080
