# Skill: API Endpoint

## Purpose

Create a new REST API endpoint with proper validation, documentation, and testing for the mcp-catalog API server.

## Prerequisites

- Project setup completed
- Fastify server running
- `fastify-type-provider-zod` installed and configured
- Basic understanding of REST API design
- Familiarity with TypeScript and Zod validation

## Tools Required

- Fastify framework
- Zod for schema validation
- Drizzle ORM (if database interaction needed)
- Vitest for testing

## Steps

### 1. Define the Route Schema

Create a Zod schema for request validation in `apps/api/src/routes/<resource>.ts`:

```typescript
import { z } from 'zod';

// Request parameter schema
export const getServerParamsSchema = z.object({
  id: z.string().uuid('Invalid server ID format')
});

// Query string schema
export const getServerQuerySchema = z.object({
  include: z.enum(['capabilities', 'tools', 'resources']).optional()
});

// Response schema
export const serverResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  url: z.string().url(),
  status: z.enum(['healthy', 'unhealthy', 'unknown']),
  registeredAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  capabilities: z.array(z.object({
    id: z.string().uuid(),
    name: z.string(),
    category: z.string(),
    tags: z.array(z.string())
  })).optional()
});

export type GetServerParams = z.infer<typeof getServerParamsSchema>;
export type GetServerQuery = z.infer<typeof getServerQuerySchema>;
export type ServerResponse = z.infer<typeof serverResponseSchema>;
```

### 2. Create the Route Handler

```typescript
import { FastifyPluginAsync } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { getServerParamsSchema, getServerQuerySchema, serverResponseSchema } from './schemas';

// Use type provider for automatic Zod → JSON Schema conversion
export const serverRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/v1/servers/:id
  fastify.withTypeProvider<ZodTypeProvider>().get<{
    Params: GetServerParams;
    Querystring: GetServerQuery;
    Reply: ServerResponse;
  }>(

export const serverRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/v1/servers/:id
  fastify.get<{
    Params: GetServerParams;
    Querystring: GetServerQuery;
    Reply: ServerResponse;
  }>(
    '/:id',
    {
      schema: {
        description: 'Get detailed information about a specific MCP server',
        tags: ['servers'],
        params: getServerParamsSchema,
        querystring: getServerQuerySchema,
        response: {
          200: serverResponseSchema,
          404: z.object({
            error: z.string(),
            message: z.string()
          })
        }
      },
      onRequest: [] // Add auth decorators when available: [fastify.authenticate]
    },
    async (request, reply) => {
      const { id } = request.params;
      const { include } = request.query;

      // Get server from database
      const server = await fastify.db.query.servers.findFirst({
        where: eq(servers.id, id),
        with: include ? {
          capabilities: include === 'capabilities' || include === 'tools' || include === 'resources'
        } : false
      });

      if (!server) {
        return reply.code(404).send({
          error: 'Server not found',
          message: `No server found with ID: ${id}`
        });
      }

      // Log access for audit
      await fastify.audit.log({
        action: 'server.get',
        resourceType: 'server',
        resourceId: id,
        userId: request.user?.id,
        details: { include }
      });

      return reply.send(server);
    }
  );
};
```

### 3. Register the Route

In `apps/api/src/app.ts` or `apps/api/src/routes/index.ts`:

```typescript
import { serverRoutes } from './routes/servers';

await fastify.register(serverRoutes, { prefix: '/api/v1/servers' });
```

### 4. Add OpenAPI Documentation

Fastify Swagger will auto-generate from the schema, but you can enhance it:

```typescript
// In your route schema
schema: {
  description: 'Get detailed information about a specific MCP server',
  tags: ['servers'],
  // ... rest of schema
}
```

Access documentation at `http://localhost:3000/documentation` when running.

### 5. Write Tests

Create `apps/api/test/routes/servers.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../utils/server';
import { db } from '../../src/db';

describe('GET /api/v1/servers/:id', () => {
  let server;
  let testServerId: string;

  beforeAll(async () => {
    server = await buildServer();
    
    // Create test data
    const [created] = await db.insert(servers).values({
      name: 'Test Server',
      description: 'A test MCP server',
      url: 'http://localhost:4000',
      status: 'healthy'
    }).returning();
    
    testServerId = created.id;
  });

  afterAll(async () => {
    await db.delete(servers).where(eq(servers.id, testServerId));
    await server.close();
  });

  it('should return server details for valid ID', async () => {
    const response = await server.inject({
      method: 'GET',
      url: `/api/v1/servers/${testServerId}`
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.id).toBe(testServerId);
    expect(body.name).toBe('Test Server');
    expect(body.url).toBe('http://localhost:4000');
  });

  it('should return 404 for non-existent server', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const response = await server.inject({
      method: 'GET',
      url: `/api/v1/servers/${fakeId}`
    });

    expect(response.statusCode).toBe(404);
    const body = response.json();
    expect(body.error).toBe('Server not found');
  });

  it('should return 400 for invalid UUID format', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/api/v1/servers/invalid-id'
    });

    expect(response.statusCode).toBe(400);
  });

  it('should include capabilities when requested', async () => {
    const response = await server.inject({
      method: 'GET',
      url: `/api/v1/servers/${testServerId}?include=capabilities`
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.capabilities).toBeDefined();
    expect(Array.isArray(body.capabilities)).toBe(true);
  });
});
```

### 6. Add Rate Limiting (if needed)

```typescript
// In your route options
{
  // ... other options
  config: {
    rateLimit: {
      max: 100,
      timeWindow: '1 minute'
    }
  }
}
```

### 7. Add Authentication (if needed)

```typescript
// In your route options
{
  // ... other options
  onRequest: [fastify.authenticate] // or fastify.requireAuthentication
}
```

## Output

After completing this skill, you should have:

- A fully functional REST API endpoint
- Input validation with Zod schemas
- OpenAPI documentation
- Comprehensive test coverage
- Proper error handling
- Audit logging (if applicable)

## Verification

Test your endpoint:

```bash
# Start the API server
pnpm -F api dev

# Test the endpoint
curl http://localhost:3000/api/v1/servers/<server-id>

# Run tests
pnpm -F api test

# Check API documentation
open http://localhost:3000/documentation
```

## Example Interaction

**User**: "Create an endpoint to get server details by ID"

**Agent**:
1. Creates schema definitions with Zod
2. Implements route handler with proper types
3. Adds validation and error handling
4. Writes comprehensive tests
5. Registers the route
6. Verifies functionality

**Expected Output**:
```
✅ Schema defined with Zod
✅ Route handler implemented
✅ Validation added
✅ Tests written (4 test cases)
✅ Route registered at /api/v1/servers/:id
✅ OpenAPI documentation generated

Test Results:
- ✓ should return server details for valid ID
- ✓ should return 404 for non-existent server  
- ✓ should return 400 for invalid UUID format
- ✓ should include capabilities when requested

Coverage: 95%
```

## Best Practices

1. **Always validate input** - Use Zod schemas for all inputs
2. **Type everything** - Use TypeScript interfaces/types
3. **Document thoroughly** - Add descriptions, examples, and tags
4. **Test comprehensively** - Cover success, error, and edge cases
5. **Log appropriately** - Use structured logging with Pino
6. **Handle errors gracefully** - Return meaningful error messages
7. **Consider security** - Add authentication and rate limiting as needed
8. **Follow REST conventions** - Use proper HTTP methods and status codes

## Common Patterns

### Create (POST)
```typescript
fastify.post<{
  Body: CreateServerBody;
  Reply: ServerResponse;
}>('/', {
  schema: {
    body: createServerBodySchema,
    response: { 201: serverResponseSchema }
  }
}, async (request, reply) => {
  reply.code(201).send(await fastify.registry.createServer(request.body));
});
```

### Update (PUT)
```typescript
fastify.put<{
  Params: GetServerParams;
  Body: UpdateServerBody;
  Reply: ServerResponse;
}>('/:id', {
  schema: {
    params: getServerParamsSchema,
    body: updateServerBodySchema,
    response: { 200: serverResponseSchema }
  }
}, async (request, reply) => {
  reply.send(await fastify.registry.updateServer(request.params.id, request.body));
});
```

### Delete (DELETE)
```typescript
fastify.delete<{
  Params: GetServerParams;
}>('/:id', {
  schema: {
    params: getServerParamsSchema,
    response: { 204: z.undefined() }
  }
}, async (request, reply) => {
  await fastify.registry.deleteServer(request.params.id);
  reply.code(204);
});
```

### List with Pagination (GET)
```typescript
fastify.get<{
  Querystring: ListServersQuery;
  Reply: PaginatedResponse<ServerResponse>;
}>('/', {
  schema: {
    querystring: listServersQuerySchema,
    response: { 200: paginatedResponseSchema(serverResponseSchema) }
  }
}, async (request, reply) => {
  const { limit = 20, offset = 0, ...filters } = request.query;
  const [servers, total] = await Promise.all([
    fastify.registry.listServers({ limit, offset, ...filters }),
    fastify.registry.countServers(filters)
  ]);
  
  reply.send({
    data: servers,
    pagination: {
      limit,
      offset,
      total,
      hasMore: offset + servers.length < total
    }
  });
});
```

## Next Steps

After creating API endpoints, you can:

1. Add database migrations if new tables are needed
2. Create React components to consume the API
3. Add MCP tools that use the API
4. Implement health checks for the endpoint
5. Set up CI/CD pipeline for automated testing
