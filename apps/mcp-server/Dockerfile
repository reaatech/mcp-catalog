# syntax=docker/dockerfile:1

# Build stage
FROM node:26-alpine AS builder

WORKDIR /app

RUN npm install -g pnpm@9

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.json ./
COPY apps/mcp-server/package.json ./apps/mcp-server/
COPY packages/shared/package.json ./packages/shared/

RUN pnpm install --frozen-lockfile --filter @reaatech/mcp-catalog-mcp-server...

COPY apps/mcp-server ./apps/mcp-server
COPY packages/shared ./packages/shared

RUN pnpm -F @reaatech/mcp-catalog-shared build && pnpm -F @reaatech/mcp-catalog-mcp-server build

# Production stage
FROM node:26-alpine AS production

WORKDIR /app

RUN npm install -g pnpm@9

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/mcp-server/package.json ./apps/mcp-server/
COPY packages/shared/package.json ./packages/shared/

RUN pnpm install --frozen-lockfile --prod --filter @reaatech/mcp-catalog-mcp-server...

COPY --from=builder /app/apps/mcp-server/dist ./apps/mcp-server/dist
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD node -e "process.exit(0)"

USER nodejs

ENTRYPOINT ["node", "apps/mcp-server/dist/index.js"]
