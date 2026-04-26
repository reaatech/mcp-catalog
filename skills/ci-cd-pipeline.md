# Skill: CI/CD Pipeline

## Purpose

Set up CI/CD workflows for automated testing and deployment of the mcp-catalog project. This skill covers GitHub Actions workflows, automated testing, building, and deployment.

## Prerequisites

- GitHub repository set up
- Basic understanding of CI/CD concepts
- Familiarity with GitHub Actions
- Project code ready for deployment

## Tools Required

- GitHub Actions
- Docker (for container builds)
- pnpm (package manager)
- Testing frameworks (Vitest)

## Steps

### 1. Create GitHub Actions Workflow

Create `.github/workflows/ci.yml`:

```yaml
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  # Lint and Type Check
  lint-and-typecheck:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v3
        with:
          version: 9
          run_install: false

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Run ESLint
        run: pnpm lint

      - name: Run Prettier check
        run: pnpm format --check

      - name: Run TypeScript type check
        run: pnpm typecheck

  # Run Tests
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: mcp_catalog_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v3
        with:
          version: 9
          run_install: false

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Run database migrations
        run: pnpm -F api db:migrate
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/mcp_catalog_test

      - name: Run tests with coverage
        run: pnpm test:coverage
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/mcp_catalog_test

      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v4
        with:
          files: ./coverage/lcov.info
          flags: unittests
          name: codecov-umbrella
          fail_ci_if_error: false

  # Build Applications
  build:
    needs: [lint-and-typecheck, test]
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v3
        with:
          version: 9
          run_install: false

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build all applications
        run: pnpm build

      - name: Upload build artifacts
        uses: actions/upload-artifact@v4
        with:
          name: build-artifacts
          path: |
            apps/api/dist
            apps/web/dist
            apps/mcp-server/dist

  # Security Scan
  security:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v3
        with:
          version: 9
          run_install: false

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Run security audit
        run: pnpm audit --audit-level moderate

      - name: Run Snyk security scan
        uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
        continue-on-error: true

  # Build and Push Docker Image (on main branch only)
  docker:
    needs: [build]
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Login to Docker Hub
        uses: docker/login-action@v3
        with:
          username: ${{ secrets.DOCKER_USERNAME }}
          password: ${{ secrets.DOCKER_PASSWORD }}

      - name: Build and push API image
        uses: docker/build-push-action@v5
        with:
          context: .
          file: ./apps/api/Dockerfile
          push: true
          tags: |
            ${{ secrets.DOCKER_USERNAME }}/mcp-catalog-api:latest
            ${{ secrets.DOCKER_USERNAME }}/mcp-catalog-api:${{ github.sha }}
          cache-from: type=registry,ref=${{ secrets.DOCKER_USERNAME }}/mcp-catalog-api:buildcache
          cache-to: type=registry,ref=${{ secrets.DOCKER_USERNAME }}/mcp-catalog-api:buildcache,mode=max

      - name: Build and push Web image
        uses: docker/build-push-action@v5
        with:
          context: .
          file: ./apps/web/Dockerfile
          push: true
          tags: |
            ${{ secrets.DOCKER_USERNAME }}/mcp-catalog-web:latest
            ${{ secrets.DOCKER_USERNAME }}/mcp-catalog-web:${{ github.sha }}
          cache-from: type=registry,ref=${{ secrets.DOCKER_USERNAME }}/mcp-catalog-web:buildcache
          cache-to: type=registry,ref=${{ secrets.DOCKER_USERNAME }}/mcp-catalog-web:buildcache,mode=max

      - name: Build and push MCP Server image
        uses: docker/build-push-action@v5
        with:
          context: .
          file: ./apps/mcp-server/Dockerfile
          push: true
          tags: |
            ${{ secrets.DOCKER_USERNAME }}/mcp-catalog-server:latest
            ${{ secrets.DOCKER_USERNAME }}/mcp-catalog-server:${{ github.sha }}
          cache-from: type=registry,ref=${{ secrets.DOCKER_USERNAME }}/mcp-catalog-server:buildcache
          cache-to: type=registry,ref=${{ secrets.DOCKER_USERNAME }}/mcp-catalog-server:buildcache,mode=max

  # Deploy to Staging (on main branch only)
  deploy-staging:
    needs: [docker]
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    environment:
      name: staging
      url: https://staging.mcp-catalog.com
    steps:
      - name: Deploy to staging
        run: |
          echo "Deploying to staging environment..."
          # Add your deployment commands here
          # Example: kubectl apply -f k8s/staging/
          # Example: docker-compose -f docker-compose.staging.yml up -d
```

### 2. Create Dockerfiles

Create `apps/api/Dockerfile`:

```dockerfile
# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@8 --activate

# Copy package files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/

# Install dependencies
RUN pnpm install --frozen-lockfile --filter api...

# Copy source code
COPY apps/api ./apps/api
COPY packages/shared ./packages/shared

# Build application
RUN pnpm -F api build

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@8 --activate

# Copy package files for production dependencies only
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod --filter api...

# Copy built application
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

USER nodejs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node apps/api/dist/healthcheck.js || exit 1

# Start application
CMD ["node", "apps/api/dist/index.js"]
```

Create `apps/web/Dockerfile`:

```dockerfile
# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@8 --activate

# Copy package files
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

# Copy custom nginx config
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf

# Copy built application
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html

# Expose port
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
```

### 3. Create Release Workflow

Create `.github/workflows/release.yml`:

```yaml
name: Release

on:
  workflow_dispatch:
    inputs:
      version:
        description: 'Version to release (e.g., 1.0.0)'
        required: true
        type: string

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v3
        with:
          version: 9

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          registry-url: 'https://registry.npmjs.org'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Run tests
        run: pnpm test

      - name: Build applications
        run: pnpm build

      - name: Create GitHub Release
        uses: softprops/action-gh-release@v1
        with:
          tag_name: v${{ github.event.inputs.version }}
          name: Release v${{ github.event.inputs.version }}
          generate_release_notes: true
          draft: false
          prerelease: false
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Deploy to production
        run: |
          echo "Deploying version ${{ github.event.inputs.version }} to production..."
          # Add your production deployment commands here
```

### 4. Create Deployment Scripts

Create `scripts/deploy.sh`:

```bash
#!/bin/bash

set -e

ENVIRONMENT=${1:-staging}
VERSION=${2:-latest}

echo "🚀 Deploying to $ENVIRONMENT environment (version: $VERSION)"

if [ "$ENVIRONMENT" = "production" ]; then
    echo "⚠️  Deploying to PRODUCTION"
    read -p "Are you sure? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ Deployment cancelled"
        exit 1
    fi
fi

# Pull latest images
docker-compose -f docker-compose.$ENVIRONMENT.yml pull

# Run database migrations
docker-compose -f docker-compose.$ENVIRONMENT.yml run --rm api pnpm db:migrate

# Start services
docker-compose -f docker-compose.$ENVIRONMENT.yml up -d

# Wait for services to be healthy
echo "⏳ Waiting for services to be healthy..."
sleep 30

# Health check
curl -f http://localhost:3000/health || exit 1

echo "✅ Deployment to $ENVIRONMENT completed successfully!"
```

## Output

After completing this skill, you should have:

- Automated CI/CD pipeline
- GitHub Actions workflows
- Docker build configurations
- Automated testing on every PR
- Automated deployment on merge to main
- Security scanning integration

## Verification

```bash
# Test CI pipeline locally
act -j test

# Build Docker images
docker-compose build

# Run deployment script
./scripts/deploy.sh staging
```

## Best Practices

1. **Run tests on every PR** - Catch issues early
2. **Use matrix builds** - Test on multiple Node versions
3. **Cache dependencies** - Speed up builds
4. **Use secrets management** - Never hardcode credentials
5. **Implement blue-green deployment** - Minimize downtime
6. **Add rollback capability** - Quick recovery from failures
7. **Monitor deployments** - Track success/failure rates
8. **Use environment protection** - Require approval for production
9. **Keep workflows DRY** - Reuse workflow components
10. **Document deployment process** - Make it repeatable

## Environment Variables (GitHub Secrets)

Required secrets:
- `DOCKER_USERNAME` - Docker Hub username
- `DOCKER_PASSWORD` - Docker Hub password/token
- `SNYK_TOKEN` - Snyk API token
- `DATABASE_URL` - Production database URL
- `JWT_SECRET` - JWT signing secret

## Next Steps

After CI/CD setup:

1. Add automated performance testing
2. Implement canary deployments
3. Set up monitoring and alerting
4. Add automated rollback on failures
5. Create deployment dashboard
