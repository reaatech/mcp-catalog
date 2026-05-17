import Fastify, { type FastifyRequest, type FastifyReply } from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';

delete (helmet as unknown as Record<symbol, { fastify?: string }>)[Symbol.for('plugin-meta')]?.fastify;
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { serializerCompiler, validatorCompiler, ZodTypeProvider } from 'fastify-type-provider-zod';
import { env } from './config.js';
import { db } from './db/index.js';
import { users, apiKeys } from './db/schema.js';
import { eq, gte, isNull, or, and } from 'drizzle-orm';
import { verifyToken, verifyApiKey, apiKeyPrefix } from './utils/auth.js';
import { auditPlugin } from './middleware/audit.js';
import { healthRoutes } from './routes/health.js';
import { authRoutes } from './routes/auth.js';
import { serverRoutes } from './routes/servers.js';
import { capabilityRoutes } from './routes/capabilities.js';
import { searchRoutes } from './routes/search.js';
import { adminRoutes } from './routes/admin.js';

  declare module 'fastify' {
    interface FastifyRequest {
      user?: {
        id: string;
        email: string;
        name: string;
        role: string;
      };
    }

    interface FastifyInstance {
      authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
      requireAdmin: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    }
  }

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
      ...(env.LOG_FORMAT === 'pretty' && env.NODE_ENV !== 'production' ? {
        transport: { target: 'pino-pretty', options: { colorize: true } },
      } : {}),
    },
    trustProxy: env.TRUST_PROXY === 'true'
      ? true
      : env.TRUST_PROXY === 'false'
        ? false
        : env.TRUST_PROXY.split(',').map((ip: string) => ip.trim()),
  }).withTypeProvider<ZodTypeProvider>();

  // Add Zod type provider
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  // Register plugins
  await app.register(cookie, {
    secret: env.COOKIE_SECRET || env.JWT_SECRET,
    parseOptions: {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/api/v1/auth',
      ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
    },
  });

  await app.register(cors, {
    origin: env.CORS_ORIGIN,
    credentials: true,
  });

  await app.register(helmet, {
    contentSecurityPolicy: env.NODE_ENV === 'production'
      ? true
      : {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", 'data:'],
          },
        },
  });

  await app.register(rateLimit, {
    max: env.RATE_LIMIT_MAX,
    timeWindow: env.RATE_LIMIT_WINDOW,
    keyGenerator: (request) => {
      return `${request.ip}:${request.routeOptions.url || request.url}`;
    },
  });

  await app.register(swagger, {
    openapi: {
      info: {
        title: 'MCP Catalog API',
        description: 'Registry server for MCP server discovery',
        version: '1.0.0',
      },
      servers: [
        { url: 'http://localhost:3000', description: 'Development server' },
      ],
      tags: [
        { name: 'health', description: 'Health check endpoints' },
        { name: 'auth', description: 'Authentication endpoints' },
        { name: 'servers', description: 'Server management endpoints' },
        { name: 'capabilities', description: 'Capability management endpoints' },
        { name: 'search', description: 'Search endpoints' },
        { name: 'admin', description: 'Admin endpoints' },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
          apiKey: {
            type: 'apiKey',
            in: 'header',
            name: 'X-API-Key',
          },
        },
      },
    },
  });

  await app.register(swaggerUi, {
    routePrefix: '/documentation',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: false,
    },
    ...(env.NODE_ENV === 'production' ? {
      uiHooks: {
        onRequest: async (request, reply) => {
          const authHeader = request.headers.authorization;
          if (!authHeader?.startsWith('Bearer ')) {
            return reply.code(401).send({ error: 'Authentication required for API docs' });
          }
          try {
            verifyToken(authHeader.slice(7));
          } catch {
            return reply.code(401).send({ error: 'Invalid authentication' });
          }
        },
      },
    } : {}),
  });

  // Auth decorators (must be before routes)
  app.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = request.headers.authorization;
    const apiKeyHeader = request.headers['x-api-key'] as string | undefined;

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      try {
        const payload = verifyToken(token);
        const [user] = await db.select().from(users).where(eq(users.id, payload.userId)).limit(1);
        if (!user) {
          return reply.code(401).send({ error: 'Invalid token' });
        }
        request.user = {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
        return;
      } catch {
        return reply.code(401).send({ error: 'Invalid token' });
      }
    }

    if (apiKeyHeader) {
      const now = new Date();
      const prefix = apiKeyPrefix(apiKeyHeader);
      const candidateKeys = await db
        .select()
        .from(apiKeys)
        .where(
          and(
            eq(apiKeys.keyPrefix, prefix),
            or(
              gte(apiKeys.expiresAt, now),
              isNull(apiKeys.expiresAt)
            )
          )
        )
        .limit(10);

      for (const record of candidateKeys) {
        if (await verifyApiKey(apiKeyHeader, record.keyHash)) {
          await db
            .update(apiKeys)
            .set({ lastUsedAt: new Date() })
            .where(eq(apiKeys.id, record.id));

          const [user] = await db.select().from(users).where(eq(users.id, record.userId)).limit(1);
          if (user) {
            request.user = {
              id: user.id,
              email: user.email,
              name: user.name,
              role: user.role,
            };
            return;
          }
        }
      }

      return reply.code(401).send({ error: 'Invalid API key' });
    }

    return reply.code(401).send({ error: 'Authentication required' });
  });

  app.decorate('requireAdmin', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user) {
      return reply.code(401).send({ error: 'Authentication required' });
    }
    if (request.user.role !== 'admin') {
      return reply.code(403).send({ error: 'Admin access required' });
    }
  });



  // Audit plugin
  await app.register(auditPlugin);

  // Register routes
  await app.register(healthRoutes, { prefix: '/health' });
  await app.register(authRoutes, { prefix: '/api/v1/auth' });
  await app.register(serverRoutes, { prefix: '/api/v1/servers' });
  await app.register(capabilityRoutes, { prefix: '/api/v1/capabilities' });
  await app.register(searchRoutes, { prefix: '/api/v1/search' });
  await app.register(adminRoutes, { prefix: '/api/v1/admin' });

  return app;
}
