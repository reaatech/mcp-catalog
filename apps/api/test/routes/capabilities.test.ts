import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';
import { ZodTypeProvider, validatorCompiler, serializerCompiler } from 'fastify-type-provider-zod';
import { capabilityRoutes } from '../../src/routes/capabilities.js';

const mockDbResults: Record<string, any[]> = {};

vi.mock('../../src/db/index.js', () => ({
  db: {
    select: vi.fn((columns?: any) => {
      const isCountQuery = columns && 'count' in columns;
      let currentTable = 'default';
      const chain: any = {
        from: vi.fn((table: any) => {
          const tableName = table?.[Symbol.for('drizzle:Name')] || 'default';
          currentTable = isCountQuery ? `${tableName}_count` : tableName;
          return chain;
        }),
        where: vi.fn(() => chain),
        limit: vi.fn(() => chain),
        offset: vi.fn(() => chain),
        orderBy: vi.fn(() => chain),
        then: (resolve: any) => Promise.resolve(mockDbResults[currentTable] || []).then(resolve),
      };
      return chain;
    }),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn().mockResolvedValue(mockDbResults['insert'] || []),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn().mockResolvedValue(mockDbResults['update'] || []),
        })),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(() => ({
        returning: vi.fn().mockResolvedValue(mockDbResults['delete'] || []),
      })),
    })),
  },
}));

async function buildTestApp() {
  const app = Fastify({ logger: false }).withTypeProvider<ZodTypeProvider>();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.decorate('authenticate', async (request: any) => {
    request.user = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      email: 'test@test.com',
      name: 'Test User',
      role: 'admin',
    };
  });
  await app.register(capabilityRoutes, { prefix: '/api/v1/capabilities' });
  return app;
}

describe('Capability Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(mockDbResults).forEach(k => delete mockDbResults[k]);
  });

  it('should list capabilities', async () => {
    mockDbResults['capabilities'] = [
      {
        id: '550e8400-e29b-41d4-a716-446655440001',
        serverId: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Query Records',
        description: 'Query records',
        category: 'database',
        tags: ['crm'],
        createdAt: new Date('2024-01-15T00:00:00Z'),
      },
    ];
    mockDbResults['capabilities_count'] = [{ count: 1 }];

    const app = await buildTestApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/capabilities',
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.data).toHaveLength(1);
    expect(body.pagination).toBeDefined();
  });

  it('should get capability by id with tools and resources', async () => {
    mockDbResults['capabilities'] = [
      {
        id: '550e8400-e29b-41d4-a716-446655440001',
        serverId: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Query Records',
        description: null,
        category: 'database',
        tags: [],
        schema: null,
        createdAt: new Date('2024-01-15T00:00:00Z'),
      },
    ];
    mockDbResults['tools'] = [
      {
        id: '550e8400-e29b-41d4-a716-446655440002',
        name: 'Find Record',
        description: null,
        inputSchema: { type: 'object' },
      },
    ];
    mockDbResults['resources'] = [
      {
        id: '550e8400-e29b-41d4-a716-446655440003',
        uri: 'http://example.com/resource',
        name: 'Example Resource',
        description: null,
        mimeType: null,
      },
    ];

    const app = await buildTestApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/capabilities/550e8400-e29b-41d4-a716-446655440001',
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.id).toBe('550e8400-e29b-41d4-a716-446655440001');
    expect(body.tools).toHaveLength(1);
    expect(body.resources).toHaveLength(1);
  });

  it('should create a capability', async () => {
    mockDbResults['servers'] = [
      {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Test Server',
        url: 'http://localhost:4000',
        status: 'healthy',
      },
    ];
    mockDbResults['insert'] = [
      {
        id: '550e8400-e29b-41d4-a716-446655440001',
        serverId: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Query Records',
        category: 'database',
        createdAt: new Date('2024-01-15T00:00:00Z'),
      },
    ];

    const app = await buildTestApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/capabilities',
      payload: {
        serverId: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Query Records',
        category: 'database',
      },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.name).toBe('Query Records');
  });

  it('should update a capability', async () => {
    mockDbResults['capabilities'] = [
      {
        id: '550e8400-e29b-41d4-a716-446655440001',
        serverId: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Query Records',
        category: 'database',
      },
    ];
    mockDbResults['servers'] = [
      {
        id: '550e8400-e29b-41d4-a716-446655440000',
        registeredBy: '550e8400-e29b-41d4-a716-446655440000',
      },
    ];
    mockDbResults['update'] = [
      {
        id: '550e8400-e29b-41d4-a716-446655440001',
        name: 'Updated Query',
        category: 'database',
      },
    ];

    const app = await buildTestApp();
    const response = await app.inject({
      method: 'PUT',
      url: '/api/v1/capabilities/550e8400-e29b-41d4-a716-446655440001',
      payload: { name: 'Updated Query' },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.name).toBe('Updated Query');
  });

  it('should delete a capability', async () => {
    mockDbResults['capabilities'] = [
      {
        id: '550e8400-e29b-41d4-a716-446655440001',
        serverId: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Query Records',
        category: 'database',
      },
    ];
    mockDbResults['servers'] = [
      {
        id: '550e8400-e29b-41d4-a716-446655440000',
        registeredBy: '550e8400-e29b-41d4-a716-446655440000',
      },
    ];
    mockDbResults['delete'] = [
      { id: '550e8400-e29b-41d4-a716-446655440001' },
    ];

    const app = await buildTestApp();
    const response = await app.inject({
      method: 'DELETE',
      url: '/api/v1/capabilities/550e8400-e29b-41d4-a716-446655440001',
    });

    expect(response.statusCode).toBe(204);
  });

  it('should return 404 for non-existent capability on delete', async () => {
    mockDbResults['capabilities'] = [];

    const app = await buildTestApp();
    const response = await app.inject({
      method: 'DELETE',
      url: '/api/v1/capabilities/550e8400-e29b-41d4-a716-446655440999',
    });

    expect(response.statusCode).toBe(404);
  });

  it('should return 404 for non-existent capability on update', async () => {
    mockDbResults['capabilities'] = [];

    const app = await buildTestApp();
    const response = await app.inject({
      method: 'PUT',
      url: '/api/v1/capabilities/550e8400-e29b-41d4-a716-446655440999',
      payload: { name: 'Updated' },
    });

    expect(response.statusCode).toBe(404);
  });

  it('should add a tool to a capability', async () => {
    mockDbResults['capabilities'] = [
      {
        id: '550e8400-e29b-41d4-a716-446655440001',
        serverId: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Query Records',
      },
    ];
    mockDbResults['servers'] = [
      {
        id: '550e8400-e29b-41d4-a716-446655440000',
        registeredBy: '550e8400-e29b-41d4-a716-446655440000',
      },
    ];
    mockDbResults['insert'] = [
      {
        id: '550e8400-e29b-41d4-a716-446655440002',
        capabilityId: '550e8400-e29b-41d4-a716-446655440001',
        name: 'Find Record',
        createdAt: new Date('2024-01-15T00:00:00Z'),
      },
    ];

    const app = await buildTestApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/capabilities/550e8400-e29b-41d4-a716-446655440001/tools',
      payload: {
        name: 'Find Record',
        inputSchema: { type: 'object' },
      },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.name).toBe('Find Record');
  });

  it('should return 404 when adding tool to non-existent capability', async () => {
    mockDbResults['capabilities'] = [];

    const app = await buildTestApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/capabilities/550e8400-e29b-41d4-a716-446655440999/tools',
      payload: {
        name: 'Find Record',
        inputSchema: { type: 'object' },
      },
    });

    expect(response.statusCode).toBe(404);
  });

  it('should add a resource to a capability', async () => {
    mockDbResults['capabilities'] = [
      {
        id: '550e8400-e29b-41d4-a716-446655440001',
        serverId: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Query Records',
      },
    ];
    mockDbResults['servers'] = [
      {
        id: '550e8400-e29b-41d4-a716-446655440000',
        registeredBy: '550e8400-e29b-41d4-a716-446655440000',
      },
    ];
    mockDbResults['insert'] = [
      {
        id: '550e8400-e29b-41d4-a716-446655440003',
        capabilityId: '550e8400-e29b-41d4-a716-446655440001',
        name: 'Example Resource',
        uri: 'http://example.com/resource',
        createdAt: new Date('2024-01-15T00:00:00Z'),
      },
    ];

    const app = await buildTestApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/capabilities/550e8400-e29b-41d4-a716-446655440001/resources',
      payload: {
        name: 'Example Resource',
        uri: 'http://example.com/resource',
      },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.name).toBe('Example Resource');
  });

  it('should return 404 when adding resource to non-existent capability', async () => {
    mockDbResults['capabilities'] = [];

    const app = await buildTestApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/capabilities/550e8400-e29b-41d4-a716-446655440999/resources',
      payload: {
        name: 'Example Resource',
        uri: 'http://example.com/resource',
      },
    });

    expect(response.statusCode).toBe(404);
  });
});
