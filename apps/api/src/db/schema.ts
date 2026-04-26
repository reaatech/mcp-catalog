import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  integer,
  jsonb,
  pgEnum,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const serverStatusEnum = pgEnum('server_status', ['healthy', 'unhealthy', 'unknown']);
export const userRoleEnum = pgEnum('user_role', ['admin', 'developer', 'viewer']);
export const healthCheckStatusEnum = pgEnum('health_check_status', ['healthy', 'unhealthy', 'timeout', 'error']);
export const permissionEnum = pgEnum('permission', ['discover', 'view_details', 'execute']);

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  passwordHash: varchar('password_hash', { length: 255 }),
  role: userRoleEnum('role').notNull().default('viewer'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  lastLoginAt: timestamp('last_login_at'),
});

export const servers = pgTable('servers', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull().unique(),
  description: text('description'),
  url: varchar('url', { length: 2048 }).notNull(),
  healthEndpoint: varchar('health_endpoint', { length: 2048 }),
  status: serverStatusEnum('status').notNull().default('unknown'),
  lastHealthCheck: timestamp('last_health_check'),
  healthCheckInterval: integer('health_check_interval').notNull().default(60),
  registeredAt: timestamp('registered_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  registeredBy: uuid('registered_by').references(() => users.id, { onDelete: 'set null' }),
  metadata: jsonb('metadata'),
});

export const capabilities = pgTable('capabilities', {
  id: uuid('id').primaryKey().defaultRandom(),
  serverId: uuid('server_id').notNull().references(() => servers.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  category: varchar('category', { length: 100 }).notNull(),
  tags: text('tags').array().notNull().default([]),
  schema: jsonb('schema'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  capabilitiesServerIdx: index('capabilities_server_idx').on(t.serverId),
  capabilitiesCategoryIdx: index('capabilities_category_idx').on(t.category),
}));

export const tools = pgTable('tools', {
  id: uuid('id').primaryKey().defaultRandom(),
  capabilityId: uuid('capability_id').notNull().references(() => capabilities.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  inputSchema: jsonb('input_schema').notNull(),
  outputSchema: jsonb('output_schema'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const resources = pgTable('resources', {
  id: uuid('id').primaryKey().defaultRandom(),
  capabilityId: uuid('capability_id').notNull().references(() => capabilities.id, { onDelete: 'cascade' }),
  uri: varchar('uri', { length: 2048 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  mimeType: varchar('mime_type', { length: 100 }),
  schema: jsonb('schema'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const apiKeys = pgTable('api_keys', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  // Non-secret first 12 chars of the key (including the "mcp_" prefix), indexed for
  // O(1) candidate lookup before bcrypt comparison.
  keyPrefix: varchar('key_prefix', { length: 16 }).notNull(),
  keyHash: varchar('key_hash', { length: 255 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  permissions: jsonb('permissions'),
  expiresAt: timestamp('expires_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  lastUsedAt: timestamp('last_used_at'),
}, (t) => ({
  keyPrefixIdx: index('api_keys_key_prefix_idx').on(t.keyPrefix),
}));

export const accessPolicies = pgTable('access_policies', {
  id: uuid('id').primaryKey().defaultRandom(),
  serverId: uuid('server_id').references(() => servers.id, { onDelete: 'cascade' }),
  capabilityId: uuid('capability_id').references(() => capabilities.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  role: varchar('role', { length: 50 }),
  teamId: varchar('team_id', { length: 100 }),
  permission: permissionEnum('permission').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const healthChecks = pgTable('health_checks', {
  id: uuid('id').primaryKey().defaultRandom(),
  serverId: uuid('server_id').notNull().references(() => servers.id, { onDelete: 'cascade' }),
  status: healthCheckStatusEnum('status').notNull(),
  responseTimeMs: integer('response_time_ms').notNull(),
  statusCode: integer('status_code'),
  errorMessage: text('error_message'),
  checkedAt: timestamp('checked_at').notNull().defaultNow(),
}, (t) => ({
  healthChecksServerIdx: index('health_checks_server_checked_idx').on(t.serverId, t.checkedAt),
}));

export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id),
  action: varchar('action', { length: 100 }).notNull(),
  resourceType: varchar('resource_type', { length: 100 }).notNull(),
  resourceId: uuid('resource_id'),
  details: jsonb('details'),
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => ({
  auditLogsCreatedAtIdx: index('audit_logs_created_at_idx').on(t.createdAt),
}));

export const refreshTokenFamilies = pgTable('refresh_token_families', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  family: varchar('family', { length: 64 }).notNull(),
  revoked: timestamp('revoked_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => ({
  familiesUserIdx: index('rtf_user_idx').on(t.userId),
}));

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  servers: many(servers),
  apiKeys: many(apiKeys),
  auditLogs: many(auditLogs),
}));

export const serversRelations = relations(servers, ({ one, many }) => ({
  registeredByUser: one(users, {
    fields: [servers.registeredBy],
    references: [users.id],
  }),
  capabilities: many(capabilities),
  healthChecks: many(healthChecks),
  accessPolicies: many(accessPolicies),
}));

export const capabilitiesRelations = relations(capabilities, ({ one, many }) => ({
  server: one(servers, {
    fields: [capabilities.serverId],
    references: [servers.id],
  }),
  tools: many(tools),
  resources: many(resources),
}));

export const toolsRelations = relations(tools, ({ one }) => ({
  capability: one(capabilities, {
    fields: [tools.capabilityId],
    references: [capabilities.id],
  }),
}));

export const resourcesRelations = relations(resources, ({ one }) => ({
  capability: one(capabilities, {
    fields: [resources.capabilityId],
    references: [capabilities.id],
  }),
}));

// Type exports
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Server = typeof servers.$inferSelect;
export type NewServer = typeof servers.$inferInsert;
export type Capability = typeof capabilities.$inferSelect;
export type NewCapability = typeof capabilities.$inferInsert;
export type Tool = typeof tools.$inferSelect;
export type NewTool = typeof tools.$inferInsert;
export type Resource = typeof resources.$inferSelect;
export type NewResource = typeof resources.$inferInsert;
export type ApiKey = typeof apiKeys.$inferSelect;
export type NewApiKey = typeof apiKeys.$inferInsert;
export type AccessPolicy = typeof accessPolicies.$inferSelect;
export type NewAccessPolicy = typeof accessPolicies.$inferInsert;
export type HealthCheck = typeof healthChecks.$inferSelect;
export type NewHealthCheck = typeof healthChecks.$inferInsert;
export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
