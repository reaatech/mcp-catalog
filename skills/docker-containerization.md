# Skill: Docker Containerization

## Purpose

Create Docker configurations for all services in the mcp-catalog project. This skill covers multi-stage builds, Docker Compose for local development, and production-ready container configurations.

## Prerequisites

- Basic understanding of Docker
- Project code ready for containerization
- Familiarity with container concepts

## Tools Required

- Docker
- Docker Compose
- pnpm

## Steps

### 1. Create API Dockerfile

Create `apps/api/Dockerfile`:

```dockerfile
# syntax=docker/dockerfile:1

# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Enable pnpm
RUN corepack enable && corepack prepare pnpm@8 --activate

# Copy workspace configuration
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/

# Install dependencies (all for build)
RUN pnpm install --frozen-lockfile --filter api...

# Copy source code
COPY apps/api ./apps/api
COPY packages/shared ./packages/shared

# Build application
RUN pnpm -F api build

# Production stage
FROM node:20-alpine AS production

# Install runtime dependencies
RUN apk add --no-cache dumb-init

WORKDIR /app

# Enable pnpm
RUN corepack enable && corepack prepare pnpm@8 --activate

# Copy workspace configuration
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod --filter api...

# Copy built application from builder
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

USER nodejs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start application
CMD ["node", "apps/api/dist/index.js"]
```

### 2. Create Web Dockerfile

Create `apps/web/Dockerfile`:

```dockerfile
# syntax=docker/dockerfile:1

# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Enable pnpm
RUN corepack enable && corepack prepare pnpm@8 --activate

# Copy workspace configuration
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/

# Install dependencies
RUN pnpm install --frozen-lockfile --filter web...

# Copy source code
COPY apps/web ./apps/web
COPY packages/shared ./packages/shared

# Build application
RUN pnpm -F web build

# Production stage
FROM nginx:alpine AS production

# Copy custom nginx configuration
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf

# Copy built application
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html

# Copy nginx security headers config
COPY apps/web/nginx-security.conf /etc/nginx/security.conf

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:80/health || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
```

### 3. Create MCP Server Dockerfile

Create `apps/mcp-server/Dockerfile`:

```dockerfile
# syntax=docker/dockerfile:1

# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Enable pnpm
RUN corepack enable && corepack prepare pnpm@8 --activate

# Copy workspace configuration
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/mcp-server/package.json ./apps/mcp-server/
COPY packages/shared/package.json ./packages/shared/

# Install dependencies
RUN pnpm install --frozen-lockfile --filter mcp-server...

# Copy source code
COPY apps/mcp-server ./apps/mcp-server
COPY packages/shared ./packages/shared

# Build application
RUN pnpm -F mcp-server build

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Enable pnpm
RUN corepack enable && corepack prepare pnpm@8 --activate

# Copy workspace configuration
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/mcp-server/package.json ./apps/mcp-server/
COPY packages/shared/package.json ./packages/shared/

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod --filter mcp-server...

# Copy built application from builder
COPY --from=builder /app/apps/mcp-server/dist ./apps/mcp-server/dist
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

USER nodejs

# MCP server runs on stdio, no port exposure needed
# The container is meant to be run as a subprocess

ENTRYPOINT ["node", "apps/mcp-server/dist/index.js"]
```

### 4. Create Nginx Configuration

Create `apps/web/nginx.conf`:

```nginx
server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    # Security headers
    include /etc/nginx/security.conf;

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript;
    gzip_min_length 1000;

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # SPA routing - all routes go to index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Health check endpoint
    location /health {
        access_log off;
        return 200 "OK\n";
        add_header Content-Type text/plain;
    }

    # API proxy (for development)
    location /api/ {
        proxy_pass http://api:3000/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Create `apps/web/nginx-security.conf`:

```nginx
# Security headers
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' http://localhost:3000;" always;
add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

# Remove server version info
server_tokens off;

# Limit request size
client_max_body_size 1m;

# Rate limiting zone (defined in http context)
# limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
```

### 5. Create Docker Compose for Development

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  # PostgreSQL Database
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: mcp_catalog
      POSTGRES_PASSWORD: mcp_catalog
      POSTGRES_DB: mcp_catalog
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./scripts/init-db.sql:/docker-entrypoint-initdb.d/init.sql
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U mcp_catalog"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Redis (for caching and sessions)
  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  # API Server
  api:
    build:
      context: .
      dockerfile: apps/api/Dockerfile
      target: production
    environment:
      NODE_ENV: development
      PORT: 3000
      DATABASE_URL: postgresql://mcp_catalog:mcp_catalog@postgres:5432/mcp_catalog
      REDIS_URL: redis://redis:6379
      JWT_SECRET: development-secret-change-in-production
      CORS_ORIGIN: http://localhost:5173
      HEALTH_CHECK_INTERVAL: 60000
    volumes:
      - ./apps/api:/app/apps/api
      - ./packages/shared:/app/packages/shared
      - /app/apps/api/node_modules
      - /app/packages/shared/node_modules
    ports:
      - "3000:3000"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    command: pnpm -F api dev

  # Web UI
  web:
    build:
      context: .
      dockerfile: apps/web/Dockerfile
      target: production
    environment:
      VITE_API_URL: http://localhost:3000/api
    volumes:
      - ./apps/web:/app/apps/web
      - /app/apps/web/node_modules
    ports:
      - "5173:5173"
    depends_on:
      - api
    command: pnpm -F web dev

  # MCP Server
  mcp-server:
    build:
      context: .
      dockerfile: apps/mcp-server/Dockerfile
      target: production
    environment:
      CATALOG_API_URL: http://api:3000
    depends_on:
      - api

volumes:
  postgres_data:
  redis_data:

networks:
  default:
    name: mcp-catalog-network
```

### 6. Create Production Docker Compose

Create `docker-compose.prod.yml`:

```yaml
version: '3.8'

services:
  # PostgreSQL Database (Production)
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: mcp_catalog
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - backend
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER}"]
      interval: 10s
      timeout: 5s
      retries: 5
    deploy:
      resources:
        limits:
          memory: 1G

  # Redis (Production)
  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    networks:
      - backend
    healthcheck:
      test: ["CMD", "redis-cli", "-a", "${REDIS_PASSWORD}", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  # API Server (Production)
  api:
    image: ${DOCKER_REGISTRY}/mcp-catalog-api:${VERSION:-latest}
    environment:
      NODE_ENV: production
      PORT: 3000
      DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/mcp_catalog
      REDIS_URL: redis://:${REDIS_PASSWORD}@redis:6379
      JWT_SECRET: ${JWT_SECRET}
      CORS_ORIGIN: ${CORS_ORIGIN}
      HEALTH_CHECK_INTERVAL: 60000
    networks:
      - frontend
      - backend
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    deploy:
      replicas: 2
      resources:
        limits:
          memory: 512M
        reservations:
          memory: 256M
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3000/health"]
      interval: 30s
      timeout: 3s
      retries: 3
      start_period: 40s

  # Web UI (Production)
  web:
    image: ${DOCKER_REGISTRY}/mcp-catalog-web:${VERSION:-latest}
    ports:
      - "80:80"
    networks:
      - frontend
    depends_on:
      - api
    deploy:
      replicas: 2
      resources:
        limits:
          memory: 128M

  # Nginx Reverse Proxy
  nginx:
    image: nginx:alpine
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
    ports:
      - "443:443"
    networks:
      - frontend
    depends_on:
      - web
    deploy:
      resources:
        limits:
          memory: 64M

networks:
  frontend:
    driver: bridge
  backend:
    driver: bridge
    internal: true

volumes:
  postgres_data:
  redis_data:
```

### 7. Create .dockerignore

Create `.dockerignore`:

```
# Dependencies
node_modules
**/node_modules

# Build outputs (will be created in container)
**/dist
**/.next

# Development files
.env
.env.*
!.env.example
*.log
*.local

# IDE and editor files
.vscode
.idea
*.swp
*.swo

# OS files
.DS_Store
Thumbs.db

# Git
.git
.gitignore

# Docker
Dockerfile
docker-compose*.yml
.dockerignore

# Documentation
*.md
docs
skills

# Tests
coverage
**/*.test.ts
**/*.test.tsx
test

# Misc
*.tgz
.npm
.eslintcache
```

### 8. Create Docker Build Script

Create `scripts/build-docker.sh`:

```bash
#!/bin/bash

set -e

VERSION=${1:-latest}
DOCKER_REGISTRY=${2:-localhost}

echo "🐳 Building Docker images (version: $VERSION)"

# Build API
echo "Building API image..."
docker build -t $DOCKER_REGISTRY/mcp-catalog-api:$VERSION -f apps/api/Dockerfile .

# Build Web
echo "Building Web image..."
docker build -t $DOCKER_REGISTRY/mcp-catalog-web:$VERSION -f apps/web/Dockerfile .

# Build MCP Server
echo "Building MCP Server image..."
docker build -t $DOCKER_REGISTRY/mcp-catalog-server:$VERSION -f apps/mcp-server/Dockerfile .

echo "✅ All images built successfully!"
echo ""
echo "Images:"
docker images | grep mcp-catalog
```

## Output

After completing this skill, you should have:

- Multi-stage Dockerfiles for all applications
- Docker Compose for local development
- Production Docker Compose configuration
- Nginx configuration for web serving
- Build scripts for Docker images
- Proper security configurations

## Verification

```bash
# Build all Docker images
./scripts/build-docker.sh

# Start development environment
docker-compose up -d

# Check running containers
docker-compose ps

# View logs
docker-compose logs -f api

# Run tests in container
docker-compose run --rm api pnpm test

# Stop all containers
docker-compose down
```

## Best Practices

1. **Use multi-stage builds** - Minimize image size
2. **Use specific base image versions** - Avoid surprises
3. **Run as non-root user** - Security best practice
4. **Add health checks** - Monitor container health
5. **Use .dockerignore** - Reduce image size
6. **Don't store secrets in images** - Use environment variables
7. **Use slim base images** - Alpine for smaller size
8. **Cache dependencies** - Speed up builds
9. **Label your images** - Add metadata
10. **Scan for vulnerabilities** - Regular security checks

## Image Optimization Tips

```dockerfile
# Order matters - copy package files first for better caching
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --prod

# Then copy source code
COPY . .

# Use .dockerignore to exclude unnecessary files
# Combine RUN commands to reduce layers
RUN apt-get update && apt-get install -y \
    package1 \
    package2 \
    && rm -rf /var/lib/apt/lists/*
```

## Next Steps

After Docker containerization:

1. Set up container registry (Docker Hub, ECR, GCR)
2. Implement CI/CD for automated builds
3. Set up Kubernetes for orchestration
4. Add container monitoring (Prometheus, Grafana)
5. Implement log aggregation (ELK stack)
