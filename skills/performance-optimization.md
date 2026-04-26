# Skill: Performance Optimization

## Purpose

Analyze and optimize performance bottlenecks in the mcp-catalog project. This skill covers profiling, identifying hotspots, and implementing optimizations for better response times and resource usage.

## Prerequisites

- Application running in development or staging
- Basic understanding of performance metrics
- Familiarity with profiling tools
- Access to monitoring data

## Tools Required

- Node.js profiler
- Chrome DevTools (for web)
- pnpm/npm scripts
- Monitoring/logging tools

## Steps

### 1. Performance Profiling

#### API Performance Profiling

Create `scripts/profile-api.js`:

```javascript
const { performance } = require('perf_hooks');

// Profile specific operations
function profileOperation(name, operation) {
  const start = performance.now();
  const result = operation();
  const end = performance.now();
  console.log(`${name}: ${(end - start).toFixed(2)}ms`);
  return result;
}

// Example usage
profileOperation('Database Query', async () => {
  return await db.select().from(servers).where(eq(servers.status, 'healthy'));
});
```

#### Web Performance Profiling

Add to `apps/web/src/utils/performance.ts`:

```typescript
export function measureRenderTime(componentName: string, callback: () => void) {
  const start = performance.now();
  callback();
  const end = performance.now();
  console.log(`${componentName} rendered in ${(end - start).toFixed(2)}ms`);
}

export function measureFetchTime(url: string) {
  const start = performance.now();
  return fetch(url).then(response => {
    const end = performance.now();
    console.log(`GET ${url} completed in ${(end - start).toFixed(2)}ms`);
    return response;
  });
}
```

### 2. Database Optimization

#### Add Indexes

Create migration for indexes:

```typescript
// In schema
export const servers = pgTable('servers', {
  // ... columns
}, (table) => ({
  idxName: index('idx_servers_name').on(table.name),
  idxStatus: index('idx_servers_status').on(table.status),
  idxRegisteredAt: index('idx_servers_registered_at').on(table.registeredAt),
  idxCategory: index('idx_capabilities_category').on(capabilities.category),
}));
```

#### Optimize Queries

```typescript
// ❌ Bad: N+1 query problem
const servers = await db.select().from(servers);
for (const server of servers) {
  const capabilities = await db.select().from(capabilities).where(eq(capabilities.serverId, server.id));
  server.capabilities = capabilities;
}

// ✅ Good: Single query with join
const servers = await db
  .select({
    server: servers,
    capabilities: capabilities,
  })
  .from(servers)
  .leftJoin(capabilities, eq(capabilities.serverId, servers.id));
```

#### Implement Caching

```typescript
import NodeCache from 'node-cache';

const cache = new NodeCache({ stdTTL: 300 }); // 5 minutes

export async function getCachedServers() {
  const cached = cache.get('servers-list');
  if (cached) return cached;

  const servers = await db.select().from(servers);
  cache.set('servers-list', servers);
  return servers;
}
```

### 3. API Optimization

#### Implement Pagination

```typescript
// Add pagination to large list endpoints
fastify.get('/api/v1/servers', async (request, reply) => {
  const { limit = 20, offset = 0 } = request.query;
  
  const [servers, total] = await Promise.all([
    db.select().from(servers).limit(limit).offset(offset),
    db.select({ count: count() }).from(servers),
  ]);

  reply.send({
    data: servers,
    pagination: {
      limit,
      offset,
      total: total[0].count,
      hasMore: offset + servers.length < total[0].count,
    },
  });
});
```

#### Use Compression

```typescript
import compress from '@fastify/compress';

await fastify.register(compress, {
  encoding: 'gzip',
  threshold: 1024, // Only compress responses > 1KB
});
```

#### Implement Rate Limiting

```typescript
import rateLimit from '@fastify/rate-limit';

await fastify.register(rateLimit, {
  max: 100,
  timeWindow: '1 minute',
});
```

### 4. Web Optimization

#### Code Splitting

Update `apps/web/vite.config.ts`:

```typescript
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          ui: ['@headlessui/react', '@heroicons/react'],
        },
      },
    },
  },
});
```

#### Lazy Loading

```typescript
// Lazy load components
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const ServerDetails = lazy(() => import('./pages/ServerDetails'));

// Use Suspense boundary
<Suspense fallback={<LoadingSpinner />}>
  <AdminDashboard />
</Suspense>
```

#### Optimize Images

```typescript
// Use WebP format and responsive images
<img
  src="/images/server-icon.webp"
  srcSet="/images/server-icon@2x.webp 2x, /images/server-icon@3x.webp 3x"
  alt="Server"
  loading="lazy"
/>
```

### 5. Monitoring Setup

#### Add Performance Metrics

Create `apps/api/src/middleware/metrics.ts`:

```typescript
import { performance } from 'perf_hooks';

export async function performanceMetrics(fastify: FastifyInstance) {
  fastify.addHook('onRequest', async (request, reply) => {
    (request as any).startTime = performance.now();
  });

  fastify.addHook('onResponse', async (request, reply) => {
    const duration = performance.now() - (request as any).startTime;
    
    fastify.metrics.histogram('request_duration_ms', duration, {
      route: reply.context.config.url,
      method: request.method,
      status_code: reply.statusCode,
    });
  });
}
```

#### Set Up Health Checks

```typescript
// Add detailed health check endpoint
fastify.get('/health/deep', async () => {
  const checks = await Promise.allSettled([
    checkDatabase(),
    checkRedis(),
    checkExternalAPIs(),
  ]);

  const allHealthy = checks.every(c => c.status === 'fulfilled');
  
  return {
    status: allHealthy ? 'healthy' : 'unhealthy',
    checks: checks.map((c, i) => ({
      name: ['database', 'redis', 'external_apis'][i],
      status: c.status === 'fulfilled' ? 'healthy' : 'unhealthy',
      duration: c.status === 'fulfilled' ? c.value.duration : undefined,
    })),
  };
});
```

## Performance Benchmarks

### API Response Times (Target)
- Simple queries: < 50ms
- Complex queries: < 200ms
- Search operations: < 100ms
- Health checks: < 30ms

### Web Performance (Target)
- First Contentful Paint: < 1.5s
- Time to Interactive: < 3.5s
- Largest Contentful Paint: < 2.5s
- Cumulative Layout Shift: < 0.1

### Database (Target)
- Query execution: < 10ms average
- Connection pool: < 100ms wait time
- Index usage: > 95% of queries

## Output

After completing this skill, you should have:

- Performance baseline metrics
- Identified bottlenecks
- Implemented optimizations
- Monitoring in place
- Performance documentation

## Verification

```bash
# Run performance tests
pnpm test:performance

# Profile API
node --inspect apps/api/dist/index.js

# Analyze bundle size
pnpm -F web build --analyze

# Check Lighthouse score
npx lighthouse http://localhost:5173
```

## Best Practices

1. **Measure before optimizing** - Profile first, optimize second
2. **Focus on bottlenecks** - Optimize the slowest parts
3. **Use caching wisely** - Cache expensive operations
4. **Paginate large datasets** - Never return unlimited results
5. **Optimize database queries** - Use indexes and avoid N+1
6. **Minimize bundle size** - Code split and tree shake
7. **Use compression** - Gzip responses
8. **Implement lazy loading** - Load resources on demand
9. **Monitor continuously** - Set up alerts for regressions
10. **Test under load** - Use load testing tools

## Common Optimizations

### 1. Database Query Optimization
```typescript
// Use EXPLAIN to analyze queries
EXPLAIN ANALYZE SELECT * FROM servers WHERE status = 'healthy';
```

### 2. API Response Caching
```typescript
// Cache frequently requested data
const cachedData = await redis.get(`servers:${serverId}`);
if (cachedData) return JSON.parse(cachedData);
```

### 3. Web Performance
```typescript
// Preload critical resources
<link rel="preload" href="/fonts/inter.woff2" as="font" type="font/woff2" crossorigin>
```

## Next Steps

After performance optimization:

1. Set up continuous performance monitoring
2. Implement automated performance testing
3. Create performance budgets
4. Set up alerting for performance regressions
5. Document performance best practices
