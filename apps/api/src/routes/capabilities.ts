import { FastifyPluginAsyncZodV3 } from '../lib/type-provider.js';
import { z } from 'zod';
import { db } from '../db/index.js';
import { servers, capabilities, tools, resources } from '../db/schema.js';
import { eq, sql } from 'drizzle-orm';

export const capabilityRoutes: FastifyPluginAsyncZodV3 = async (fastify) => {
  // List capabilities
  fastify.get('/', {
    schema: {
      description: 'List all capabilities',
      tags: ['capabilities'],
      querystring: z.object({
        serverId: z.string().uuid().optional(),
        category: z.string().optional(),
        limit: z.coerce.number().int().min(1).max(100).default(20),
        offset: z.coerce.number().int().min(0).default(0),
      }),
      response: {
        200: z.object({
          data: z.array(z.object({
            id: z.string().uuid(),
            serverId: z.string().uuid(),
            name: z.string(),
            description: z.string().nullable(),
            category: z.string(),
            tags: z.array(z.string()),
            createdAt: z.string().datetime(),
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
    const { serverId, category, limit, offset } = request.query;

    const conditions = [];
    if (serverId) conditions.push(eq(capabilities.serverId, serverId));
    if (category) conditions.push(eq(capabilities.category, category));

    const whereClause = conditions.length > 0 ? sql.join(conditions, sql` AND `) : undefined;

    const [data, totalResult] = await Promise.all([
      db.select().from(capabilities).where(whereClause).limit(limit).offset(offset).orderBy(capabilities.createdAt),
      db.select({ count: sql<number>`count(*)` }).from(capabilities).where(whereClause),
    ]);

    const total = Number(totalResult[0]?.count || 0);

    return reply.send({
      data: data.map(c => ({
        ...c,
        description: c.description ?? null,
        createdAt: c.createdAt.toISOString(),
      })),
      pagination: { limit, offset, total, hasMore: offset + data.length < total },
    });
  });

  // Get capability by ID
  fastify.get('/:id', {
    schema: {
      description: 'Get capability details',
      tags: ['capabilities'],
      params: z.object({ id: z.string().uuid() }),
      response: {
        200: z.object({
          id: z.string().uuid(),
          serverId: z.string().uuid(),
          name: z.string(),
          description: z.string().nullable(),
          category: z.string(),
          tags: z.array(z.string()),
          schema: z.record(z.unknown()).nullable(),
          createdAt: z.string().datetime(),
          tools: z.array(z.object({
            id: z.string().uuid(),
            name: z.string(),
            description: z.string().nullable(),
            inputSchema: z.record(z.unknown()),
          })).optional(),
          resources: z.array(z.object({
            id: z.string().uuid(),
            uri: z.string(),
            name: z.string(),
            description: z.string().nullable(),
            mimeType: z.string().nullable(),
          })).optional(),
        }),
        404: z.object({ error: z.string() }),
      },
    },
  }, async (request, reply) => {
    const { id } = request.params;

    const [cap] = await db.select().from(capabilities).where(eq(capabilities.id, id)).limit(1);
    if (!cap) {
      return reply.code(404).send({ error: 'Capability not found' });
    }

    const toolList = await db.select().from(tools).where(eq(tools.capabilityId, id));
    const resourceList = await db.select().from(resources).where(eq(resources.capabilityId, id));

    return reply.send({
      ...cap,
      description: cap.description ?? null,
      schema: (cap.schema as Record<string, unknown>) ?? null,
      createdAt: cap.createdAt.toISOString(),
      tools: toolList.map(t => ({
        id: t.id,
        name: t.name,
        description: t.description ?? null,
        inputSchema: t.inputSchema as Record<string, unknown>,
      })),
      resources: resourceList.map(r => ({
        id: r.id,
        uri: r.uri,
        name: r.name,
        description: r.description ?? null,
        mimeType: r.mimeType ?? null,
      })),
    });
  });

  // Add capability to server
  fastify.post('/', {
    schema: {
      description: 'Add a capability',
      tags: ['capabilities'],
      body: z.object({
        serverId: z.string().uuid(),
        name: z.string().min(1).max(255),
        description: z.string().max(1000).optional(),
        category: z.string().min(1).max(100),
        tags: z.array(z.string()).default([]),
        schema: z.record(z.unknown()).optional(),
      }),
      response: {
        201: z.object({
          id: z.string().uuid(),
          serverId: z.string().uuid(),
          name: z.string(),
          category: z.string(),
          createdAt: z.string().datetime(),
        }),
        404: z.object({ error: z.string() }),
        409: z.object({ error: z.string() }),
      },
    },
    onRequest: [fastify.authenticate],
  }, async (request, reply) => {
    const { serverId } = request.body;

    // Verify server exists
    const [server] = await db.select().from(servers).where(eq(servers.id, serverId)).limit(1);
    if (!server) {
      return reply.code(404).send({ error: 'Server not found' });
    }

    try {
      const [cap] = await db.insert(capabilities).values(request.body).returning();

      return reply.code(201).send({
        id: cap.id,
        serverId: cap.serverId,
        name: cap.name,
        category: cap.category,
        createdAt: cap.createdAt.toISOString(),
      });
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === '23505') {
        return reply.code(409).send({ error: 'Capability already exists for this server' });
      }
      throw error;
    }
  });

  // Update capability
  fastify.put('/:id', {
    schema: {
      description: 'Update a capability',
      tags: ['capabilities'],
      params: z.object({ id: z.string().uuid() }),
      body: z.object({
        name: z.string().min(1).max(255).optional(),
        description: z.string().max(1000).optional(),
        category: z.string().min(1).max(100).optional(),
        tags: z.array(z.string()).optional(),
        schema: z.record(z.unknown()).optional(),
      }),
      response: {
        200: z.object({
          id: z.string().uuid(),
          name: z.string(),
          category: z.string(),
        }),
        401: z.object({ error: z.string() }),
        403: z.object({ error: z.string() }),
        404: z.object({ error: z.string() }),
      },
    },
    onRequest: [fastify.authenticate],
  }, async (request, reply) => {
    const { id } = request.params;

    const [existing] = await db.select().from(capabilities).where(eq(capabilities.id, id)).limit(1);
    if (!existing) {
      return reply.code(404).send({ error: 'Capability not found' });
    }
    const user = request.user;
    if (!user) {
      return reply.code(401).send({ error: 'Authentication required' });
    }
    const [parentServer] = await db.select().from(servers).where(eq(servers.id, existing.serverId)).limit(1);
    if (parentServer && parentServer.registeredBy !== user.id && user.role !== 'admin') {
      return reply.code(403).send({ error: 'Cannot modify another user\'s capability' });
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (request.body.name !== undefined) updateData.name = request.body.name;
    if (request.body.description !== undefined) updateData.description = request.body.description;
    if (request.body.category !== undefined) updateData.category = request.body.category;
    if (request.body.tags !== undefined) updateData.tags = request.body.tags;
    if (request.body.schema !== undefined) updateData.schema = request.body.schema;

    const [updated] = await db
      .update(capabilities)
      .set(updateData)
      .where(eq(capabilities.id, id))
      .returning();

    return reply.send({
      id: updated.id,
      name: updated.name,
      category: updated.category,
    });
  });

  // Delete capability
  fastify.delete('/:id', {
    schema: {
      description: 'Delete a capability',
      tags: ['capabilities'],
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

    const [existing] = await db.select().from(capabilities).where(eq(capabilities.id, id)).limit(1);
    if (!existing) {
      return reply.code(404).send({ error: 'Capability not found' });
    }
    const user = request.user;
    if (!user) {
      return reply.code(401).send({ error: 'Authentication required' });
    }
    const [parentServer] = await db.select().from(servers).where(eq(servers.id, existing.serverId)).limit(1);
    if (parentServer && parentServer.registeredBy !== user.id && user.role !== 'admin') {
      return reply.code(403).send({ error: 'Cannot delete another user\'s capability' });
    }

    await db.delete(capabilities).where(eq(capabilities.id, id));
    return reply.code(204).send();
  });

  // Add tool to capability
  fastify.post('/:id/tools', {
    schema: {
      description: 'Add a tool to a capability',
      tags: ['capabilities'],
      params: z.object({ id: z.string().uuid() }),
      body: z.object({
        name: z.string().min(1).max(255),
        description: z.string().max(1000).optional(),
        inputSchema: z.record(z.unknown()),
        outputSchema: z.record(z.unknown()).optional(),
      }),
      response: {
        201: z.object({
          id: z.string().uuid(),
          capabilityId: z.string().uuid(),
          name: z.string(),
          createdAt: z.string().datetime(),
        }),
        401: z.object({ error: z.string() }),
        403: z.object({ error: z.string() }),
        404: z.object({ error: z.string() }),
      },
    },
    onRequest: [fastify.authenticate],
  }, async (request, reply) => {
    const { id } = request.params;

    const toolUser = request.user;
    if (!toolUser) {
      return reply.code(401).send({ error: 'Authentication required' });
    }
    const [cap] = await db.select().from(capabilities).where(eq(capabilities.id, id)).limit(1);
    if (!cap) {
      return reply.code(404).send({ error: 'Capability not found' });
    }
    const [parentServer] = await db.select().from(servers).where(eq(servers.id, cap.serverId)).limit(1);
    if (parentServer && parentServer.registeredBy !== toolUser.id && toolUser.role !== 'admin') {
      return reply.code(403).send({ error: 'Cannot modify another user\'s capability' });
    }

    const [tool] = await db.insert(tools).values({ ...request.body, capabilityId: id }).returning();

    return reply.code(201).send({
      id: tool.id,
      capabilityId: tool.capabilityId,
      name: tool.name,
      createdAt: tool.createdAt.toISOString(),
    });
  });

  // Add resource to capability
  fastify.post('/:id/resources', {
    schema: {
      description: 'Add a resource to a capability',
      tags: ['capabilities'],
      params: z.object({ id: z.string().uuid() }),
      body: z.object({
        uri: z.string().min(1).max(2048),
        name: z.string().min(1).max(255),
        description: z.string().max(1000).optional(),
        mimeType: z.string().max(100).optional(),
        schema: z.record(z.unknown()).optional(),
      }),
      response: {
        201: z.object({
          id: z.string().uuid(),
          capabilityId: z.string().uuid(),
          name: z.string(),
          uri: z.string(),
          createdAt: z.string().datetime(),
        }),
        401: z.object({ error: z.string() }),
        403: z.object({ error: z.string() }),
        404: z.object({ error: z.string() }),
      },
    },
    onRequest: [fastify.authenticate],
  }, async (request, reply) => {
    const { id } = request.params;

    const resUser = request.user;
    if (!resUser) {
      return reply.code(401).send({ error: 'Authentication required' });
    }
    const [cap] = await db.select().from(capabilities).where(eq(capabilities.id, id)).limit(1);
    if (!cap) {
      return reply.code(404).send({ error: 'Capability not found' });
    }
    const [parentServer] = await db.select().from(servers).where(eq(servers.id, cap.serverId)).limit(1);
    if (parentServer && parentServer.registeredBy !== resUser.id && resUser.role !== 'admin') {
      return reply.code(403).send({ error: 'Cannot modify another user\'s capability' });
    }

    const [resource] = await db.insert(resources).values({ ...request.body, capabilityId: id }).returning();

    return reply.code(201).send({
      id: resource.id,
      capabilityId: resource.capabilityId,
      name: resource.name,
      uri: resource.uri,
      createdAt: resource.createdAt.toISOString(),
    });
  });
};
