import { lookup } from 'node:dns/promises';
import type { LookupAddress } from 'node:dns';
import { isIP } from 'node:net';
import { db } from '../db/index.js';
import { servers, healthChecks } from '../db/schema.js';
import { eq, desc, sql, isNull, and, gte, or } from 'drizzle-orm';
import { logger } from '../utils/logger.js';
import { env } from '../config.js';

function isBlockedIp(ip: string): boolean {
  if (!isIP(ip)) return true;
  const v4 = ip.includes('.') ? ip.split('.').map(Number) : null;
  if (v4 && v4.length === 4 && v4.every(n => Number.isInteger(n) && n >= 0 && n <= 255)) {
    const [a, b] = v4;
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a >= 224) return true;
    return false;
  }
  const lower = ip.toLowerCase();
  if (lower === '::' || lower === '::1') return true;
  if (lower.startsWith('fe80:') || lower.startsWith('fc') || lower.startsWith('fd')) return true;
  if (lower === '::ffff:127.0.0.1' || lower.startsWith('::ffff:10.')) return true;
  if (lower === '::ffff:0.0.0.0' || lower.startsWith('::ffff:0.')) return true;
  if (lower === '::ffff:169.254.0.0' || lower.startsWith('::ffff:169.254.')) return true;
  if (lower.startsWith('::ffff:172.')) {
    const parts = lower.replace('::ffff:', '').split('.').map(Number);
    if (parts.length === 4 && parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
  }
  if (lower.startsWith('::ffff:192.168.')) return true;
  return false;
}

export interface SafeUrlResult {
  resolvedIp: string;
  isIpLiteral: boolean;
}

export async function assertSafeUrl(rawUrl: string, allowLoopback: boolean): Promise<SafeUrlResult> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error(`Invalid URL: ${rawUrl}`);
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`Unsupported protocol: ${parsed.protocol}`);
  }
  const host = parsed.hostname;
  const candidates: LookupAddress[] = [];
  if (isIP(host)) {
    candidates.push({ address: host, family: host.includes(':') ? 6 : 4 });
  } else {
    const records = await lookup(host, { all: true });
    for (const r of records) candidates.push(r);
  }
  for (const { address } of candidates) {
    if (allowLoopback && (address === '127.0.0.1' || address === '::1')) continue;
    if (isBlockedIp(address)) {
      throw new Error(`URL resolves to blocked address ${address}`);
    }
  }
  const first = candidates[0];
  if (!first) throw new Error(`Could not resolve ${host}`);
  return { resolvedIp: first.address, isIpLiteral: isIP(host) > 0 };
}

function buildPinnedUrl(rawUrl: string, resolvedIp: string, isIpLiteral: boolean): { url: string; headers: Record<string, string> } {
  const parsed = new URL(rawUrl);
  if (isIpLiteral) {
    return { url: rawUrl, headers: {} };
  }
  parsed.hostname = resolvedIp;
  return { url: parsed.toString(), headers: { Host: parsed.host } };
}

export interface HealthCheckResult {
  serverId: string;
  status: 'healthy' | 'unhealthy' | 'timeout' | 'error';
  responseTimeMs: number;
  statusCode?: number;
  errorMessage?: string;
  checkedAt: Date;
}

export interface HealthCheckConfig {
  timeout?: number;
  retries?: number;
  backoffMs?: number;
  allowLoopback?: boolean;
}

const DEFAULT_CONFIG: HealthCheckConfig = {
  timeout: 10000,
  retries: 3,
  backoffMs: 1000,
  allowLoopback: process.env.NODE_ENV !== 'production',
};

export class HealthCheckService {
  private config: HealthCheckConfig;

  constructor(config: HealthCheckConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async checkServer(serverId: string): Promise<HealthCheckResult> {
    const [server] = await db.select().from(servers).where(eq(servers.id, serverId)).limit(1);
    if (!server) {
      throw new Error(`Server ${serverId} not found`);
    }

    const url = server.healthEndpoint || server.url;
    const startTime = Date.now();

    let safeIp: SafeUrlResult;
    try {
      safeIp = await assertSafeUrl(url, this.config.allowLoopback ?? false);
    } catch (error) {
      const result: HealthCheckResult = {
        serverId,
        status: 'error',
        responseTimeMs: 0,
        errorMessage: (error as Error).message,
        checkedAt: new Date(),
      };
      await this.recordHealthCheck(result);
      return result;
    }

    const { url: pinnedUrl, headers: pinnedHeaders } = buildPinnedUrl(url, safeIp.resolvedIp, safeIp.isIpLiteral);

    try {
      let lastError: Error | null = null;
      let response: Response | null = null;

      const maxRetries = this.config.retries ?? 3;
      const backoffMs = this.config.backoffMs ?? 1000;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

          response = await fetch(pinnedUrl, {
            method: 'GET',
            signal: controller.signal,
            headers: { ...pinnedHeaders, 'User-Agent': 'mcp-catalog-health-checker/1.0' },
          });

          clearTimeout(timeoutId);
          break;
        } catch (error) {
          lastError = error as Error;
          if (attempt < maxRetries) {
            const backoff = backoffMs * Math.pow(2, attempt - 1);
            await new Promise(resolve => setTimeout(resolve, backoff));
          }
        }
      }

      const responseTimeMs = Date.now() - startTime;

      if (!response) {
        const result: HealthCheckResult = {
          serverId,
          status: 'error',
          responseTimeMs,
          errorMessage: lastError?.message || 'All retries failed',
          checkedAt: new Date(),
        };
        await this.recordHealthCheck(result);
        return result;
      }

      const status = response.status >= 200 && response.status < 300 ? 'healthy' : 'unhealthy';
      const result: HealthCheckResult = {
        serverId,
        status,
        responseTimeMs,
        statusCode: response.status,
        checkedAt: new Date(),
      };
      await this.recordHealthCheck(result);
      return result;
    } catch (error) {
      const responseTimeMs = Date.now() - startTime;
      const result: HealthCheckResult = {
        serverId,
        status: 'timeout',
        responseTimeMs,
        errorMessage: (error as Error).message,
        checkedAt: new Date(),
      };
      await this.recordHealthCheck(result);
      return result;
    }
  }

  private async recordHealthCheck(result: HealthCheckResult): Promise<void> {
    await db.insert(healthChecks).values({
      serverId: result.serverId,
      status: result.status,
      responseTimeMs: result.responseTimeMs,
      statusCode: result.statusCode,
      errorMessage: result.errorMessage,
      checkedAt: result.checkedAt,
    });

    await this.updateServerStatus(result.serverId);
  }

  private async updateServerStatus(serverId: string): Promise<void> {
    const recentChecks = await db
      .select()
      .from(healthChecks)
      .where(eq(healthChecks.serverId, serverId))
      .orderBy(desc(healthChecks.checkedAt))
      .limit(5);

    if (recentChecks.length === 0) return;

    const healthyCount = recentChecks.filter(c => c.status === 'healthy').length;
    let newStatus: 'healthy' | 'unhealthy' | 'unknown' = 'unknown';

    if (healthyCount === recentChecks.length) {
      newStatus = 'healthy';
    } else if (healthyCount === 0) {
      newStatus = 'unhealthy';
    } else {
      const [server] = await db.select().from(servers).where(eq(servers.id, serverId)).limit(1);
      newStatus = server?.status || 'unknown';
    }

    await db
      .update(servers)
      .set({ status: newStatus, lastHealthCheck: new Date(), updatedAt: new Date() })
      .where(eq(servers.id, serverId));
  }

  async checkDueServers(concurrency = 10): Promise<HealthCheckResult[]> {
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

    const serversToCheck = await db
      .select()
      .from(servers)
      .where(
        or(
          isNull(servers.lastHealthCheck),
          and(
            sql`${servers.lastHealthCheck} < ${fiveMinutesAgo}`,
            sql`${servers.lastHealthCheck} < ${sql`now() - interval '1 second' * ${servers.healthCheckInterval}`}`
          )
        )
      );

    logger.info(`Found ${serversToCheck.length} servers to check`);

    const results: PromiseSettledResult<HealthCheckResult>[] = [];
    for (let i = 0; i < serversToCheck.length; i += concurrency) {
      const batch = serversToCheck.slice(i, i + concurrency);
      const batchResults = await Promise.allSettled(
        batch.map(server => this.checkServer(server.id))
      );
      results.push(...batchResults);
    }

    const successfulResults: HealthCheckResult[] = [];
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        successfulResults.push(result.value);
      } else {
        logger.error(`Failed to check server ${serversToCheck[index].id}: ${result.reason}`);
      }
    });

    return successfulResults;
  }

  async getHealthHistory(serverId: string, limit: number = 100): Promise<HealthCheckResult[]> {
    const records = await db
      .select()
      .from(healthChecks)
      .where(eq(healthChecks.serverId, serverId))
      .orderBy(desc(healthChecks.checkedAt))
      .limit(limit);

    return records.map(r => ({
      serverId: r.serverId,
      status: r.status,
      responseTimeMs: r.responseTimeMs,
      statusCode: r.statusCode ?? undefined,
      errorMessage: r.errorMessage ?? undefined,
      checkedAt: r.checkedAt,
    }));
  }

  async getHealthSummary(): Promise<{
    total: number;
    healthy: number;
    unhealthy: number;
    unknown: number;
    averageResponseTime: number;
  }> {
    const allServers = await db.select().from(servers).limit(10000);
    const summary = {
      total: allServers.length,
      healthy: allServers.filter(s => s.status === 'healthy').length,
      unhealthy: allServers.filter(s => s.status === 'unhealthy').length,
      unknown: allServers.filter(s => s.status === 'unknown').length,
    };

    const recentChecks = await db
      .select({ responseTimeMs: healthChecks.responseTimeMs })
      .from(healthChecks)
      .where(gte(healthChecks.checkedAt, new Date(Date.now() - 24 * 60 * 60 * 1000)))
      .limit(1000);

    const avgResponseTime = recentChecks.length > 0
      ? Math.round(recentChecks.reduce((sum, c) => sum + c.responseTimeMs, 0) / recentChecks.length)
      : 0;

    return { ...summary, averageResponseTime: avgResponseTime };
  }
}

export const healthCheckService = new HealthCheckService({
  timeout: env.HEALTH_CHECK_TIMEOUT * 1000,
  retries: env.HEALTH_CHECK_RETRIES,
});
