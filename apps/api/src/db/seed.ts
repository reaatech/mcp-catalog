import { db } from './index.js';
import { users, servers, capabilities } from './schema.js';
import { hashPassword } from '../utils/auth.js';
import { logger } from '../utils/logger.js';
import { eq, and } from 'drizzle-orm';

export async function seed() {
  // Safety guard: never run in production
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Seeding is disabled in production environments');
  }

  logger.info('Seeding database...');

  const adminEmail = 'admin@mcp-catalog.local';
  const [existingAdmin] = await db.select().from(users).where(eq(users.email, adminEmail)).limit(1);

  let admin = existingAdmin;
  if (!admin) {
    const seedPassword = `seed-${crypto.randomUUID().slice(0, 8)}`;
    const passwordHash = await hashPassword(seedPassword);
    [admin] = await db
      .insert(users)
      .values({
        email: adminEmail,
        name: 'Admin User',
        passwordHash,
        role: 'admin',
      })
      .returning();
    logger.info(`Created admin user: ${admin.email}`);
    process.stderr.write(`\nSeed admin password: ${seedPassword}\nSave this password - it will not be displayed again.\n\n`);
  } else {
    logger.info(`Admin user already exists: ${admin.email}`);
  }

  const sampleName = 'Sample MCP Server';
  const [existingServer] = await db.select().from(servers).where(eq(servers.name, sampleName)).limit(1);

  let sampleServer = existingServer;
  if (!sampleServer) {
    [sampleServer] = await db
      .insert(servers)
      .values({
        name: sampleName,
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
    logger.info(`Created sample server: ${sampleServer.name}`);
  } else {
    logger.info(`Sample server already exists: ${sampleServer.name}`);
  }

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

  let added = 0;
  for (const cap of sampleCapabilities) {
    const [existing] = await db
      .select()
      .from(capabilities)
      .where(and(eq(capabilities.serverId, sampleServer.id), eq(capabilities.name, cap.name)))
      .limit(1);
    if (existing) continue;
    await db.insert(capabilities).values({ ...cap, serverId: sampleServer.id });
    added++;
  }
  logger.info(`Added ${added} new sample capabilities (${sampleCapabilities.length - added} already present)`);
  logger.info('Seeding completed!');
}

// Run seed if called directly (e.g., tsx src/db/seed.ts)
if (import.meta.url === `file://${process.argv[1]}`) {
  seed()
    .then(() => process.exit(0))
    .catch((err) => {
      logger.error(err, 'Seed failed');
      process.exit(1);
    });
}
