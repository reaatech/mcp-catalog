import { describe, it, expect, vi, beforeEach } from 'vitest';
import { auditPlugin } from '../../src/middleware/audit.js';
import { db } from '../../src/db/index.js';

vi.mock('../../src/db/index.js', () => ({
  db: {
    insert: vi.fn(() => ({
      values: vi.fn().mockResolvedValue(undefined),
    })),
  },
}));

describe('Audit Middleware', () => {
  let hooks: Array<{ name: string; fn: Function }>;
  let mockFastify: any;

  beforeEach(() => {
    vi.clearAllMocks();
    hooks = [];
    mockFastify = {
      addHook: vi.fn((name: string, fn: Function) => {
        hooks.push({ name, fn });
      }),
      log: { warn: vi.fn(), error: vi.fn() },
    };
  });

  async function runHook(requestOverrides: any = {}) {
    await auditPlugin(mockFastify);
    const onResponse = hooks.find(h => h.name === 'onResponse')?.fn;
    expect(onResponse).toBeDefined();
    await onResponse!(
      {
        method: 'POST',
        url: '/api/v1/servers',
        routerMethod: 'POST',
        params: {},
        ip: '127.0.0.1',
        headers: {},
        user: { id: 'test-user' },
        ...requestOverrides,
      },
      { statusCode: 201 }
    );
  }

  it('should audit POST requests', async () => {
    await runHook();
    expect(db.insert).toHaveBeenCalled();
  });

  it('should audit PUT requests', async () => {
    await runHook({ method: 'PUT', url: '/api/v1/servers/123' });
    expect(db.insert).toHaveBeenCalled();
  });

  it('should audit PATCH requests', async () => {
    await runHook({ method: 'PATCH', url: '/api/v1/servers/123' });
    expect(db.insert).toHaveBeenCalled();
  });

  it('should audit DELETE requests', async () => {
    await runHook({ method: 'DELETE', url: '/api/v1/servers/123' });
    expect(db.insert).toHaveBeenCalled();
  });

  it('should skip GET requests', async () => {
    await runHook({ method: 'GET', url: '/api/v1/servers' });
    expect(db.insert).not.toHaveBeenCalled();
  });

  it('should skip health endpoints', async () => {
    await runHook({ method: 'POST', url: '/health' });
    expect(db.insert).not.toHaveBeenCalled();
  });

  it('should skip documentation endpoints', async () => {
    await runHook({ method: 'POST', url: '/documentation' });
    expect(db.insert).not.toHaveBeenCalled();
  });

  it('should handle missing user gracefully', async () => {
    await runHook({ user: undefined });
    expect(db.insert).toHaveBeenCalled();
  });

  it('should catch and log errors', async () => {
    vi.mocked(db.insert).mockImplementationOnce(() => {
      throw new Error('DB error');
    });
    await runHook();
    expect(mockFastify.log.warn).toHaveBeenCalled();
  });
});
