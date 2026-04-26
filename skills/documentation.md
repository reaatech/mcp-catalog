# Skill: Documentation

## Purpose

Generate comprehensive documentation for APIs, components, and features in the mcp-catalog project. This skill covers API documentation, code documentation, and user guides.

## Prerequisites

- Feature or component ready for documentation
- Basic understanding of documentation best practices
- Familiarity with documentation tools

## Tools Required

- Fastify Swagger (for API docs)
- TSDoc (for code comments)
- Markdown
- Docusaurus (optional, for docs site)

## Steps

### 1. API Documentation with Swagger

Update Fastify configuration to enable Swagger:

```typescript
import swagger from '@fastify/swagger';
import swaggerUI from '@fastify/swagger-ui';

await fastify.register(swagger, {
  openapi: {
    info: {
      title: 'MCP Catalog API',
      description: 'Registry server for MCP server discovery',
      version: '1.0.0',
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server',
      },
      {
        url: 'https://api.mcp-catalog.com',
        description: 'Production server',
      },
    ],
    tags: [
      { name: 'servers', description: 'Server management endpoints' },
      { name: 'capabilities', description: 'Capability discovery endpoints' },
      { name: 'search', description: 'Search endpoints' },
      { name: 'health', description: 'Health monitoring endpoints' },
      { name: 'auth', description: 'Authentication endpoints' },
    ],
  },
});

await fastify.register(swaggerUI, {
  routePrefix: '/documentation',
  uiConfig: {
    docExpansion: 'list',
    deepLinking: false,
  },
});
```

### 2. Document API Routes

Add comprehensive schema documentation:

```typescript
fastify.post('/api/v1/servers', {
  schema: {
    description: 'Register a new MCP server in the catalog',
    tags: ['servers'],
    body: {
      type: 'object',
      required: ['name', 'url'],
      properties: {
        name: {
          type: 'string',
          minLength: 1,
          maxLength: 255,
          description: 'Unique name for the MCP server',
          example: 'Salesforce Data Connector',
        },
        url: {
          type: 'string',
          format: 'uri',
          description: 'Base URL of the MCP server',
          example: 'https://mcp-salesforce.example.com',
        },
        description: {
          type: 'string',
          maxLength: 1000,
          description: 'Detailed description of the server capabilities',
          example: 'Provides access to Salesforce data and operations',
        },
        healthEndpoint: {
          type: 'string',
          format: 'uri',
          description: 'Optional health check endpoint URL',
          example: 'https://mcp-salesforce.example.com/health',
        },
        metadata: {
          type: 'object',
          description: 'Additional metadata about the server',
          properties: {
            version: { type: 'string', description: 'Server version' },
            owner: { type: 'string', description: 'Team or individual responsible' },
          },
        },
      },
    },
    response: {
      201: {
        description: 'Server successfully registered',
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          url: { type: 'string' },
          status: { type: 'string', enum: ['healthy', 'unhealthy', 'unknown'] },
          registeredAt: { type: 'string', format: 'date-time' },
        },
      },
      400: {
        description: 'Invalid input data',
        type: 'object',
        properties: {
          error: { type: 'string' },
          details: { type: 'array', items: { type: 'object' } },
        },
      },
      409: {
        description: 'Server name already exists',
        type: 'object',
        properties: {
          error: { type: 'string' },
        },
      },
    },
    security: [{ bearerAuth: [] }, { apiKey: [] }],
  },
}, async (request, reply) => {
  // Implementation
});
```

### 3. Code Documentation with TSDoc

Document TypeScript code:

```typescript
/**
 * Service for managing MCP server registry operations.
 * 
 * @remarks
 * This service handles all CRUD operations for MCP servers,
 * including registration, updates, and health monitoring.
 * 
 * @example
 * ```typescript
 * const registry = new RegistryService();
 * const server = await registry.createServer({
 *   name: 'My Server',
 *   url: 'https://example.com',
 * });
 * ```
 */
export class RegistryService {
  /**
   * Creates a new MCP server entry in the registry.
   * 
   * @param data - The server registration data
   * @param data.name - Unique name for the server
   * @param data.url - Base URL of the MCP server
   * @param data.description - Optional description
   * @param data.healthEndpoint - Optional health check endpoint
   * 
   * @returns The created server object with generated ID
   * 
   * @throws Error if server name already exists
   * @throws Error if URL is invalid
   * 
   * @example
   * ```typescript
   * const server = await createServer({
   *   name: 'Database Connector',
   *   url: 'https://db-mcp.example.com',
   *   description: 'Provides database query capabilities',
   * });
   * ```
   */
  async createServer(data: CreateServerInput): Promise<Server> {
    // Implementation
  }

  /**
   * Retrieves a server by its unique identifier.
   * 
   * @param serverId - The UUID of the server to retrieve
   * @param options - Optional query options
   * @param options.include - Related data to include (capabilities, tools, etc.)
   * 
   * @returns The server object if found, null otherwise
   * 
   * @example
   * ```typescript
   * const server = await getServer('uuid', { include: 'capabilities' });
   * if (server) {
   *   console.log(`Found server: ${server.name}`);
   * }
   * ```
   */
  async getServer(serverId: string, options?: GetServerOptions): Promise<Server | null> {
    // Implementation
  }
}
```

### 4. Component Documentation

Document React components:

```typescript
/**
 * ServerCard Component
 * 
 * Displays a card with MCP server information including name, status,
 * capabilities, and health metrics.
 * 
 * @param props - Component props
 * @param props.id - Unique server identifier
 * @param props.name - Server display name
 * @param props.description - Optional server description
 * @param props.url - Server base URL
 * @param props.status - Current health status
 * @param props.capabilities - List of server capabilities
 * 
 * @example
 * ```tsx
 * <ServerCard
 *   id="123e4567-e89b-12d3-a456-426614174000"
 *   name="Salesforce Connector"
 *   description="Provides Salesforce data access"
 *   url="https://mcp-salesforce.example.com"
 *   status="healthy"
 *   capabilities={[
 *     { name: 'Query Accounts', category: 'crm' },
 *     { name: 'Update Contacts', category: 'crm' },
 *   ]}
 * />
 * ```
 */
export const ServerCard: React.FC<ServerCardProps> = ({
  id,
  name,
  description,
  // ... rest of props
}) => {
  // Implementation
};
```

### 5. Create README Files

Create `apps/api/README.md`:

```markdown
# MCP Catalog API

REST API server for the MCP Catalog registry system.

## Quick Start

```bash
# Install dependencies
pnpm install

# Set up environment
cp .env.example .env
# Edit .env with your configuration

# Run database migrations
pnpm db:migrate

# Start development server
pnpm dev

# Start production server
pnpm build
pnpm start
```

## API Documentation

Once running, access the interactive API documentation at:
- Swagger UI: http://localhost:3000/documentation
- OpenAPI JSON: http://localhost:3000/documentation/json

## Available Endpoints

### Servers
- `GET /api/v1/servers` - List all servers
- `POST /api/v1/servers` - Register a new server
- `GET /api/v1/servers/:id` - Get server details
- `PUT /api/v1/servers/:id` - Update server
- `DELETE /api/v1/servers/:id` - Unregister server

### Search
- `GET /api/v1/search?q=query` - Search servers and capabilities
- `GET /api/v1/capabilities` - List all capabilities

### Health
- `GET /health` - Basic health check
- `GET /api/v1/health/summary` - Health summary for all servers
- `GET /api/v1/health/history/:serverId` - Health check history

## Authentication

The API supports two authentication methods:

1. **JWT Tokens** - For user sessions
2. **API Keys** - For programmatic access

Include authentication in requests:

```bash
# JWT Token
curl -H "Authorization: Bearer <token>" http://localhost:3000/api/v1/servers

# API Key
curl -H "X-API-Key: <key>" http://localhost:3000/api/v1/servers
```

## Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| PORT | Server port | 3000 |
| DATABASE_URL | PostgreSQL connection string | - |
| JWT_SECRET | Secret for JWT signing | - |
| HEALTH_CHECK_INTERVAL | Health check interval (ms) | 60000 |

## Testing

```bash
# Run all tests
pnpm test

# Run with coverage
pnpm test:coverage

# Run specific test file
pnpm test servers.test.ts
```

## Development

```bash
# Watch mode
pnpm dev

# Type checking
pnpm typecheck

# Linting
pnpm lint

# Format code
pnpm format
```
```

### 6. Create User Guide

Create `docs/USER_GUIDE.md`:

```markdown
# MCP Catalog User Guide

## Introduction

MCP Catalog is a registry system for discovering and managing MCP (Model Context Protocol) servers within your organization.

## Getting Started

### 1. Browse Servers

Visit the web UI at http://localhost:5173 to browse registered MCP servers.

### 2. Search for Capabilities

Use the search bar to find servers by capability:
- "database query" - Find database tools
- "salesforce" - Find CRM integrations
- "file system" - Find file management tools

### 3. Register a Server

#### Via Web UI
1. Log in to the admin dashboard
2. Click "Register Server"
3. Fill in server details
4. Submit for approval

#### Via API
```bash
curl -X POST http://localhost:3000/api/v1/servers \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My MCP Server",
    "url": "https://my-server.example.com",
    "description": "Provides X, Y, Z capabilities"
  }'
```

## Using MCP Servers

### Discover Tools

Use the MCP catalog's own MCP server to discover tools:

```typescript
// In your MCP client
const tools = await mcpClient.callTool('catalog_search', {
  q: 'database',
  category: 'database'
});
```

### Check Server Health

Monitor server availability:

```bash
curl http://localhost:3000/api/v1/health/servers/<server-id>
```

## Best Practices

1. **Use descriptive names** - Make servers easy to find
2. **Add comprehensive descriptions** - Explain what each server does
3. **Tag appropriately** - Use relevant tags for better discovery
4. **Monitor health** - Set up health check endpoints
5. **Update regularly** - Keep server information current

## Troubleshooting

### Server Not Found in Search
- Check if server is registered
- Verify search terms match server name/description
- Ensure server status is "healthy"

### Health Check Failing
- Verify health endpoint is accessible
- Check server logs for errors
- Confirm network connectivity

## Support

For help and questions:
- GitHub Issues: https://github.com/reaatech/mcp-catalog/issues
- Documentation: https://docs.mcp-catalog.com
```

## Output

After completing this skill, you should have:

- Interactive API documentation (Swagger UI)
- Code documentation (TSDoc comments)
- README files for each package
- User guide
- Contributing guidelines
- Architecture documentation

## Verification

```bash
# Check API documentation
open http://localhost:3000/documentation

# Verify TSDoc comments
pnpm exec typedoc --options typedoc.json

# Check README files
cat apps/api/README.md
cat apps/web/README.md
```

## Best Practices

1. **Document as you code** - Don't leave it for later
2. **Keep docs updated** - Sync with code changes
3. **Use examples** - Show how to use features
4. **Write for your audience** - Different docs for different users
5. **Include troubleshooting** - Help users solve common issues
6. **Use consistent formatting** - Follow style guides
7. **Add diagrams** - Visual aids for complex concepts
8. **Link related docs** - Create documentation networks
9. **Review regularly** - Keep content accurate
10. **Gather feedback** - Improve based on user input

## Documentation Structure

```
docs/
├── API_REFERENCE.md      # Complete API documentation
├── USER_GUIDE.md         # End-user documentation
├── ARCHITECTURE.md       # System architecture
├── DEPLOYMENT.md         # Deployment instructions
├── CONTRIBUTING.md       # Contribution guidelines
└── TROUBLESHOOTING.md    # Common issues and solutions
```

## Next Steps

After documentation:

1. Set up automated documentation generation
2. Create video tutorials
3. Add interactive examples
4. Set up documentation site (Docusaurus)
5. Implement documentation testing
