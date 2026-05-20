import { FastifyPluginAsyncZodV3 } from '../lib/type-provider.js';
import { z } from 'zod';
import { healthCheckService } from '../services/healthCheck.js';
import { db } from '../db/index.js';
import { servers } from '../db/schema.js';
import { eq, sql } from 'drizzle-orm';

export const healthRoutes: FastifyPluginAsyncZodV3 = async (fastify) => {
  // Basic health check
  fastify.get('/', {
    schema: {
      description: 'Basic health check',
      tags: ['health'],
      response: {
        200: z.object({
          status: z.literal('ok'),
          timestamp: z.string().datetime(),
          uptime: z.number(),
        }),
      },
    },
  }, async (_request, reply) => {
    return reply.send({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  // Readiness probe
  fastify.get('/ready', {
    schema: {
      description: 'Readiness probe',
      tags: ['health'],
      response: {
        200: z.object({ status: z.literal('ready') }),
        503: z.object({ status: z.literal('not ready'), error: z.string() }),
      },
    },
  }, async (_request, reply) => {
    try {
      await db.select({ n: sql<number>`1` }).from(servers).limit(1);
      return reply.send({ status: 'ready' });
    } catch {
      return reply.code(503).send({ status: 'not ready', error: 'Database unreachable' });
    }
  });

  // Liveness probe
  fastify.get('/live', {
    schema: {
      description: 'Liveness probe',
      tags: ['health'],
      response: {
        200: z.object({ status: z.literal('alive') }),
      },
    },
  }, async (_request, reply) => {
    return reply.send({ status: 'alive' });
  });

  // Health summary
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
    onRequest: [fastify.authenticate],
  }, async (_request, reply) => {
    const summary = await healthCheckService.getHealthSummary();
    return reply.send(summary);
  });

  // Health history for a server
  fastify.get('/history/:serverId', {
    schema: {
      description: 'Get health check history for a specific server',
      tags: ['health'],
      params: z.object({ serverId: z.string().uuid() }),
      querystring: z.object({
        limit: z.coerce.number().int().min(1).max(1000).default(100).optional(),
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
    const { limit } = request.query;
    const history = await healthCheckService.getHealthHistory(serverId, limit);
    return reply.send(history.map(h => ({
      ...h,
      statusCode: h.statusCode ?? undefined,
      errorMessage: h.errorMessage ?? undefined,
      checkedAt: h.checkedAt.toISOString(),
    })));
  });

  // Trigger manual health check
  fastify.post('/:serverId/check', {
    schema: {
      description: 'Trigger an immediate health check for a server',
      tags: ['health'],
      params: z.object({ serverId: z.string().uuid() }),
      response: {
        200: z.object({
          serverId: z.string().uuid(),
          status: z.enum(['healthy', 'unhealthy', 'timeout', 'error']),
          responseTimeMs: z.number(),
          statusCode: z.number().optional(),
          errorMessage: z.string().optional(),
          checkedAt: z.string().datetime(),
        }),
        404: z.object({ error: z.string() }),
      },
    },
    onRequest: [fastify.authenticate, fastify.requireAdmin],
  }, async (request, reply) => {
    const { serverId } = request.params;
    const result = await healthCheckService.checkServer(serverId);
    return reply.send({
      ...result,
      statusCode: result.statusCode ?? undefined,
      errorMessage: result.errorMessage ?? undefined,
      checkedAt: result.checkedAt.toISOString(),
    });
  });

  // Server health status
  fastify.get('/servers/:serverId', {
    schema: {
      description: 'Get current health status for a server',
      tags: ['health'],
      params: z.object({ serverId: z.string().uuid() }),
      response: {
        200: z.object({
          serverId: z.string().uuid(),
          status: z.enum(['healthy', 'unhealthy', 'unknown']),
          lastHealthCheck: z.string().datetime().nullable(),
          healthCheckInterval: z.number(),
          nextCheckDue: z.string().datetime().nullable(),
        }),
        404: z.object({ error: z.string() }),
      },
    },
  }, async (request, reply) => {
    const { serverId } = request.params;

    const [server] = await db
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
      lastHealthCheck: server.lastHealthCheck?.toISOString() ?? null,
      healthCheckInterval: server.healthCheckInterval,
      nextCheckDue: nextCheckDue?.toISOString() ?? null,
    });
  });
};
