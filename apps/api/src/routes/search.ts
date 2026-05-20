import { FastifyPluginAsyncZodV3 } from '../lib/type-provider.js';
import { z } from 'zod';
import { db } from '../db/index.js';
import { servers, capabilities } from '../db/schema.js';
import { sql, eq, or, desc } from 'drizzle-orm';

export const searchRoutes: FastifyPluginAsyncZodV3 = async (fastify) => {
  fastify.get('/', {
    schema: {
      description: 'Search across servers, capabilities, and tools',
      tags: ['search'],
      querystring: z.object({
        q: z.string().min(1).max(500),
        category: z.string().optional(),
        tags: z.string().or(z.array(z.string())).optional(),
        status: z.enum(['healthy', 'unhealthy', 'unknown']).optional(),
        limit: z.coerce.number().int().min(1).max(100).default(20),
        offset: z.coerce.number().int().min(0).default(0),
      }),
      response: {
        200: z.object({
          servers: z.array(z.object({
            id: z.string().uuid(),
            name: z.string(),
            description: z.string().nullable(),
            url: z.string(),
            status: z.enum(['healthy', 'unhealthy', 'unknown']),
            registeredAt: z.string().datetime(),
          })),
          capabilities: z.array(z.object({
            id: z.string().uuid(),
            serverId: z.string().uuid(),
            name: z.string(),
            description: z.string().nullable(),
            category: z.string(),
            tags: z.array(z.string()),
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
    const { q, category, tags, status, limit, offset } = request.query;
    const searchPattern = `%${q}%`;

    // Search servers
    const serverConditions = [
      or(
        sql`${servers.name} ILIKE ${searchPattern}`,
        sql`${servers.description} ILIKE ${searchPattern}`
      ),
    ];
    if (status) serverConditions.push(eq(servers.status, status));

    const serverResults = await db
      .select({
        id: servers.id,
        name: servers.name,
        description: servers.description,
        url: servers.url,
        status: servers.status,
        registeredAt: servers.registeredAt,
      })
      .from(servers)
      .where(sql.join(serverConditions, sql` AND `))
      .limit(limit)
      .offset(offset)
      .orderBy(desc(servers.registeredAt));

    // Search capabilities
    const capConditions = [
      or(
        sql`${capabilities.name} ILIKE ${searchPattern}`,
        sql`${capabilities.description} ILIKE ${searchPattern}`
      ),
    ];
    if (category) capConditions.push(eq(capabilities.category, category));
    if (tags) {
      const tagList = (Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim()));
      capConditions.push(sql`${capabilities.tags} && ARRAY[${sql.join(tagList.map(t => sql`${t}`), sql`, `)}]`);
    }

    const capResults = await db
      .select()
      .from(capabilities)
      .where(sql.join(capConditions, sql` AND `))
      .limit(limit)
      .offset(offset)
      .orderBy(desc(capabilities.createdAt));

    const totalServers = await db
      .select({ count: sql<number>`count(*)` })
      .from(servers)
      .where(sql.join(serverConditions, sql` AND `));

    const totalCapabilities = await db
      .select({ count: sql<number>`count(*)` })
      .from(capabilities)
      .where(sql.join(capConditions, sql` AND `));

    const totalServersCount = Number(totalServers[0]?.count || 0);
    const totalCapCount = Number(totalCapabilities[0]?.count || 0);

    return reply.send({
      servers: serverResults.map(s => ({
        ...s,
        description: s.description ?? null,
        registeredAt: s.registeredAt.toISOString(),
      })),
      capabilities: capResults.map(c => ({
        ...c,
        description: c.description ?? null,
      })),
      pagination: {
        limit,
        offset,
        total: totalServersCount + totalCapCount,
        hasMore: offset + serverResults.length < totalServersCount + totalCapCount,
      },
    });
  });
};
