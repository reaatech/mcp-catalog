import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildApp } from '../../src/app.js';

const mockDbState = {
  servers: [] as any[],
};

vi.mock('../../src/db/index.js', () => ({
  db: {
    select: vi.fn(() => {
      const chain: any = {
        from: vi.fn(() => chain),
        where: vi.fn(() => chain),
        limit: vi.fn(() => chain),
        then: (resolve: any) => Promise.resolve(mockDbState.servers || []).then(resolve),
      };
      return chain;
    }),
  },
}));

describe('Health Routes', () => {
  beforeEach(() => {
    mockDbState.servers = [];
  });

  it('should return ok on health check', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.status).toBe('ok');
    expect(body.uptime).toBeGreaterThan(0);
  });

  it('should return ready on readiness probe', async () => {
    mockDbState.servers = [{ n: 1 }];
    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/health/ready',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().status).toBe('ready');
  });

  it('should return alive on liveness probe', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/health/live',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().status).toBe('alive');
  });

  it('should get server health status', async () => {
    mockDbState.servers = [
      {
        id: '550e8400-e29b-41d4-a716-446655440000',
        status: 'healthy',
        lastHealthCheck: new Date('2024-01-15T00:00:00Z'),
        healthCheckInterval: 60,
      },
    ];

    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/health/servers/550e8400-e29b-41d4-a716-446655440000',
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.status).toBe('healthy');
    expect(body.serverId).toBe('550e8400-e29b-41d4-a716-446655440000');
  });

  it('should return 404 for non-existent server health', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/health/servers/550e8400-e29b-41d4-a716-446655440999',
    });

    expect(response.statusCode).toBe(404);
  });

  it('should handle server with no lastHealthCheck', async () => {
    mockDbState.servers = [
      {
        id: '550e8400-e29b-41d4-a716-446655440000',
        status: 'unknown',
        lastHealthCheck: null,
        healthCheckInterval: 60,
      },
    ];

    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/health/servers/550e8400-e29b-41d4-a716-446655440000',
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.status).toBe('unknown');
    expect(body.nextCheckDue).toBeNull();
  });
});
