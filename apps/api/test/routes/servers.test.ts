import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';
import { ZodTypeProvider, validatorCompiler, serializerCompiler } from 'fastify-type-provider-zod';
import { serverRoutes } from '../../src/routes/servers.js';

const mockDbResults: Record<string, any[]> = {};

function createMockChain() {
  let currentTable = 'default';
  const chain: any = {
    from: vi.fn((table: any) => {
      currentTable = table?.[Symbol.for('drizzle:Name')] || 'default';
      return chain;
    }),
    where: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    offset: vi.fn(() => chain),
    orderBy: vi.fn(() => chain),
    then: (resolve: any) => Promise.resolve(mockDbResults[currentTable] || []).then(resolve),
  };
  return chain;
}

vi.mock('../../src/db/index.js', () => ({
  db: {
    select: vi.fn(() => createMockChain()),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([
          {
            id: '550e8400-e29b-41d4-a716-446655440001',
            name: 'New Server',
            url: 'http://localhost:4001',
            status: 'unknown',
            registeredAt: new Date(),
          },
        ]),
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

async function buildTestApp(opts: { authenticated?: boolean } = {}) {
  const { authenticated = true } = opts;
  const app = Fastify({ logger: false }).withTypeProvider<ZodTypeProvider>();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.decorate('authenticate', async (request: any, reply: any) => {
    if (!authenticated) {
      return reply.code(401).send({ error: 'Authentication required' });
    }
    request.user = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      email: 'test@test.com',
      name: 'Test User',
      role: 'developer',
    };
  });
  app.decorate('requireAdmin', async () => {});
  await app.register(serverRoutes, { prefix: '/api/v1/servers' });
  return app;
}

describe('Server Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(mockDbResults).forEach(k => delete mockDbResults[k]);
  });

  it('should list servers', async () => {
    mockDbResults['servers'] = [
      {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Test Server',
        description: 'A test server',
        url: 'http://localhost:4000',
        status: 'healthy',
        registeredAt: new Date('2024-01-15'),
      },
    ];
    mockDbResults['servers_count'] = [{ count: 1 }];

    const app = await buildTestApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/servers',
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.data).toBeDefined();
    expect(body.pagination).toBeDefined();
  });

  it('should get server by id', async () => {
    mockDbResults['servers'] = [
      {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Test Server',
        description: 'A test server',
        url: 'http://localhost:4000',
        healthEndpoint: null,
        status: 'healthy',
        healthCheckInterval: 60,
        metadata: null,
        lastHealthCheck: new Date('2024-01-15'),
        registeredAt: new Date('2024-01-15'),
        updatedAt: new Date('2024-01-15'),
      },
    ];
    mockDbResults['capabilities'] = [
      {
        id: '550e8400-e29b-41d4-a716-446655440001',
        name: 'Query Records',
        description: null,
        category: 'database',
        tags: ['crm'],
      },
    ];

    const app = await buildTestApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/servers/550e8400-e29b-41d4-a716-446655440000',
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.id).toBe('550e8400-e29b-41d4-a716-446655440000');
    expect(body.capabilities).toHaveLength(1);
  });

  it('should return 404 for non-existent server', async () => {
    mockDbResults['servers'] = [];
    const app = await buildTestApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/servers/550e8400-e29b-41d4-a716-446655440999',
    });

    expect(response.statusCode).toBe(404);
  });

  it('should reject unauthenticated server creation', async () => {
    const app = await buildTestApp({ authenticated: false });
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/servers',
      payload: { name: 'New Server', url: 'http://localhost:4001' },
    });

    expect(response.statusCode).toBe(401);
  });

  it('should create a server when authenticated', async () => {
    const app = await buildTestApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/servers',
      payload: {
        name: 'New Server',
        url: 'http://localhost:4001',
      },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.name).toBe('New Server');
  });

  it('should return 400 for invalid server data', async () => {
    const app = await buildTestApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/servers',
      payload: {
        name: '',
        url: 'not-a-url',
      },
    });

    expect(response.statusCode).toBe(400);
  });

  it('should reject unauthenticated server update', async () => {
    const app = await buildTestApp({ authenticated: false });
    const response = await app.inject({
      method: 'PUT',
      url: '/api/v1/servers/550e8400-e29b-41d4-a716-446655440000',
      payload: { name: 'Updated' },
    });

    expect(response.statusCode).toBe(401);
  });

  it('should update a server when authenticated', async () => {
    mockDbResults['servers'] = [
      {
        id: '550e8400-e29b-41d4-a716-446655440000',
        registeredBy: '550e8400-e29b-41d4-a716-446655440000',
      },
    ];
    mockDbResults['update'] = [
      {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Updated Server',
        url: 'http://localhost:4000',
        status: 'healthy',
        updatedAt: new Date(),
      },
    ];
    const app = await buildTestApp();
    const response = await app.inject({
      method: 'PUT',
      url: '/api/v1/servers/550e8400-e29b-41d4-a716-446655440000',
      payload: {
        name: 'Updated Server',
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.name).toBe('Updated Server');
  });

  it('should reject unauthenticated server delete', async () => {
    const app = await buildTestApp({ authenticated: false });
    const response = await app.inject({
      method: 'DELETE',
      url: '/api/v1/servers/550e8400-e29b-41d4-a716-446655440000',
    });

    expect(response.statusCode).toBe(401);
  });

  it('should delete a server when authenticated', async () => {
    mockDbResults['servers'] = [
      {
        id: '550e8400-e29b-41d4-a716-446655440000',
        registeredBy: '550e8400-e29b-41d4-a716-446655440000',
      },
    ];
    mockDbResults['delete'] = [{ id: '550e8400-e29b-41d4-a716-446655440000' }];
    const app = await buildTestApp();
    const response = await app.inject({
      method: 'DELETE',
      url: '/api/v1/servers/550e8400-e29b-41d4-a716-446655440000',
    });

    expect(response.statusCode).toBe(204);
  });

  it('should return 404 for non-existent server on delete', async () => {
    mockDbResults['delete'] = [];
    const app = await buildTestApp();
    const response = await app.inject({
      method: 'DELETE',
      url: '/api/v1/servers/550e8400-e29b-41d4-a716-446655440999',
    });

    expect(response.statusCode).toBe(404);
  });

  it('should return 404 for non-existent server on update', async () => {
    mockDbResults['servers'] = [];
    const app = await buildTestApp();
    const response = await app.inject({
      method: 'PUT',
      url: '/api/v1/servers/550e8400-e29b-41d4-a716-446655440999',
      payload: { name: 'Updated' },
    });

    expect(response.statusCode).toBe(404);
  });
});
