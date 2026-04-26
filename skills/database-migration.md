# Skill: Database Migration

## Purpose

Create and apply database migrations using Drizzle ORM for the mcp-catalog project. This skill covers creating new tables, modifying existing schemas, and managing database evolution.

## Prerequisites

- Project setup completed
- PostgreSQL or SQLite database available
- Basic understanding of SQL and database design
- Familiarity with Drizzle ORM concepts

## Tools Required

- Drizzle ORM
- Drizzle Kit (for migrations)
- PostgreSQL or SQLite database

## Steps

### 1. Set Up Drizzle Kit

If not already configured, add Drizzle Kit to your API app:

```bash
cd apps/api
pnpm add -D drizzle-kit
```

Add migration script to `package.json`:

```json
{
  "scripts": {
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:push": "drizzle-kit push",
    "db:studio": "drizzle-kit studio"
  }
}
```

Create `drizzle.config.ts` in `apps/api/`:

```typescript
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
});
```

### 2. Define Your Schema

Create or update `apps/api/src/db/schema.ts`:

```typescript
import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  integer,
  jsonb,
  pgEnum,
  boolean,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums
export const serverStatusEnum = pgEnum('server_status', ['healthy', 'unhealthy', 'unknown']);
export const userRoleEnum = pgEnum('user_role', ['admin', 'developer', 'viewer']);
export const healthCheckStatusEnum = pgEnum('health_check_status', ['healthy', 'unhealthy', 'timeout', 'error']);
export const permissionEnum = pgEnum('permission', ['discover', 'view_details', 'execute']);

// Users table
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  role: userRoleEnum('role').notNull().default('viewer'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  lastLoginAt: timestamp('last_login_at'),
});

// Servers table
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
  registeredBy: uuid('registered_by').references(() => users.id),
  metadata: jsonb('metadata'),
});

// Capabilities table
export const capabilities = pgTable('capabilities', {
  id: uuid('id').primaryKey().defaultRandom(),
  serverId: uuid('server_id').notNull().references(() => servers.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  category: varchar('category', { length: 100 }).notNull(),
  tags: text('tags').array().notNull().default([]),
  schema: jsonb('schema'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Tools table
export const tools = pgTable('tools', {
  id: uuid('id').primaryKey().defaultRandom(),
  capabilityId: uuid('capability_id').notNull().references(() => capabilities.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  inputSchema: jsonb('input_schema').notNull(),
  outputSchema: jsonb('output_schema'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Resources table
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

// API Keys table
export const apiKeys = pgTable('api_keys', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  keyHash: varchar('key_hash', { length: 255 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  permissions: jsonb('permissions'),
  expiresAt: timestamp('expires_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  lastUsedAt: timestamp('last_used_at'),
});

// Access Policies table
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

// Health Checks table
export const healthChecks = pgTable('health_checks', {
  id: uuid('id').primaryKey().defaultRandom(),
  serverId: uuid('server_id').notNull().references(() => servers.id, { onDelete: 'cascade' }),
  status: healthCheckStatusEnum('status').notNull(),
  responseTimeMs: integer('response_time_ms').notNull(),
  statusCode: integer('status_code'),
  errorMessage: text('error_message'),
  checkedAt: timestamp('checked_at').notNull().defaultNow(),
});

// Audit Logs table
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
});

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
```

### 3. Generate Migration

Run the migration generation command:

```bash
cd apps/api
pnpm db:generate
```

This will create a new migration file in `apps/api/src/db/migrations/` with a timestamp prefix.

### 4. Apply Migration

Apply the migration to your database:

```bash
# For production (using migrations)
pnpm db:migrate

# For development (direct push - use with caution)
pnpm db:push
```

### 5. Create Seed Data (Optional)

Create `apps/api/src/db/seed.ts`:

```typescript
import { db } from './index';
import { users, servers, capabilities } from './schema';
import bcrypt from 'bcryptjs';

export async function seed() {
  console.log('🌱 Seeding database...');

  // Create admin user
  const [admin] = await db
    .insert(users)
    .values({
      email: 'admin@mcp-catalog.local',
      name: 'Admin User',
      role: 'admin',
    })
    .returning();

  console.log(`✅ Created admin user: ${admin.email}`);

  // Create a sample MCP server
  const [sampleServer] = await db
    .insert(servers)
    .values({
      name: 'Sample MCP Server',
      description: 'A demonstration MCP server for testing',
      url: 'http://localhost:4000',
      status: 'healthy',
      registeredBy: admin.id,
      metadata: {
        version: '1.0.0',
        environment: 'development',
      },
    })
    .returning();

  console.log(`✅ Created sample server: ${sampleServer.name}`);

  // Add sample capabilities
  const sampleCapabilities = [
    {
      name: 'Database Query',
      description: 'Query databases with SQL',
      category: 'database',
      tags: ['sql', 'query', 'database'],
    },
    {
      name: 'File System',
      description: 'Access and manipulate files',
      category: 'filesystem',
      tags: ['files', 'read', 'write'],
    },
    {
      name: 'Web Search',
      description: 'Search the web for information',
      category: 'search',
      tags: ['web', 'search', 'information'],
    },
  ];

  for (const cap of sampleCapabilities) {
    await db.insert(capabilities).values({
      ...cap,
      serverId: sampleServer.id,
    });
  }

  console.log(`✅ Created ${sampleCapabilities.length} sample capabilities`);
  console.log('🎉 Seeding completed!');
}

// Run seed if called directly (e.g., tsx src/db/seed.ts)
// With ESM, use: if (import.meta.url === `file://${process.argv[1]}`) { ... }
```

Add seed script to `package.json`:

```json
{
  "scripts": {
    "db:seed": "tsx src/db/seed.ts"
  }
}
```

### 6. Create Database Connection

Create `apps/api/src/db/index.ts`:

```typescript
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL!,
});

export const db = drizzle(pool, { schema });
```

## Output

After completing this skill, you should have:

- Complete database schema defined with Drizzle ORM
- Migration files generated
- Database tables created
- Type-safe database queries
- Seed data for development
- Database connection configured

## Verification

Test your database setup:

```bash
# Check database connection
pnpm db:studio

# Run seed data
pnpm db:seed

# Verify tables exist
psql $DATABASE_URL -c "\dt"

# Test a query
pnpm exec tsx -e "import { db } from './src/db'; import { users } from './src/db/schema'; db.select().from(users).then(console.log)"
```

## Example Interaction

**User**: "Create the database schema for the mcp-catalog"

**Agent**:
1. Defines all tables with proper relationships
2. Creates enums for status fields
3. Sets up foreign key constraints
4. Generates migration files
5. Applies migrations to database
6. Creates seed data
7. Verifies database setup

**Expected Output**:
```
✅ Schema defined with 9 tables
✅ Enums created: server_status, user_role, health_check_status, permission
✅ Relationships configured
✅ Migration generated: 20260421000000_initial_schema.sql
✅ Migrations applied to database
✅ Seed data created:
   - 1 admin user
   - 1 sample server
   - 3 sample capabilities

Database Tables:
- users
- servers
- capabilities
- tools
- resources
- api_keys
- access_policies
- health_checks
- audit_logs

TypeScript types generated for all entities.
```

## Best Practices

1. **Use transactions** for multi-step operations
2. **Add indexes** on frequently queried columns
3. **Use UUIDs** for distributed systems
4. **Add timestamps** (createdAt, updatedAt) to all tables
5. **Define relations** explicitly for type safety
6. **Export types** for use throughout the application
7. **Use enums** for fixed sets of values
8. **Add proper constraints** (unique, not null, foreign keys)
9. **Version your migrations** with timestamps
10. **Test migrations** in a staging environment first

## Common Migration Patterns

### Adding a Column
```typescript
// In schema
export const servers = pgTable('servers', {
  // ... existing columns
  newColumn: varchar('new_column', { length: 255 }),
});

// Generate and apply migration
pnpm db:generate
pnpm db:migrate
```

### Creating an Index
```typescript
// In schema
export const servers = pgTable('servers', {
  // ... columns
}, (table) => ({
  idxName: index('idx_servers_name').on(table.name),
  idxStatus: index('idx_servers_status').on(table.status),
}));
```

### Adding a Foreign Key
```typescript
// Ensure relation is defined in schema
serverId: uuid('server_id').references(() => servers.id, { onDelete: 'cascade' })
```

## Troubleshooting

### Migration Fails
```bash
# Check migration file syntax
cat apps/api/src/db/migrations/*.sql

# Verify database connection
echo $DATABASE_URL

# Check PostgreSQL logs
docker logs postgres
```

### Type Errors
```bash
# Regenerate types
pnpm db:generate

# Clear TypeScript cache
rm -rf node_modules/.cache
```

### Connection Issues
```bash
# Test connection
psql $DATABASE_URL -c "SELECT 1"

# Check if database exists
psql -l | grep mcp_catalog
```

## Next Steps

After setting up the database:

1. Create API endpoints to interact with the data
2. Build React components to display data
3. Add MCP tools for database queries
4. Implement health monitoring
5. Set up automated backups
