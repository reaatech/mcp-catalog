import { z } from 'zod';

export const serverStatusSchema = z.enum(['healthy', 'unhealthy', 'unknown']);
export const userRoleSchema = z.enum(['admin', 'developer', 'viewer']);
export const healthCheckStatusSchema = z.enum(['healthy', 'unhealthy', 'timeout', 'error']);
export const permissionSchema = z.enum(['discover', 'view_details', 'execute']);

export const createServerSchema = z.object({
  name: z.string().min(1).max(255),
  url: z.string().url(),
  description: z.string().max(1000).optional(),
  healthEndpoint: z.string().url().optional(),
  healthCheckInterval: z.number().int().min(10).max(3600).default(60),
  metadata: z.record(z.unknown()).optional(),
});

export const updateServerSchema = createServerSchema.partial();

export const createCapabilitySchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  category: z.string().min(1).max(100),
  tags: z.array(z.string()).default([]),
  schema: z.record(z.unknown()).optional(),
});

export const createToolSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  inputSchema: z.record(z.unknown()),
  outputSchema: z.record(z.unknown()).optional(),
});

export const createResourceSchema = z.object({
  uri: z.string().min(1).max(2048),
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  mimeType: z.string().max(100).optional(),
  schema: z.record(z.unknown()).optional(),
});

export const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(255),
  role: userRoleSchema.default('viewer'),
});

export const createApiKeySchema = z.object({
  name: z.string().min(1).max(255),
  permissions: z.record(z.unknown()).optional(),
  expiresAt: z.string().datetime().optional(),
});

export const searchQuerySchema = z.object({
  q: z.string().min(1).max(500),
  categories: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  status: serverStatusSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  sortBy: z.enum(['relevance', 'name', 'registered_at']).default('relevance'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export type CreateServerInput = z.infer<typeof createServerSchema>;
export type UpdateServerInput = z.infer<typeof updateServerSchema>;
export type CreateCapabilityInput = z.infer<typeof createCapabilitySchema>;
export type CreateToolInput = z.infer<typeof createToolSchema>;
export type CreateResourceInput = z.infer<typeof createResourceSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type CreateApiKeyInput = z.infer<typeof createApiKeySchema>;
export type SearchQuery = z.infer<typeof searchQuerySchema>;
export type LoginInput = z.infer<typeof loginSchema>;
