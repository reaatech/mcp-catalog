# @reaatech/mcp-catalog-shared

Shared TypeScript type definitions and Zod validation schemas used across the MCP Catalog monorepo.

This package provides the canonical interfaces for MCP Catalog domain entities (`Server`, `Capability`, `Tool`, `Resource`, `User`, `ApiKey`, `AccessPolicy`, `HealthCheck`, `AuditLog`) along with Zod schemas that validate the corresponding create/update/search operations. It is a **types-only module** (no runtime logic, no Fastify plugin, no CLI) that depends solely on `zod` for schema-based validation and type inference. Use it anywhere in the monorepo that needs to consume or produce MCP Catalog domain objects in a type-safe manner.
