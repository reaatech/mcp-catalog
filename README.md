# MCP Catalog

A registry server for MCP (Model Context Protocol) server discovery within an organization.

## Features

- **Discovery**: Find MCP servers by capability
- **Registration**: MCP servers self-register or are registered via CI/CD
- **Health Monitoring**: Automatic health checks on registered servers
- **Schema Aggregation**: Centralized view of all available tools and capabilities
- **Access Control**: Fine-grained permissions for who can discover what
- **Meta-Discovery**: The catalog itself is exposed as an MCP server

## Tech Stack

- **Runtime**: Node.js 20+
- **Package Manager**: pnpm 9+
- **Language**: TypeScript 5.x
- **API Framework**: Fastify 4.x with Zod validation
- **Database**: PostgreSQL 15+
- **ORM**: Drizzle ORM
- **UI**: React 18 + Vite + Tailwind CSS
- **Testing**: Vitest

## Project Structure

```
mcp-catalog/
├── apps/
│   ├── api/           # Main registry API server
│   ├── web/           # Web UI for browsing/searching
│   └── mcp-server/    # MCP server exposing catalog as tools
├── packages/
│   └── shared/        # Shared types, schemas, and utilities
├── skills/            # Agent skills for development workflows
├── docker-compose.yml # Local PostgreSQL
└── package.json       # pnpm workspace root
```

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 9+
- PostgreSQL 15+ (or use Docker)

### Development Setup

```bash
# Install dependencies
pnpm install

# Copy environment variables
cp .env.example .env
# Edit .env with your configuration

# Start PostgreSQL (using Docker)
docker-compose up -d postgres

# Run database migrations
pnpm db:migrate

# Seed development data
pnpm db:seed

# Start development servers
pnpm dev
```

### Available Scripts

```bash
# Root level
pnpm dev              # Start all services in development mode
pnpm build            # Build all services
pnpm test             # Run all tests
pnpm lint             # Run linters
pnpm format           # Format code with Prettier

# API
pnpm -F api dev       # Start API in development mode
pnpm -F api test      # Run API tests
pnpm -F api db:migrate # Run database migrations

# Web
pnpm -F web dev       # Start web UI in development mode

# MCP Server
pnpm -F mcp-server dev # Start MCP server
```

## API Documentation

Once the API is running, access the interactive documentation at:
http://localhost:3000/documentation

## Security Notes

- **`JWT_SECRET` is required and must be at least 32 characters.** The API refuses
  to start without it. Generate one with:
  `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- **`docker-compose.yml` ships with a hard-coded local Postgres password
  (`mcp_catalog`) intended only for development on a developer machine.** For any
  shared or production deployment, override `POSTGRES_PASSWORD` and the
  `DATABASE_URL` via `.env`, a secret manager, or a separate compose override —
  and never expose port `5432` outside the internal network.
- Passwords are hashed with bcrypt; API keys are issued with a random 32-byte
  body and a non-secret prefix so lookup stays O(1).
- In `NODE_ENV=production` the health checker refuses to probe loopback,
  private, link-local, or multicast addresses to mitigate SSRF from a malicious
  server registration.

## Development Phases

See [DEV_PLAN.md](DEV_PLAN.md) for the full development roadmap.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) and [AGENTS.md](AGENTS.md) for development guidelines.

## License

MIT
