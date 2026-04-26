# Skill: Health Check

## Purpose

Implement health monitoring for registered MCP servers in the mcp-catalog. This skill covers creating automated health checks, status tracking, and alerting for server availability.

## Prerequisites

- Project setup completed
- Database schema with health_checks table
- API server running
- Basic understanding of health monitoring concepts

## Tools Required

- Node.js with fetch/axios
- Drizzle ORM for database operations
- Cron or scheduling library
- Pino for logging

## Steps

### 1. Create Health Check Service

Create `apps/api/src/services/healthCheck.ts`:

```typescript
import { db } from '../db';
import { servers, healthChecks } from '../db/schema';
import { eq, and, gt, lt, desc, sql, isNull } from 'drizzle-orm';
import pino from 'pino';

const logger = pino();

export interface HealthCheckResult {
  serverId: string;
  status: 'healthy' | 'unhealthy' | 'timeout' | 'error';
  responseTimeMs: number;
  statusCode?: number;
  errorMessage?: string;
  checkedAt: Date;
}

export interface HealthCheckConfig {
  timeout?: number;
  retries?: number;
  backoffMs?: number;
}

const DEFAULT_CONFIG: HealthCheckConfig = {
  timeout: 10000, // 10 seconds
  retries: 3,
  backoffMs: 1000,
};

export class HealthCheckService {
  private config: HealthCheckConfig;

  constructor(config: HealthCheckConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Perform health check on a single server
   */
  async checkServer(serverId: string): Promise<HealthCheckResult> {
    // Get server details
    const [server] = await db
      .select()
      .from(servers)
      .where(eq(servers.id, serverId))
      .limit(1);

    if (!server) {
      throw new Error(`Server ${serverId} not found`);
    }

    const url = server.healthEndpoint || server.url;
    const startTime = Date.now();

    try {
      // Attempt health check with retries
      let lastError: Error | null = null;
      let response: Response | null = null;

      for (let attempt = 1; attempt <= this.config.retries!; attempt++) {
        try {
          // Add timeout to fetch
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

          response = await fetch(url, {
            method: 'GET',
            signal: controller.signal,
            headers: {
              'User-Agent': 'mcp-catalog-health-checker/1.0',
            },
          });

          clearTimeout(timeoutId);
          break;
        } catch (error) {
          lastError = error as Error;
          
          // Wait before retry (exponential backoff)
          if (attempt < this.config.retries!) {
            const backoff = this.config.backoffMs! * Math.pow(2, attempt - 1);
            await new Promise(resolve => setTimeout(resolve, backoff));
          }
        }
      }

      const responseTimeMs = Date.now() - startTime;

      if (!response) {
        // All retries failed
        const result: HealthCheckResult = {
          serverId,
          status: 'error',
          responseTimeMs,
          errorMessage: lastError?.message || 'All retries failed',
          checkedAt: new Date(),
        };

        await this.recordHealthCheck(result);
        return result;
      }

      // Check response status
      const status = response.status >= 200 && response.status < 300
        ? 'healthy'
        : 'unhealthy';

      const result: HealthCheckResult = {
        serverId,
        status,
        responseTimeMs,
        statusCode: response.status,
        checkedAt: new Date(),
      };

      await this.recordHealthCheck(result);
      return result;

    } catch (error) {
      const responseTimeMs = Date.now() - startTime;
      
      const result: HealthCheckResult = {
        serverId,
        status: 'timeout',
        responseTimeMs,
        errorMessage: (error as Error).message,
        checkedAt: new Date(),
      };

      await this.recordHealthCheck(result);
      return result;
    }
  }

  /**
   * Record health check result in database
   */
  private async recordHealthCheck(result: HealthCheckResult): Promise<void> {
    // Insert health check record
    await db.insert(healthChecks).values({
      serverId: result.serverId,
      status: result.status,
      responseTimeMs: result.responseTimeMs,
      statusCode: result.statusCode,
      errorMessage: result.errorMessage,
      checkedAt: result.checkedAt,
    });

    // Update server status based on recent checks
    await this.updateServerStatus(result.serverId);
  }

  /**
   * Update server status based on recent health checks
   */
  private async updateServerStatus(serverId: string): Promise<void> {
    // Get last 5 health checks
    const recentChecks = await db
      .select()
      .from(healthChecks)
      .where(eq(healthChecks.serverId, serverId))
      .orderBy(desc(healthChecks.checkedAt))
      .limit(5);

    if (recentChecks.length === 0) {
      return;
    }

    // Determine status based on recent checks
    const healthyCount = recentChecks.filter(c => c.status === 'healthy').length;
    let newStatus: 'healthy' | 'unhealthy' | 'unknown' = 'unknown';

    if (healthyCount === recentChecks.length) {
      newStatus = 'healthy';
    } else if (healthyCount === 0) {
      newStatus = 'unhealthy';
    } else {
      // Mixed results - keep previous status or use majority
      const [server] = await db
        .select()
        .from(servers)
        .where(eq(servers.id, serverId))
        .limit(1);

      newStatus = server?.status || 'unknown';
    }

    // Update server status
    await db
      .update(servers)
      .set({
        status: newStatus,
        lastHealthCheck: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(servers.id, serverId));
  }

  /**
   * Check all servers that are due for health check
   */
  async checkDueServers(): Promise<HealthCheckResult[]> {
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

    // Find servers that need health checks:
    // - never checked, OR
    // - last check was more than their interval ago (for healthy servers), OR
    // - last check was more than 5 minutes ago (for unhealthy/unknown servers)
    const serversToCheck = await db
      .select()
      .from(servers)
      .where(
        and(
          isNull(servers.lastHealthCheck),
          sql`${servers.lastHealthCheck} < ${fiveMinutesAgo}`,
          sql`${servers.lastHealthCheck} < ${new Date(now.getTime() - servers.healthCheckInterval * 1000)}`
        )
      );

    logger.info(`Found ${serversToCheck.length} servers to check`);

    const results = await Promise.allSettled(
      serversToCheck.map(server => this.checkServer(server.id))
    );

    const successfulResults: HealthCheckResult[] = [];
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        successfulResults.push(result.value);
      } else {
        logger.error(`Failed to check server ${serversToCheck[index].id}:`, result.reason);
      }
    });

    return successfulResults;
  }

  /**
   * Get health check history for a server
   */
  async getHealthHistory(
    serverId: string,
    limit: number = 100,
    startTime?: Date,
    endTime?: Date
  ): Promise<HealthCheckResult[]> {
    const conditions = [eq(healthChecks.serverId, serverId)];

    if (startTime) {
      conditions.push(gt(healthChecks.checkedAt, startTime));
    }
    if (endTime) {
      conditions.push(lt(healthChecks.checkedAt, endTime));
    }

    const records = await db
      .select()
      .from(healthChecks)
      .where(and(...conditions))
      .orderBy(desc(healthChecks.checkedAt))
      .limit(limit);

    return records.map(record => ({
      serverId: record.serverId,
      status: record.status,
      responseTimeMs: record.responseTimeMs,
      statusCode: record.statusCode,
      errorMessage: record.errorMessage,
      checkedAt: record.checkedAt,
    }));
  }

  /**
   * Get health summary for all servers
   */
  async getHealthSummary(): Promise<{
    total: number;
    healthy: number;
    unhealthy: number;
    unknown: number;
    averageResponseTime: number;
  }> {
    const allServers = await db.select().from(servers);

    const summary = {
      total: allServers.length,
      healthy: allServers.filter(s => s.status === 'healthy').length,
      unhealthy: allServers.filter(s => s.status === 'unhealthy').length,
      unknown: allServers.filter(s => s.status === 'unknown').length,
    };

    // Calculate average response time from recent checks
    const recentChecks = await db
      .select({ responseTimeMs: healthChecks.responseTimeMs })
      .from(healthChecks)
      .where(gt(healthChecks.checkedAt, new Date(Date.now() - 24 * 60 * 60 * 1000)))
      .limit(1000);

    const avgResponseTime = recentChecks.length > 0
      ? Math.round(
          recentChecks.reduce((sum, c) => sum + c.responseTimeMs, 0) / recentChecks.length
        )
      : 0;

    return {
      ...summary,
      averageResponseTime: avgResponseTime,
    };
  }
}

export const healthCheckService = new HealthCheckService();
```

### 2. Create Health Check Scheduler

Create `apps/api/src/services/healthCheckScheduler.ts`:

```typescript
import { healthCheckService } from './healthCheck';
import pino from 'pino';

const logger = pino();

export class HealthCheckScheduler {
  private interval: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(private checkIntervalMs: number = 60000) {}

  /**
   * Start the health check scheduler
   */
  start(): void {
    if (this.interval) {
      logger.warn('Health check scheduler already running');
      return;
    }

    logger.info(`Starting health check scheduler (interval: ${this.checkIntervalMs}ms)`);
    
    // Run immediately on start
    this.runChecks();
    
    // Then run on interval
    this.interval = setInterval(() => {
      this.runChecks();
    }, this.checkIntervalMs);
  }

  /**
   * Stop the health check scheduler
   */
  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      logger.info('Health check scheduler stopped');
    }
  }

  /**
   * Run health checks on all due servers
   */
  private async runChecks(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Health check run already in progress, skipping');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();

    try {
      logger.info('Starting health check run');
      
      const results = await healthCheckService.checkDueServers();
      
      const duration = Date.now() - startTime;
      const healthyCount = results.filter(r => r.status === 'healthy').length;
      const unhealthyCount = results.filter(r => r.status !== 'healthy').length;

      logger.info(
        `Health check run completed in ${duration}ms: ` +
        `${results.length} checked, ${healthyCount} healthy, ${unhealthyCount} unhealthy`
      );

      // Log any unhealthy servers
      results
        .filter(r => r.status !== 'healthy')
        .forEach(r => {
          logger.warn(
            `Server ${r.serverId} is ${r.status}: ${r.errorMessage || `HTTP ${r.statusCode}`}`
          );
        });

    } catch (error) {
      logger.error('Health check run failed:', error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Trigger an immediate health check for a specific server
   */
  async checkServerNow(serverId: string): Promise<void> {
    try {
      await healthCheckService.checkServer(serverId);
      logger.info(`Manual health check completed for server ${serverId}`);
    } catch (error) {
      logger.error(`Manual health check failed for server ${serverId}:`, error);
      throw error;
    }
  }
}

export const healthCheckScheduler = new HealthCheckScheduler();
```

### 3. Add Health Check Routes

Create `apps/api/src/routes/health.ts`:

```typescript
import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { healthCheckService } from '../services/healthCheck';
import { healthCheckScheduler } from '../services/healthCheckScheduler';
import { servers } from '../db/schema';
import { eq } from 'drizzle-orm';

export const healthRoutes: FastifyPluginAsync = async (fastify) => {
  // Get health summary
  fastify.get('/summary', {
    schema: {
      description: 'Get health summary for all servers',
      tags: ['health'],
      response: {
        200: z.object({
          total: z.number(),
          healthy: z.number(),
          unhealthy: z.number(),
          unknown: z.number(),
          averageResponseTime: z.number(),
        }),
      },
    },
    onRequest: [], // Add auth decorators when available: [fastify.authenticate]
  }, async (request, reply) => {
    const summary = await healthCheckService.getHealthSummary();
    return reply.send(summary);
  });

  // Get health history for a server
  fastify.get('/history/:serverId', {
    schema: {
      description: 'Get health check history for a specific server',
      tags: ['health'],
      params: z.object({
        serverId: z.string().uuid(),
      }),
      querystring: z.object({
        limit: z.coerce.number().min(1).max(1000).default(100).optional(),
        startTime: z.coerce.date().optional(),
        endTime: z.coerce.date().optional(),
      }),
      response: {
        200: z.array(z.object({
          serverId: z.string().uuid(),
          status: z.enum(['healthy', 'unhealthy', 'timeout', 'error']),
          responseTimeMs: z.number(),
          statusCode: z.number().optional(),
          errorMessage: z.string().optional(),
          checkedAt: z.string().datetime(),
        })),
      },
    },
    onRequest: [fastify.authenticate],
  }, async (request, reply) => {
    const { serverId } = request.params;
    const { limit, startTime, endTime } = request.query;

    const history = await healthCheckService.getHealthHistory(
      serverId,
      limit,
      startTime,
      endTime
    );

    return reply.send(history);
  });

  // Trigger manual health check
  fastify.post('/:serverId/check', {
    schema: {
      description: 'Trigger an immediate health check for a server',
      tags: ['health'],
      params: z.object({
        serverId: z.string().uuid(),
      }),
      response: {
        200: z.object({
          serverId: z.string().uuid(),
          status: z.enum(['healthy', 'unhealthy', 'timeout', 'error']),
          responseTimeMs: z.number(),
          statusCode: z.number().optional(),
          errorMessage: z.string().optional(),
          checkedAt: z.string().datetime(),
        }),
      },
    },
    onRequest: [], // Add auth decorators when available: [fastify.authenticate, fastify.requireAdmin]
  }, async (request, reply) => {
    const { serverId } = request.params;
    const result = await healthCheckService.checkServer(serverId);
    return reply.send(result);
  });

  // Get server health status (quick check)
  fastify.get('/servers/:serverId', {
    schema: {
      description: 'Get current health status for a server',
      tags: ['health'],
      params: z.object({
        serverId: z.string().uuid(),
      }),
      response: {
        200: z.object({
          serverId: z.string().uuid(),
          status: z.enum(['healthy', 'unhealthy', 'unknown']),
          lastHealthCheck: z.string().datetime().nullable(),
          healthCheckInterval: z.number(),
          nextCheckDue: z.string().datetime().nullable(),
        }),
      },
    },
  }, async (request, reply) => {
    const { serverId } = request.params;
    
    const [server] = await fastify.db
      .select({
        id: servers.id,
        status: servers.status,
        lastHealthCheck: servers.lastHealthCheck,
        healthCheckInterval: servers.healthCheckInterval,
      })
      .from(servers)
      .where(eq(servers.id, serverId))
      .limit(1);

    if (!server) {
      return reply.code(404).send({ error: 'Server not found' });
    }

    const nextCheckDue = server.lastHealthCheck
      ? new Date(server.lastHealthCheck.getTime() + server.healthCheckInterval * 1000)
      : null;

    return reply.send({
      serverId: server.id,
      status: server.status,
      lastHealthCheck: server.lastHealthCheck?.toISOString() || null,
      healthCheckInterval: server.healthCheckInterval,
      nextCheckDue: nextCheckDue?.toISOString() || null,
    });
  });
};
```

### 4. Initialize Scheduler on Startup

Update `apps/api/src/app.ts`:

```typescript
import { healthCheckScheduler } from './services/healthCheckScheduler';

// Start health check scheduler
healthCheckScheduler.start();

// Graceful shutdown
process.on('SIGTERM', () => {
  healthCheckScheduler.stop();
});

process.on('SIGINT', () => {
  healthCheckScheduler.stop();
});
```

### 5. Write Tests

Create `apps/api/test/services/healthCheck.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { healthCheckService } from '../../src/services/healthCheck';
import { db } from '../../src/db';
import { servers, healthChecks } from '../../src/db/schema';

describe('HealthCheckService', () => {
  let testServerId: string;

  beforeAll(async () => {
    // Create test server
    const [server] = await db
      .insert(servers)
      .values({
        name: 'Test Health Server',
        url: 'http://localhost:3001',
        status: 'unknown',
        healthCheckInterval: 60,
      })
      .returning();

    testServerId = server.id;
  });

  afterAll(async () => {
    // Clean up
    await db.delete(healthChecks).where(eq(healthChecks.serverId, testServerId));
    await db.delete(servers).where(eq(servers.id, testServerId));
  });

  it('should check server health', async () => {
    const result = await healthCheckService.checkServer(testServerId);

    expect(result.serverId).toBe(testServerId);
    expect(['healthy', 'unhealthy', 'timeout', 'error']).toContain(result.status);
    expect(result.responseTimeMs).toBeGreaterThan(0);
    expect(result.checkedAt).toBeInstanceOf(Date);
  });

  it('should record health check results', async () => {
    // Perform a health check
    await healthCheckService.checkServer(testServerId);

    // Verify it was recorded
    const records = await db
      .select()
      .from(healthChecks)
      .where(eq(healthChecks.serverId, testServerId))
      .limit(10);

    expect(records.length).toBeGreaterThan(0);
  });

  it('should update server status based on checks', async () => {
    // Perform multiple healthy checks
    for (let i = 0; i < 3; i++) {
      await healthCheckService.checkServer(testServerId);
    }

    // Check server status
    const [server] = await db
      .select()
      .from(servers)
      .where(eq(servers.id, testServerId))
      .limit(1);

    expect(server.status).toBe('healthy');
  });

  it('should get health history', async () => {
    const history = await healthCheckService.getHealthHistory(testServerId, 10);

    expect(Array.isArray(history)).toBe(true);
    expect(history.length).toBeGreaterThan(0);
    expect(history[0].serverId).toBe(testServerId);
  });

  it('should get health summary', async () => {
    const summary = await healthCheckService.getHealthSummary();

    expect(summary.total).toBeGreaterThan(0);
    expect(summary.healthy + summary.unhealthy + summary.unknown).toBe(summary.total);
  });
});
```

## Output

After completing this skill, you should have:

- Automated health check service
- Scheduler for periodic checks
- Health check API endpoints
- Database recording of health history
- Status updates based on check results
- Comprehensive test coverage

## Verification

Test your health check system:

```bash
# Start the API server
pnpm -F api dev

# Test health endpoints
curl http://localhost:3000/api/v1/health/summary
curl http://localhost:3000/api/v1/health/history/<server-id>

# Trigger manual check
curl -X POST http://localhost:3000/api/v1/health/<server-id>/check

# Run tests
pnpm -F api test
```

## Example Interaction

**User**: "Implement health monitoring for MCP servers"

**Agent**:
1. Creates HealthCheckService with retry logic
2. Implements scheduler for periodic checks
3. Adds API endpoints for health data
4. Records health check history
5. Updates server status automatically
6. Writes comprehensive tests

**Expected Output**:
```
✅ HealthCheckService created
✅ HealthCheckScheduler created
✅ Health check routes added
✅ Scheduler initialized on startup
✅ Tests written (5 test cases)

Health Check Features:
- Automatic periodic checks (configurable via scheduler constructor)
- Retry logic with exponential backoff
- Timeout handling (10 second default)
- Status updates based on recent checks
- Health history tracking
- Summary statistics

API Endpoints:
- GET /api/v1/health/summary - Overall health summary
- GET /api/v1/health/history/:serverId - Health history
- POST /api/v1/health/:serverId/check - Manual check
- GET /api/v1/health/servers/:serverId - Current status

Test Results:
- ✓ should check server health
- ✓ should record health check results
- ✓ should update server status based on checks
- ✓ should get health history
- ✓ should get health summary

Coverage: 90%
```

## Best Practices

1. **Use timeouts** - Prevent hanging checks
2. **Implement retries** - Handle transient failures
3. **Add backoff** - Avoid overwhelming failing servers
4. **Record everything** - Keep history for analysis
5. **Update status intelligently** - Use multiple checks
6. **Log appropriately** - Track issues for debugging
7. **Monitor the monitor** - Health check the health checker
8. **Set reasonable intervals** - Balance freshness vs load
9. **Handle edge cases** - Network issues, timeouts, etc.
10. **Provide manual override** - Allow on-demand checks

## Configuration

```bash
# Health check settings
HEALTH_CHECK_INTERVAL=60000        # Check interval in ms
HEALTH_CHECK_TIMEOUT=10000         # Request timeout in ms
HEALTH_CHECK_RETRIES=3             # Number of retries
HEALTH_CHECK_BACKOFF=1000          # Initial backoff in ms
```

## Next Steps

After implementing health checks:

1. Add alerting (webhooks, email, Slack)
2. Implement advanced metrics (uptime %, response time trends)
3. Add synthetic transactions (test actual functionality)
4. Create health dashboards
5. Set up incident response automation
