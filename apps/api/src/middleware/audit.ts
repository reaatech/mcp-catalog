import { FastifyPluginAsync } from 'fastify';
import { db } from '../db/index.js';
import { auditLogs } from '../db/schema.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function pickResourceId(params: Record<string, unknown>): string | null {
  for (const key of ['id', 'serverId', 'capabilityId', 'toolId', 'resourceId']) {
    const value = params[key];
    if (typeof value === 'string' && UUID_RE.test(value)) return value;
  }
  return null;
}

export const auditPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('onResponse', async (request, reply) => {
    // Skip health checks and documentation
    if (request.url.startsWith('/health') || request.url.startsWith('/documentation')) {
      return;
    }

    // Only audit state-changing methods
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
      return;
    }

    try {
      const userId = request.user?.id ?? null;
      const action = `${request.routerMethod?.toLowerCase() || request.method.toLowerCase()}.${request.url.split('?')[0].split('/').pop() || 'unknown'}`;
      const params = (request.params as Record<string, unknown>) ?? {};

      await db.insert(auditLogs).values({
        userId,
        action,
        resourceType: request.url.split('/')[3] || 'unknown',
        resourceId: pickResourceId(params),
        details: {
          method: request.method,
          url: request.url,
          statusCode: reply.statusCode,
        },
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'] || null,
      });
    } catch (err) {
      fastify.log.warn(err, 'Failed to write audit log');
    }
  });
};
