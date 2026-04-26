# Skill: Project Setup

## Purpose

Initialize a new mcp-catalog project from scratch with all necessary configuration, dependencies, and project structure.

## Prerequisites

- Node.js 20+ installed
- pnpm 8+ installed
- Git installed
- Basic understanding of TypeScript and monorepo structures

## Tools Required

- pnpm (package manager)
- git (version control)
- Node.js (runtime)

## Steps

### 1. Initialize Root Project

```bash
# Create project directory
mkdir mcp-catalog
cd mcp-catalog

# Initialize git repository
git init

# Initialize pnpm workspace
pnpm init
```

### 2. Create Workspace Configuration

Create `pnpm-workspace.yaml`:

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

### 3. Set Up Root Package.json

Update root `package.json` with workspace configuration and scripts:

```json
{
  "name": "mcp-catalog",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "pnpm -r --parallel dev",
    "build": "pnpm -r build",
    "test": "pnpm -r test",
    "lint": "pnpm -r lint",
    "format": "pnpm -r format",
    "typecheck": "pnpm -r typecheck"
  },
  "devDependencies": {
    "@types/node": "^20.11.0",
    "typescript": "^5.3.0",
    "prettier": "^3.2.0",
    "eslint": "^8.56.0",
    "@typescript-eslint/eslint-plugin": "^7.0.0",
    "@typescript-eslint/parser": "^7.0.0"
  },
  "engines": {
    "node": ">=20.0.0"
  }
}
```

### 4. Create Shared Package

```bash
mkdir -p packages/shared/src
cd packages/shared
pnpm init
```

Add TypeScript configuration and basic structure.

### 5. Create API App

```bash
mkdir -p apps/api/src
cd apps/api
pnpm init
```

Install dependencies:
```bash
pnpm add fastify @fastify/cors @fastify/helmet @fastify/rate-limit
pnpm add fastify-type-provider-zod
pnpm add drizzle-orm postgres
pnpm add zod
pnpm add pino
pnpm add bcryptjs
pnpm add -D @types/node typescript vitest @vitest/coverage-v8 tsx drizzle-kit @types/bcryptjs
```

### 6. Create Web App

```bash
mkdir -p apps/web/src
cd apps/web
pnpm init
```

Install dependencies:
```bash
pnpm add react react-dom react-router-dom
pnpm add @vitejs/plugin-react
pnpm add tailwindcss postcss autoprefixer
pnpm add -D vite typescript @types/react @types/react-dom vitest @testing-library/react
```

### 7. Create MCP Server App

```bash
mkdir -p apps/mcp-server/src
cd apps/mcp-server
pnpm init
```

Install dependencies:
```bash
pnpm add @modelcontextprotocol/sdk
pnpm add -D @types/node typescript
```

### 8. Configure TypeScript

Create root `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  },
  "exclude": ["node_modules", "dist"]
}
```

### 9. Configure ESLint and Prettier

Create `.eslintrc.js` and `.prettierrc` at root.

### 10. Initialize Git

```bash
# Create .env.example
cat > .env.example << 'EOF'
# Server
PORT=3000
HOST=0.0.0.0
NODE_ENV=development

# Database
DATABASE_URL=postgresql://mcp_catalog:mcp_catalog@localhost:5432/mcp_catalog

# JWT
JWT_SECRET=change-me-in-production
JWT_EXPIRES_IN=24h

# API Keys
API_KEY_HASH_ROUNDS=12

# Health Monitoring
HEALTH_CHECK_INTERVAL=60
HEALTH_CHECK_TIMEOUT=10
HEALTH_CHECK_RETRIES=3

# CORS
CORS_ORIGIN=http://localhost:5173

# Rate Limiting
RATE_LIMIT_WINDOW=15m
RATE_LIMIT_MAX=100

# Logging
LOG_LEVEL=info

# MCP Server
CATALOG_API_URL=http://localhost:3000
EOF

# Create .gitignore
cat > .gitignore << 'EOF'
node_modules
dist
.env
.env.*
!.env.example
*.log
coverage
.vscode
.idea
EOF

# Initial commit
git add .
git commit -m "feat: initialize mcp-catalog project structure"
```

## Output

After completing this skill, you should have:

- A fully configured pnpm workspace
- Three apps: api, web, mcp-server
- One shared package
- TypeScript configured across all packages
- Basic development scripts
- Git repository initialized

## Verification

Run these commands to verify the setup:

```bash
# Install all dependencies
pnpm install

# Type check all packages
pnpm typecheck

# Run tests (will be empty initially)
pnpm test

# Check formatting
pnpm format
```

## Example Interaction

**User**: "Set up a new mcp-catalog project"

**Agent**: 
1. Executes the project setup skill
2. Creates all necessary directories and files
3. Installs dependencies
4. Configures TypeScript, ESLint, Prettier
5. Initializes git repository
6. Reports completion with file list

**Expected Output**:
```
✅ Project structure created
✅ Dependencies installed
✅ TypeScript configured
✅ ESLint and Prettier configured
✅ Git repository initialized

Files created:
- pnpm-workspace.yaml
- package.json
- tsconfig.json
- apps/api/package.json
- apps/web/package.json
- apps/mcp-server/package.json
- packages/shared/package.json
- .eslintrc.js
- .prettierrc
- .gitignore
```

## Next Steps

After project setup, you can:

1. Set up the database schema using the `database-migration` skill
2. Create API endpoints using the `api-endpoint` skill
3. Build React components using the `react-component` skill
4. Add MCP tools using the `mcp-tool` skill
