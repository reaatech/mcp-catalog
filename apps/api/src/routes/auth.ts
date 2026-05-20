import { FastifyPluginAsyncZodV3 } from '../lib/type-provider.js';
import type { FastifyRequest } from 'fastify';
import { z } from 'zod';
import { db } from '../db/index.js';
import { users, apiKeys } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { generateToken, createRefreshTokenFamily, rotateRefreshToken, revokeRefreshTokenFamily, verifyToken, generateApiKey, comparePassword } from '../utils/auth.js';
import { env } from '../config.js';

export const authRoutes: FastifyPluginAsyncZodV3 = async (fastify) => {
  // Login
  const cookieOpts = {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    path: '/api/v1/auth',
    ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
  };

  fastify.post('/login', {
    config: {
      rateLimit: {
        max: env.LOGIN_RATE_LIMIT_MAX,
        timeWindow: env.LOGIN_RATE_LIMIT_WINDOW,
        keyGenerator: (request: FastifyRequest) => `login:${request.ip}`,
      },
    },
    schema: {
      description: 'User login',
      tags: ['auth'],
      body: z.object({
        email: z.string().email(),
        password: z.string().min(env.PASSWORD_MIN_LENGTH),
      }),
      response: {
        200: z.object({
          token: z.string(),
          user: z.object({
            id: z.string().uuid(),
            email: z.string().email(),
            name: z.string(),
            role: z.enum(['admin', 'developer', 'viewer']),
          }),
        }),
        401: z.object({ error: z.string() }),
      },
    },
  }, async (request, reply) => {
    const { email, password } = request.body;

    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (!user) {
      return reply.code(401).send({ error: 'Invalid credentials' });
    }

    if (!user.passwordHash) {
      return reply.code(401).send({ error: 'Invalid credentials' });
    }

    const valid = await comparePassword(password, user.passwordHash);
    if (!valid) {
      return reply.code(401).send({ error: 'Invalid credentials' });
    }

    const token = generateToken(user);
    const { token: refreshToken } = await createRefreshTokenFamily(user.id);

    await db.update(users).set({ lastLoginAt: new Date(), updatedAt: new Date() }).where(eq(users.id, user.id));

    reply.setCookie('mcp_refresh_token', refreshToken, {
      ...cookieOpts,
      maxAge: 7 * 24 * 60 * 60,
    });

    return reply.send({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  });

  // Refresh token
  fastify.post('/refresh', {
    schema: {
      description: 'Refresh JWT token with rotation. Accepts refresh token via cookie or body.',
      tags: ['auth'],
      body: z.object({
        refreshToken: z.string().optional(),
      }),
      response: {
        200: z.object({ token: z.string() }),
        401: z.object({ error: z.string() }),
      },
    },
  }, async (request, reply) => {
    const refreshToken = request.cookies?.mcp_refresh_token || request.body?.refreshToken;
    if (!refreshToken) {
      return reply.code(401).send({ error: 'Refresh token required' });
    }

    try {
      const payload = verifyToken(refreshToken, 'refresh');
      const [user] = await db.select().from(users).where(eq(users.id, payload.userId)).limit(1);
      if (!user) {
        return reply.code(401).send({ error: 'Invalid refresh token' });
      }

      const familyId = payload.family;
      if (!familyId) {
        return reply.code(401).send({ error: 'Invalid refresh token' });
      }

      const rotated = await rotateRefreshToken(user.id, familyId);
      if (!rotated) {
        await revokeRefreshTokenFamily(familyId);
        return reply.code(401).send({ error: 'Refresh token reuse detected; all tokens revoked' });
      }

      reply.setCookie('mcp_refresh_token', rotated.token, {
        ...cookieOpts,
        maxAge: 7 * 24 * 60 * 60,
      });

      const token = generateToken(user);
      return reply.send({ token });
    } catch {
      return reply.code(401).send({ error: 'Invalid refresh token' });
    }
  });

  // Logout
  fastify.post('/logout', {
    schema: {
      description: 'Clear refresh token cookie',
      tags: ['auth'],
      response: {
        204: z.void(),
      },
    },
  }, async (_request, reply) => {
    reply.clearCookie('mcp_refresh_token', { path: '/api/v1/auth' });
    return reply.code(204).send();
  });

  // Create API key (for the authenticated caller)
  fastify.post('/api-keys', {
    schema: {
      description: 'Create a new API key for the authenticated user',
      tags: ['auth'],
      body: z.object({
        name: z.string().min(1).max(255),
        permissions: z.record(z.unknown()).optional(),
        expiresAt: z.string().datetime().optional(),
      }),
      response: {
        201: z.object({
          id: z.string().uuid(),
          name: z.string(),
          key: z.string(),
          createdAt: z.string().datetime(),
        }),
        401: z.object({ error: z.string() }),
      },
    },
    onRequest: [fastify.authenticate],
  }, async (request, reply) => {
    const user = request.user;
    if (!user) {
      return reply.code(401).send({ error: 'Authentication required' });
    }
    const { name, permissions, expiresAt } = request.body;
    const { key, prefix, hash } = await generateApiKey();

    const [created] = await db.insert(apiKeys).values({
      userId: user.id,
      keyPrefix: prefix,
      keyHash: hash,
      name,
      permissions: permissions ?? {},
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    }).returning();

    return reply.code(201).send({
      id: created.id,
      name: created.name,
      key, // Plain key returned once; clients must store it
      createdAt: created.createdAt.toISOString(),
    });
  });

  // Revoke API key (owner or admin)
  fastify.delete('/api-keys/:id', {
    schema: {
      description: 'Revoke an API key owned by the caller (admins may revoke any key)',
      tags: ['auth'],
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
    const [existing] = await db.select().from(apiKeys).where(eq(apiKeys.id, id)).limit(1);
    if (!existing) {
      return reply.code(404).send({ error: 'API key not found' });
    }
    const user = request.user;
    if (!user) {
      return reply.code(401).send({ error: 'Authentication required' });
    }
    if (existing.userId !== user.id && user.role !== 'admin') {
      return reply.code(403).send({ error: 'Cannot revoke another user\'s API key' });
    }
    await db.delete(apiKeys).where(eq(apiKeys.id, id));
    return reply.code(204).send();
  });
};
