import { FastifyPluginAsyncZodV3 } from '../lib/type-provider.js';
import { z } from 'zod';
import { db } from '../db/index.js';
import { users, accessPolicies, auditLogs } from '../db/schema.js';
import { eq, desc, sql } from 'drizzle-orm';
import { hashPassword, validatePasswordComplexity } from '../utils/auth.js';
import { env } from '../config.js';

export const adminRoutes: FastifyPluginAsyncZodV3 = async (fastify) => {
  // Users
  fastify.get('/users', {
    schema: {
      description: 'List all users',
      tags: ['admin'],
      querystring: z.object({
        limit: z.coerce.number().int().min(1).max(100).default(20),
        offset: z.coerce.number().int().min(0).default(0),
      }),
      response: {
        200: z.object({
          data: z.array(z.object({
            id: z.string().uuid(),
            email: z.string().email(),
            name: z.string(),
            role: z.enum(['admin', 'developer', 'viewer']),
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
    onRequest: [fastify.authenticate, fastify.requireAdmin],
  }, async (request, reply) => {
    const { limit, offset } = request.query;

    const [data, totalResult] = await Promise.all([
      db.select().from(users).limit(limit).offset(offset).orderBy(desc(users.createdAt)),
      db.select({ count: sql<number>`count(*)` }).from(users),
    ]);

    const total = Number(totalResult[0]?.count || 0);

    return reply.send({
      data: data.map(u => ({
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        createdAt: u.createdAt.toISOString(),
      })),
      pagination: { limit, offset, total, hasMore: offset + data.length < total },
    });
  });

  fastify.post('/users', {
    schema: {
      description: 'Create a new user',
      tags: ['admin'],
      body: z.object({
        email: z.string().email(),
        name: z.string().min(1).max(255),
        role: z.enum(['admin', 'developer', 'viewer']).default('viewer'),
        password: z.string().min(env.PASSWORD_MIN_LENGTH).max(256).refine(
          (pw) => validatePasswordComplexity(pw),
          { message: 'Password must contain at least one uppercase letter, one lowercase letter, one digit, and one special character' },
        ),
      }),
      response: {
        201: z.object({
          id: z.string().uuid(),
          email: z.string().email(),
          name: z.string(),
          role: z.enum(['admin', 'developer', 'viewer']),
          createdAt: z.string().datetime(),
        }),
        409: z.object({ error: z.string() }),
      },
    },
    onRequest: [fastify.authenticate, fastify.requireAdmin],
  }, async (request, reply) => {
    const { password, ...rest } = request.body;
    try {
      const passwordHash = await hashPassword(password);
      const [user] = await db.insert(users).values({ ...rest, passwordHash }).returning();
      return reply.code(201).send({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        createdAt: user.createdAt.toISOString(),
      });
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === '23505') {
        return reply.code(409).send({ error: 'Email already exists' });
      }
      throw error;
    }
  });

  fastify.delete('/users/:id', {
    schema: {
      description: 'Delete a user',
      tags: ['admin'],
      params: z.object({ id: z.string().uuid() }),
      response: {
        204: z.void(),
        401: z.object({ error: z.string() }),
        403: z.object({ error: z.string() }),
        404: z.object({ error: z.string() }),
      },
    },
    onRequest: [fastify.authenticate, fastify.requireAdmin],
  }, async (request, reply) => {
    const { id } = request.params;

    const user = request.user;
    if (!user) {
      return reply.code(401).send({ error: 'Authentication required' });
    }
    if (id === user.id) {
      return reply.code(403).send({ error: 'Cannot delete yourself' });
    }

    const adminCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(eq(users.role, 'admin'));

    const [targetUser] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    if (!targetUser) {
      return reply.code(404).send({ error: 'User not found' });
    }

    if (targetUser.role === 'admin' && Number(adminCount[0]?.count ?? 0) <= 1) {
      return reply.code(403).send({ error: 'Cannot delete the last admin user' });
    }

    await db.delete(users).where(eq(users.id, id));
    return reply.code(204).send();
  });

  // Access Policies
  fastify.get('/access-policies', {
    schema: {
      description: 'List access policies',
      tags: ['admin'],
      querystring: z.object({
        limit: z.coerce.number().int().min(1).max(100).default(20),
        offset: z.coerce.number().int().min(0).default(0),
      }),
      response: {
        200: z.object({
          data: z.array(z.object({
            id: z.string().uuid(),
            serverId: z.string().uuid().nullable(),
            capabilityId: z.string().uuid().nullable(),
            userId: z.string().uuid().nullable(),
            role: z.string().nullable(),
            teamId: z.string().nullable(),
            permission: z.enum(['discover', 'view_details', 'execute']),
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
    onRequest: [fastify.authenticate, fastify.requireAdmin],
  }, async (request, reply) => {
    const { limit, offset } = request.query;

    const [data, totalResult] = await Promise.all([
      db.select().from(accessPolicies).limit(limit).offset(offset).orderBy(desc(accessPolicies.createdAt)),
      db.select({ count: sql<number>`count(*)` }).from(accessPolicies),
    ]);

    const total = Number(totalResult[0]?.count || 0);

    return reply.send({
      data: data.map(p => ({
        id: p.id,
        serverId: p.serverId ?? null,
        capabilityId: p.capabilityId ?? null,
        userId: p.userId ?? null,
        role: p.role ?? null,
        teamId: p.teamId ?? null,
        permission: p.permission,
        createdAt: p.createdAt.toISOString(),
      })),
      pagination: { limit, offset, total, hasMore: offset + data.length < total },
    });
  });

  fastify.post('/access-policies', {
    schema: {
      description: 'Create access policy',
      tags: ['admin'],
      body: z.object({
        serverId: z.string().uuid().optional(),
        capabilityId: z.string().uuid().optional(),
        userId: z.string().uuid().optional(),
        role: z.string().optional(),
        teamId: z.string().optional(),
        permission: z.enum(['discover', 'view_details', 'execute']),
      }),
      response: {
        201: z.object({
          id: z.string().uuid(),
          permission: z.enum(['discover', 'view_details', 'execute']),
          createdAt: z.string().datetime(),
        }),
      },
    },
    onRequest: [fastify.authenticate, fastify.requireAdmin],
  }, async (request, reply) => {
    const [policy] = await db.insert(accessPolicies).values(request.body).returning();
    return reply.code(201).send({
      id: policy.id,
      permission: policy.permission,
      createdAt: policy.createdAt.toISOString(),
    });
  });

  fastify.delete('/access-policies/:id', {
    schema: {
      description: 'Delete access policy',
      tags: ['admin'],
      params: z.object({ id: z.string().uuid() }),
      response: {
        204: z.void(),
        404: z.object({ error: z.string() }),
      },
    },
    onRequest: [fastify.authenticate, fastify.requireAdmin],
  }, async (request, reply) => {
    const { id } = request.params;
    const result = await db.delete(accessPolicies).where(eq(accessPolicies.id, id)).returning();
    if (result.length === 0) {
      return reply.code(404).send({ error: 'Policy not found' });
    }
    return reply.code(204).send();
  });

  // Audit Logs
  fastify.get('/audit-logs', {
    schema: {
      description: 'View audit logs',
      tags: ['admin'],
      querystring: z.object({
        limit: z.coerce.number().int().min(1).max(1000).default(100),
        offset: z.coerce.number().int().min(0).default(0),
      }),
      response: {
        200: z.object({
          data: z.array(z.object({
            id: z.string().uuid(),
            userId: z.string().uuid().nullable(),
            action: z.string(),
            resourceType: z.string(),
            resourceId: z.string().uuid().nullable(),
            details: z.record(z.unknown()).nullable(),
            ipAddress: z.string().nullable(),
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
    onRequest: [fastify.authenticate, fastify.requireAdmin],
  }, async (request, reply) => {
    const { limit, offset } = request.query;

    const [data, totalResult] = await Promise.all([
      db.select().from(auditLogs).limit(limit).offset(offset).orderBy(desc(auditLogs.createdAt)),
      db.select({ count: sql<number>`count(*)` }).from(auditLogs),
    ]);

    const total = Number(totalResult[0]?.count || 0);

    return reply.send({
      data: data.map(log => ({
        id: log.id,
        userId: log.userId ?? null,
        action: log.action,
        resourceType: log.resourceType,
        resourceId: log.resourceId ?? null,
        details: (log.details as Record<string, unknown>) ?? null,
        ipAddress: log.ipAddress ?? null,
        createdAt: log.createdAt.toISOString(),
      })),
      pagination: { limit, offset, total, hasMore: offset + data.length < total },
    });
  });
};
