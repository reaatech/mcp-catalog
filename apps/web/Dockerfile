# syntax=docker/dockerfile:1

# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9 --activate

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.json ./
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/

RUN pnpm install --frozen-lockfile --filter web...

COPY apps/web ./apps/web
COPY packages/shared ./packages/shared

RUN pnpm -F shared build && pnpm -F web build

# Production stage
FROM nginx:alpine AS production

RUN apk add --no-cache wget

COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf

COPY --from=builder /app/apps/web/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:80/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
