import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('api-client', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should use default CATALOG_API_URL', async () => {
    delete process.env.CATALOG_API_URL;
    const { apiGet } = await import('../src/lib/api-client.js');

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [] }),
    });

    await apiGet('/api/v1/servers');
    expect(fetch).toHaveBeenCalledWith('http://localhost:3000/api/v1/servers', expect.any(Object));
  });

  it('should use custom CATALOG_API_URL', async () => {
    process.env.CATALOG_API_URL = 'http://custom:4000';
    const { apiGet } = await import('../src/lib/api-client.js');

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [] }),
    });

    await apiGet('/test');
    expect(fetch).toHaveBeenCalledWith('http://custom:4000/test', expect.any(Object));
  });

  it('should handle NaN timeout gracefully', async () => {
    process.env.CATALOG_REQUEST_TIMEOUT = 'not a number';
    const { apiGet } = await import('../src/lib/api-client.js');

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ status: 'ok' }),
    });

    const result = await apiGet('/health');
    expect(result).toEqual({ status: 'ok' });
  });

  it('should throw on non-ok response', async () => {
    delete process.env.CATALOG_API_URL;
    const { apiGet } = await import('../src/lib/api-client.js');

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    });

    await expect(apiGet('/error')).rejects.toThrow('API error: 500 Internal Server Error');
  });

  it('should send API key header when configured', async () => {
    process.env.CATALOG_API_KEY = 'test-key-123';
    const { apiGet } = await import('../src/lib/api-client.js');

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });

    await apiGet('/test');
    const callArgs = (fetch as any).mock.calls[0][1];
    expect(callArgs.headers['X-API-Key']).toBe('test-key-123');
  });
});
