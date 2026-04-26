import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import { ZodTypeProvider, validatorCompiler, serializerCompiler } from 'fastify-type-provider-zod';
import { authRoutes } from '../../src/routes/auth.js';
import { generateToken, hashPassword, createRefreshTokenFamily } from '../../src/utils/auth.js';

const mockDbState = {
  users: [] as any[],
  apiKeys: [] as any[],
  refreshTokenFamilies: [] as any[],
  insert: [] as any[],
  delete: [] as any[],
  updateResult: [] as any[],
};

vi.mock('../../src/db/index.js', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn((table: any) => ({
        where: vi.fn(() => ({
          limit: vi.fn().mockResolvedValue(
            table?.[Symbol.for('drizzle:Name')] === 'users' ? mockDbState.users :
            table?.[Symbol.for('drizzle:Name')] === 'api_keys' ? mockDbState.apiKeys :
            table?.[Symbol.for('drizzle:Name')] === 'refresh_token_families' ? mockDbState.refreshTokenFamilies :
            []
          ),
        })),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn().mockResolvedValue(mockDbState.insert),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn().mockResolvedValue(undefined),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn().mockResolvedValue(undefined),
    })),
  },
}));

async function buildTestApp(opts: { user?: { id: string; role: string } | null } = {}) {
  const { user = { id: '550e8400-e29b-41d4-a716-446655440000', role: 'developer' } } = opts;
  const app = Fastify({ logger: false }).withTypeProvider<ZodTypeProvider>();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  await app.register(cookie, { secret: 'test-cookie-secret-for-testing-only' });
  app.decorate('authenticate', async (request: any, reply: any) => {
    if (!user) {
      return reply.code(401).send({ error: 'Authentication required' });
    }
    request.user = {
      id: user.id,
      email: 'test@test.com',
      name: 'Test User',
      role: user.role,
    };
  });
  app.decorate('requireAdmin', async () => {});
  await app.register(authRoutes, { prefix: '/api/v1/auth' });
  return app;
}

describe('Auth Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbState.users = [];
    mockDbState.apiKeys = [];
    mockDbState.refreshTokenFamilies = [];
    mockDbState.insert = [];
    mockDbState.delete = [];
    mockDbState.updateResult = [];
  });

  it('should reject login with invalid credentials', async () => {
    const app = await buildTestApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: 'nonexistent@example.com',
        password: 'wrongpassword',
      },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toHaveProperty('error');
  });

  it('should login with valid credentials', async () => {
    const passwordHash = await hashPassword('correctpassword');
    mockDbState.users = [
      {
        id: '550e8400-e29b-41d4-a716-446655440000',
        email: 'test@example.com',
        name: 'Test User',
        role: 'developer',
        passwordHash,
      },
    ];

    const app = await buildTestApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: 'test@example.com',
        password: 'correctpassword',
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.token).toBeDefined();
    expect(body.user.email).toBe('test@example.com');
  });

  it('should reject wrong password for existing user', async () => {
    const hash = await hashPassword('correctpassword');
    mockDbState.users = [
      {
        id: '550e8400-e29b-41d4-a716-446655440000',
        email: 'test@example.com',
        name: 'Test User',
        role: 'developer',
        passwordHash: hash,
      },
    ];

    const app = await buildTestApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: 'test@example.com',
        password: 'wrongpassword',
      },
    });

    expect(response.statusCode).toBe(401);
  });

  it('should reject invalid refresh token', async () => {
    const app = await buildTestApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      payload: {
        refreshToken: 'invalid-token',
      },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toHaveProperty('error');
  });

  it('should refresh with valid token', async () => {
    const user = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      email: 'test@example.com',
      name: 'Test User',
      role: 'developer',
      passwordHash: null,
    };
    mockDbState.users = [user];
    const { token: refreshToken, familyId } = await createRefreshTokenFamily(user.id);
    mockDbState.refreshTokenFamilies = [
      { family: familyId, revoked: null, userId: user.id },
    ];

    const app = await buildTestApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      payload: { refreshToken },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.token).toBeDefined();
  });

  it('should reject API key creation without authentication', async () => {
    const app = await buildTestApp({ user: null });
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/api-keys',
      payload: { name: 'Test Key' },
    });

    expect(response.statusCode).toBe(401);
  });

  it('should create an API key for the authenticated user', async () => {
    mockDbState.insert = [
      {
        id: '550e8400-e29b-41d4-a716-446655440111',
        name: 'Test Key',
        createdAt: new Date('2024-01-15T00:00:00Z'),
      },
    ];

    const app = await buildTestApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/api-keys',
      payload: { name: 'Test Key' },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.name).toBe('Test Key');
    expect(body.key).toMatch(/^mcp_/);
  });

  it('should reject API key deletion without authentication', async () => {
    const app = await buildTestApp({ user: null });
    const response = await app.inject({
      method: 'DELETE',
      url: '/api/v1/auth/api-keys/550e8400-e29b-41d4-a716-446655440000',
    });

    expect(response.statusCode).toBe(401);
  });

  it('should return 404 when deleting non-existent API key', async () => {
    mockDbState.apiKeys = [];
    const app = await buildTestApp();
    const response = await app.inject({
      method: 'DELETE',
      url: '/api/v1/auth/api-keys/550e8400-e29b-41d4-a716-446655440000',
    });

    expect(response.statusCode).toBe(404);
  });

  it('should forbid revoking another user\'s key', async () => {
    mockDbState.apiKeys = [
      { id: '550e8400-e29b-41d4-a716-446655440aaa', userId: '550e8400-e29b-41d4-a716-446655440bbb' },
    ];
    const app = await buildTestApp();
    const response = await app.inject({
      method: 'DELETE',
      url: '/api/v1/auth/api-keys/550e8400-e29b-41d4-a716-446655440aaa',
    });

    expect(response.statusCode).toBe(403);
  });

  it('should revoke the caller\'s own API key', async () => {
    mockDbState.apiKeys = [
      { id: '550e8400-e29b-41d4-a716-446655440aaa', userId: '550e8400-e29b-41d4-a716-446655440000' },
    ];
    const app = await buildTestApp();
    const response = await app.inject({
      method: 'DELETE',
      url: '/api/v1/auth/api-keys/550e8400-e29b-41d4-a716-446655440aaa',
    });

    expect(response.statusCode).toBe(204);
  });

  it('should allow admin to revoke any API key', async () => {
    mockDbState.apiKeys = [
      { id: '550e8400-e29b-41d4-a716-446655440aaa', userId: '550e8400-e29b-41d4-a716-446655440bbb' },
    ];
    const app = await buildTestApp({ user: { id: '550e8400-e29b-41d4-a716-446655440ccc', role: 'admin' } });
    const response = await app.inject({
      method: 'DELETE',
      url: '/api/v1/auth/api-keys/550e8400-e29b-41d4-a716-446655440aaa',
    });

    expect(response.statusCode).toBe(204);
  });
});
