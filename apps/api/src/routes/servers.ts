import { FastifyPluginAsyncZodV3 } from '../lib/type-provider.js';
import { z } from 'zod';
import { db } from '../db/index.js';
import { servers, capabilities } from '../db/schema.js';
import { eq, sql } from 'drizzle-orm';

export const serverRoutes: FastifyPluginAsyncZodV3 = async (fastify) => {
  // List servers
  fastify.get('/', {
    schema: {
      description: 'List all servers with filtering and pagination',
      tags: ['servers'],
      querystring: z.object({
        status: z.enum(['healthy', 'unhealthy', 'unknown']).optional(),
        search: z.string().optional(),
        limit: z.coerce.number().int().min(1).max(100).default(20),
        offset: z.coerce.number().int().min(0).default(0),
      }),
      response: {
        200: z.object({
          data: z.array(z.object({
            id: z.string().uuid(),
            name: z.string(),
            description: z.string().nullable(),
            url: z.string(),
            status: z.enum(['healthy', 'unhealthy', 'unknown']),
            registeredAt: z.string().datetime(),
          })),
          pagination: z.object({
            limit: z.number(),
            offset: z.number(),
            total: z.number(),
            hasMore: z.boolean(),
          }),
        }),
      },
    },
  }, async (request, reply) => {
    const { status, search, limit, offset } = request.query;

    const conditions = [];
    if (status) conditions.push(eq(servers.status, status));
    if (search) {
      conditions.push(
        sql`${servers.name} ILIKE ${`%${search}%`} OR ${servers.description} ILIKE ${`%${search}%`}`
      );
    }

    const whereClause = conditions.length > 0 ? sql.join(conditions, sql` AND `) : undefined;

    const [data, totalResult] = await Promise.all([
      db
        .select({
          id: servers.id,
          name: servers.name,
          description: servers.description,
          url: servers.url,
          status: servers.status,
          registeredAt: servers.registeredAt,
        })
        .from(servers)
        .where(whereClause)
        .limit(limit)
        .offset(offset)
        .orderBy(servers.registeredAt),
      db
        .select({ count: sql<number>`count(*)` })
        .from(servers)
        .where(whereClause),
    ]);

    const total = Number(totalResult[0]?.count || 0);

    return reply.send({
      data: data.map(s => ({
        ...s,
        registeredAt: s.registeredAt.toISOString(),
      })),
      pagination: {
        limit,
        offset,
        total,
        hasMore: offset + data.length < total,
      },
    });
  });

  // Get server by ID
  fastify.get('/:id', {
    schema: {
      description: 'Get server details by ID',
      tags: ['servers'],
      params: z.object({ id: z.string().uuid() }),
      response: {
        200: z.object({
          id: z.string().uuid(),
          name: z.string(),
          description: z.string().nullable(),
          url: z.string(),
          healthEndpoint: z.string().nullable(),
          status: z.enum(['healthy', 'unhealthy', 'unknown']),
          lastHealthCheck: z.string().datetime().nullable(),
          healthCheckInterval: z.number(),
          registeredAt: z.string().datetime(),
          updatedAt: z.string().datetime(),
          metadata: z.record(z.unknown()).nullable(),
          capabilities: z.array(z.object({
            id: z.string().uuid(),
            name: z.string(),
            description: z.string().nullable(),
            category: z.string(),
            tags: z.array(z.string()),
          })).optional(),
        }),
        404: z.object({ error: z.string() }),
      },
    },
  }, async (request, reply) => {
    const { id } = request.params;

    const [server] = await db.select().from(servers).where(eq(servers.id, id)).limit(1);
    if (!server) {
      return reply.code(404).send({ error: 'Server not found' });
    }

    const caps = await db
      .select()
      .from(capabilities)
      .where(eq(capabilities.serverId, id));

    return reply.send({
      id: server.id,
      name: server.name,
      url: server.url,
      description: server.description ?? null,
      healthEndpoint: server.healthEndpoint ?? null,
      status: server.status,
      healthCheckInterval: server.healthCheckInterval,
      metadata: (server.metadata as Record<string, unknown>) ?? null,
      lastHealthCheck: server.lastHealthCheck?.toISOString() ?? null,
      registeredAt: server.registeredAt.toISOString(),
      updatedAt: server.updatedAt.toISOString(),
      capabilities: caps.map(c => ({
        id: c.id,
        name: c.name,
        description: c.description ?? null,
        category: c.category,
        tags: c.tags,
      })),
    });
  });

  // Register server
  fastify.post('/', {
    schema: {
      description: 'Register a new MCP server',
      tags: ['servers'],
      body: z.object({
        name: z.string().min(1).max(255),
        url: z.string().url(),
        description: z.string().max(1000).optional(),
        healthEndpoint: z.string().url().optional(),
        healthCheckInterval: z.number().int().min(10).max(3600).default(60),
        metadata: z.record(z.unknown()).optional(),
      }),
      response: {
        201: z.object({
          id: z.string().uuid(),
          name: z.string(),
          url: z.string(),
          status: z.enum(['healthy', 'unhealthy', 'unknown']),
          registeredAt: z.string().datetime(),
        }),
        401: z.object({ error: z.string() }),
        409: z.object({ error: z.string() }),
      },
    },
    onRequest: [fastify.authenticate],
  }, async (request, reply) => {
    const user = request.user;
    if (!user) {
      return reply.code(401).send({ error: 'Authentication required' });
    }

    try {
      const [server] = await db
        .insert(servers)
        .values({
          ...request.body,
          status: 'unknown',
          registeredBy: user.id,
        })
        .returning();

      return reply.code(201).send({
        id: server.id,
        name: server.name,
        url: server.url,
        status: server.status,
        registeredAt: server.registeredAt.toISOString(),
      });
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === '23505') {
        return reply.code(409).send({ error: 'Server name already exists' });
      }
      throw error;
    }
  });

  // Update server
  fastify.put('/:id', {
    schema: {
      description: 'Update server information',
      tags: ['servers'],
      params: z.object({ id: z.string().uuid() }),
      body: z.object({
        name: z.string().min(1).max(255).optional(),
        url: z.string().url().optional(),
        description: z.string().max(1000).optional(),
        healthEndpoint: z.string().url().optional(),
        healthCheckInterval: z.number().int().min(10).max(3600).optional(),
        metadata: z.record(z.unknown()).optional(),
      }),
      response: {
        200: z.object({
          id: z.string().uuid(),
          name: z.string(),
          url: z.string(),
          status: z.enum(['healthy', 'unhealthy', 'unknown']),
          updatedAt: z.string().datetime(),
        }),
        401: z.object({ error: z.string() }),
        403: z.object({ error: z.string() }),
        404: z.object({ error: z.string() }),
      },
    },
    onRequest: [fastify.authenticate],
  }, async (request, reply) => {
    const { id } = request.params;

    const [existing] = await db.select().from(servers).where(eq(servers.id, id)).limit(1);
    if (!existing) {
      return reply.code(404).send({ error: 'Server not found' });
    }
    const user = request.user;
    if (!user) {
      return reply.code(401).send({ error: 'Authentication required' });
    }
    if (existing.registeredBy !== user.id && user.role !== 'admin') {
      return reply.code(403).send({ error: 'Cannot modify another user\'s server' });
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (request.body.name !== undefined) updateData.name = request.body.name;
    if (request.body.url !== undefined) updateData.url = request.body.url;
    if (request.body.description !== undefined) updateData.description = request.body.description;
    if (request.body.healthEndpoint !== undefined) updateData.healthEndpoint = request.body.healthEndpoint;
    if (request.body.healthCheckInterval !== undefined) updateData.healthCheckInterval = request.body.healthCheckInterval;
    if (request.body.metadata !== undefined) updateData.metadata = request.body.metadata;

    const [updated] = await db
      .update(servers)
      .set(updateData)
      .where(eq(servers.id, id))
      .returning();

    return reply.send({
      id: updated.id,
      name: updated.name,
      url: updated.url,
      status: updated.status,
      updatedAt: updated.updatedAt.toISOString(),
    });
  });

  // Delete server
  fastify.delete('/:id', {
    schema: {
      description: 'Unregister a server',
      tags: ['servers'],
      params: z.object({ id: z.string().uuid() }),
      response: {
        204: z.void(),
        401: z.object({ error: z.string() }),
        403: z.object({ error: z.string() }),
        404: z.object({ error: z.string() }),
      },
    },
    onRequest: [fastify.authenticate],
  }, async (request, reply) => {
    const { id } = request.params;

    const [existing] = await db.select().from(servers).where(eq(servers.id, id)).limit(1);
    if (!existing) {
      return reply.code(404).send({ error: 'Server not found' });
    }
    const user = request.user;
    if (!user) {
      return reply.code(401).send({ error: 'Authentication required' });
    }
    if (existing.registeredBy !== user.id && user.role !== 'admin') {
      return reply.code(403).send({ error: 'Cannot delete another user\'s server' });
    }

    await db.delete(servers).where(eq(servers.id, id));
    return reply.code(204).send();
  });
};
