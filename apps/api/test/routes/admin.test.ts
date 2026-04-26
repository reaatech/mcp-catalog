import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';
import { ZodTypeProvider, validatorCompiler, serializerCompiler } from 'fastify-type-provider-zod';
import { adminRoutes } from '../../src/routes/admin.js';
import { db } from '../../src/db/index.js';

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
      email: 'admin@test.com',
      name: 'Admin',
      role: 'admin',
    };
  });
  app.decorate('requireAdmin', async () => {});
  await app.register(adminRoutes, { prefix: '/api/v1/admin' });
  return app;
}

describe('Admin Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(mockDbResults).forEach(k => delete mockDbResults[k]);
  });

  it('should list users', async () => {
    mockDbResults['users'] = [
      {
        id: '550e8400-e29b-41d4-a716-446655440000',
        email: 'admin@test.com',
        name: 'Admin',
        role: 'admin',
        createdAt: new Date('2024-01-15T00:00:00Z'),
      },
    ];
    mockDbResults['users_count'] = [{ count: 1 }];

    const app = await buildTestApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/users',
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.data).toHaveLength(1);
    expect(body.pagination).toBeDefined();
  });

  it('should create a user', async () => {
    mockDbResults['insert'] = [
      {
        id: '550e8400-e29b-41d4-a716-446655440001',
        email: 'new@test.com',
        name: 'New User',
        role: 'viewer',
        createdAt: new Date('2024-01-15T00:00:00Z'),
      },
    ];

    const app = await buildTestApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/users',
      payload: { email: 'new@test.com', name: 'New User', role: 'viewer', password: 'Str0ng!Passwd' },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.email).toBe('new@test.com');
  });

  it('should reject user creation without a password', async () => {
    const app = await buildTestApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/users',
      payload: { email: 'nopw@test.com', name: 'No PW', role: 'viewer' },
    });

    expect(response.statusCode).toBe(400);
  });

  it('should return 409 for duplicate email', async () => {
    vi.mocked(db.insert).mockReturnValueOnce({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockRejectedValue({ code: '23505' }),
      }),
    } as any);

    const app = await buildTestApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/users',
      payload: { email: 'dup@test.com', name: 'Dup', role: 'viewer', password: 'Str0ng!Passwd' },
    });

    expect(response.statusCode).toBe(409);
  });

  it('should delete a user', async () => {
    mockDbResults['users'] = [
      { id: '550e8400-e29b-41d4-a716-446655440001', role: 'viewer' },
    ];
    mockDbResults['users_count'] = [{ count: 3 }];
    mockDbResults['delete'] = [
      { id: '550e8400-e29b-41d4-a716-446655440001' },
    ];

    const app = await buildTestApp();
    const response = await app.inject({
      method: 'DELETE',
      url: '/api/v1/admin/users/550e8400-e29b-41d4-a716-446655440001',
    });

    expect(response.statusCode).toBe(204);
  });

  it('should return 404 for non-existent user', async () => {
    mockDbResults['delete'] = [];

    const app = await buildTestApp();
    const response = await app.inject({
      method: 'DELETE',
      url: '/api/v1/admin/users/550e8400-e29b-41d4-a716-446655440999',
    });

    expect(response.statusCode).toBe(404);
  });

  it('should list access policies', async () => {
    mockDbResults['access_policies'] = [
      {
        id: '550e8400-e29b-41d4-a716-446655440002',
        serverId: '550e8400-e29b-41d4-a716-446655440000',
        capabilityId: null,
        userId: null,
        role: null,
        teamId: null,
        permission: 'discover',
        createdAt: new Date('2024-01-15T00:00:00Z'),
      },
    ];
    mockDbResults['access_policies_count'] = [{ count: 1 }];

    const app = await buildTestApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/access-policies',
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.data).toHaveLength(1);
  });

  it('should create access policy', async () => {
    mockDbResults['insert'] = [
      {
        id: '550e8400-e29b-41d4-a716-446655440002',
        permission: 'execute',
        createdAt: new Date('2024-01-15T00:00:00Z'),
      },
    ];

    const app = await buildTestApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/access-policies',
      payload: { permission: 'execute' },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.permission).toBe('execute');
  });

  it('should delete access policy', async () => {
    mockDbResults['delete'] = [
      { id: '550e8400-e29b-41d4-a716-446655440002' },
    ];

    const app = await buildTestApp();
    const response = await app.inject({
      method: 'DELETE',
      url: '/api/v1/admin/access-policies/550e8400-e29b-41d4-a716-446655440002',
    });

    expect(response.statusCode).toBe(204);
  });

  it('should return 404 for non-existent access policy', async () => {
    mockDbResults['delete'] = [];

    const app = await buildTestApp();
    const response = await app.inject({
      method: 'DELETE',
      url: '/api/v1/admin/access-policies/550e8400-e29b-41d4-a716-446655440999',
    });

    expect(response.statusCode).toBe(404);
  });

  it('should list audit logs', async () => {
    mockDbResults['audit_logs'] = [
      {
        id: '550e8400-e29b-41d4-a716-446655440003',
        userId: '550e8400-e29b-41d4-a716-446655440000',
        action: 'create.server',
        resourceType: 'servers',
        resourceId: '550e8400-e29b-41d4-a716-446655440000',
        details: { method: 'POST', url: '/api/v1/servers', statusCode: 201 },
        ipAddress: '127.0.0.1',
        createdAt: new Date('2024-01-15T00:00:00Z'),
      },
    ];
    mockDbResults['audit_logs_count'] = [{ count: 1 }];

    const app = await buildTestApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/audit-logs',
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.data).toHaveLength(1);
  });
});
