import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';
import { ZodV3TypeProvider, zValidatorCompiler, zSerializerCompiler } from '../../src/lib/type-provider.js';
import { searchRoutes } from '../../src/routes/search.js';
import { servers, capabilities } from '../../src/db/schema.js';

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
  },
}));

describe('Search Routes', () => {
  let app: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    vi.clearAllMocks();
    Object.keys(mockDbResults).forEach(k => delete mockDbResults[k]);

    app = Fastify({ logger: false }).withTypeProvider<ZodV3TypeProvider>();
    app.setValidatorCompiler(zValidatorCompiler);
    app.setSerializerCompiler(zSerializerCompiler);
    await app.register(searchRoutes, { prefix: '/api/v1/search' });
  });

  it('should search servers and capabilities', async () => {
    mockDbResults['servers'] = [
      {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Salesforce MCP',
        description: 'Salesforce integration',
        url: 'http://localhost:4000',
        status: 'healthy',
        registeredAt: new Date('2024-01-15T00:00:00Z'),
      },
    ];
    mockDbResults['servers_count'] = [{ count: 1 }];
    mockDbResults['capabilities'] = [
      {
        id: '550e8400-e29b-41d4-a716-446655440001',
        serverId: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Query Records',
        description: 'Query Salesforce records',
        category: 'database',
        tags: ['salesforce', 'crm'],
        createdAt: new Date('2024-01-15T00:00:00Z'),
      },
    ];

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/search?q=salesforce',
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.servers).toHaveLength(1);
    expect(body.capabilities).toHaveLength(1);
    expect(body.pagination).toBeDefined();
  });

  it('should search with category filter', async () => {
    mockDbResults['servers'] = [];
    mockDbResults['servers_count'] = [{ count: 0 }];
    mockDbResults['capabilities'] = [
      {
        id: '550e8400-e29b-41d4-a716-446655440001',
        serverId: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Query Records',
        description: null,
        category: 'database',
        tags: [],
        createdAt: new Date('2024-01-15T00:00:00Z'),
      },
    ];

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/search?q=database&category=database',
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.capabilities).toHaveLength(1);
  });

  it('should search with tags filter', async () => {
    mockDbResults['servers'] = [];
    mockDbResults['servers_count'] = [{ count: 0 }];
    mockDbResults['capabilities'] = [
      {
        id: '550e8400-e29b-41d4-a716-446655440001',
        serverId: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Query Records',
        description: null,
        category: 'database',
        tags: ['crm', 'salesforce'],
        createdAt: new Date('2024-01-15T00:00:00Z'),
      },
    ];

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/search?q=query&tags=crm,salesforce',
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.capabilities).toHaveLength(1);
  });

  it('should return empty results when nothing matches', async () => {
    mockDbResults['servers'] = [];
    mockDbResults['servers_count'] = [{ count: 0 }];
    mockDbResults['capabilities'] = [];

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/search?q=zzznonexistent',
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.servers).toHaveLength(0);
    expect(body.capabilities).toHaveLength(0);
  });

  it('should filter by status', async () => {
    mockDbResults['servers'] = [
      {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Healthy Server',
        description: null,
        url: 'http://localhost:4000',
        status: 'healthy',
        registeredAt: new Date('2024-01-15T00:00:00Z'),
      },
    ];
    mockDbResults['servers_count'] = [{ count: 1 }];
    mockDbResults['capabilities'] = [];

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/search?q=server&status=healthy',
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.servers).toHaveLength(1);
  });

  it('should require query parameter', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/search',
    });

    expect(response.statusCode).toBe(400);
  });

  it('should limit results based on query parameter', async () => {
    mockDbResults['servers'] = [];
    mockDbResults['servers_count'] = [{ count: 0 }];
    mockDbResults['capabilities'] = [];

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/search?q=test&limit=5&offset=10',
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.pagination.limit).toBe(5);
    expect(body.pagination.offset).toBe(10);
  });
});
