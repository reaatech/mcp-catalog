import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HealthCheckService } from '../../src/services/healthCheck.js';

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
        returning: vi.fn().mockResolvedValue(undefined),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn().mockResolvedValue(undefined),
      })),
    })),
  },
}));

describe('HealthCheckService', () => {
  let service: HealthCheckService;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    service = new HealthCheckService({ timeout: 1000, retries: 1, backoffMs: 100 });
    fetchMock = vi.fn();
    global.fetch = fetchMock as any;
    vi.clearAllMocks();
    Object.keys(mockDbResults).forEach(k => delete mockDbResults[k]);
  });

  describe('checkServer', () => {
    it('should return healthy for successful response', async () => {
      mockDbResults['servers'] = [
        {
          id: '550e8400-e29b-41d4-a716-446655440000',
          url: 'http://localhost:4000',
          healthEndpoint: null,
        },
      ];
      fetchMock.mockResolvedValue({ status: 200, ok: true });

      const result = await service.checkServer('550e8400-e29b-41d4-a716-446655440000');
      expect(result.status).toBe('healthy');
      expect(result.serverId).toBe('550e8400-e29b-41d4-a716-446655440000');
    });

    it('should use healthEndpoint when available', async () => {
      mockDbResults['servers'] = [
        {
          id: '550e8400-e29b-41d4-a716-446655440000',
          url: 'http://localhost:4000',
          healthEndpoint: 'http://localhost:4000/health',
        },
      ];
      fetchMock.mockResolvedValue({ status: 200, ok: true });

      await service.checkServer('550e8400-e29b-41d4-a716-446655440000');
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:4000/health',
        expect.any(Object)
      );
    });

    it('should return unhealthy for error response', async () => {
      mockDbResults['servers'] = [
        {
          id: '550e8400-e29b-41d4-a716-446655440000',
          url: 'http://localhost:4000',
          healthEndpoint: null,
        },
      ];
      fetchMock.mockResolvedValue({ status: 500, ok: false });

      const result = await service.checkServer('550e8400-e29b-41d4-a716-446655440000');
      expect(result.status).toBe('unhealthy');
    });

    it('should return error for fetch failure', async () => {
      mockDbResults['servers'] = [
        {
          id: '550e8400-e29b-41d4-a716-446655440000',
          url: 'http://localhost:4000',
          healthEndpoint: null,
        },
      ];
      fetchMock.mockRejectedValue(new Error('Connection refused'));

      const result = await service.checkServer('550e8400-e29b-41d4-a716-446655440000');
      expect(result.status).toBe('error');
    });

    it('should throw for unknown server', async () => {
      await expect(service.checkServer('unknown-id')).rejects.toThrow('Server unknown-id not found');
    });
  });

  describe('checkDueServers', () => {
    it('should check due servers', async () => {
      mockDbResults['servers'] = [
        {
          id: '550e8400-e29b-41d4-a716-446655440000',
          url: 'http://localhost:4000',
          healthEndpoint: null,
        },
      ];
      fetchMock.mockResolvedValue({ status: 200, ok: true });

      const results = await service.checkDueServers();
      expect(results).toHaveLength(1);
      expect(results[0].status).toBe('healthy');
    });

    it('should handle failed checks gracefully', async () => {
      mockDbResults['servers'] = [
        {
          id: '550e8400-e29b-41d4-a716-446655440000',
          url: 'http://localhost:4000',
          healthEndpoint: null,
        },
      ];
      fetchMock.mockRejectedValue(new Error('Connection refused'));

      const results = await service.checkDueServers();
      expect(results).toHaveLength(1);
      expect(results[0].status).toBe('error');
    });
  });

  describe('getHealthHistory', () => {
    it('should return health check history', async () => {
      mockDbResults['health_checks'] = [
        {
          serverId: '550e8400-e29b-41d4-a716-446655440000',
          status: 'healthy',
          responseTimeMs: 100,
          statusCode: 200,
          errorMessage: null,
          checkedAt: new Date(),
        },
      ];

      const history = await service.getHealthHistory('550e8400-e29b-41d4-a716-446655440000', 10);
      expect(history).toHaveLength(1);
      expect(history[0].status).toBe('healthy');
    });
  });

  describe('getHealthSummary', () => {
    it('should return health summary with checks', async () => {
      mockDbResults['servers'] = [
        { id: '1', status: 'healthy' },
        { id: '2', status: 'unhealthy' },
        { id: '3', status: 'unknown' },
      ];
      mockDbResults['health_checks'] = [
        { responseTimeMs: 100 },
        { responseTimeMs: 200 },
      ];

      const summary = await service.getHealthSummary();
      expect(summary.total).toBe(3);
      expect(summary.healthy).toBe(1);
      expect(summary.unhealthy).toBe(1);
      expect(summary.unknown).toBe(1);
      expect(summary.averageResponseTime).toBe(150);
    });

    it('should return health summary without checks', async () => {
      mockDbResults['servers'] = [
        { id: '1', status: 'healthy' },
      ];
      mockDbResults['health_checks'] = [];

      const summary = await service.getHealthSummary();
      expect(summary.total).toBe(1);
      expect(summary.averageResponseTime).toBe(0);
    });
  });
});
