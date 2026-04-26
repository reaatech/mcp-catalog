# Changelog

## [1.0.0] — 2026-04-26

### Added
- Fastify API server with Zod validation, JWT + API key authentication, and Swagger documentation
- PostgreSQL database with Drizzle ORM and migration support
- React web UI with Tailwind CSS, React Router, and Vite build system
- MCP server exposing catalog search, server details, capabilities, health checks, and tool lookup
- Shared Zod schemas and TypeScript types package
- Health check service with DNS rebinding/SSRF protection, retry with exponential backoff, and periodic scheduler
- Refresh token rotation with family-based reuse detection
- API key prefix indexing for O(1) candidate lookup
- RBAC + ABAC access control with access policies
- Audit logging for all state-changing operations
- Docker configurations for all services (API, Web, MCP Server, PostgreSQL)
- GitHub Actions CI pipeline with lint, test, build, and docker build jobs
- 12 agent skill documents for AI-assisted development
- Comprehensive documentation: README, DEV_PLAN, CONTRIBUTING, AGENTS guide

### Security
- Helmet security headers with CSP in production
- CORS with explicit origin configuration
- Global rate limiting
- bcrypt password hashing with configurable rounds
- JWT secret length enforcement (min 32 chars)
- SSRF protection in health check DNS resolution
- Non-root Docker users
- Seed disabled in production
