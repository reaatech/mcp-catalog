import { healthCheckService } from './healthCheck.js';
import { db } from '../db/index.js';
import { healthChecks } from '../db/schema.js';
import { sql } from 'drizzle-orm';
import { logger } from '../utils/logger.js';

const RETENTION_DAYS = 30;
const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;

export class HealthCheckScheduler {
  private interval: NodeJS.Timeout | null = null;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(private checkIntervalMs: number = 60000) {}

  async start(intervalMs?: number): Promise<void> {
    if (this.interval) {
      logger.warn('Health check scheduler already running');
      return;
    }

    if (intervalMs) {
      this.checkIntervalMs = intervalMs;
    }

    logger.info(`Starting health check scheduler (interval: ${this.checkIntervalMs}ms)`);
    this.runChecks();
    this.interval = setInterval(() => this.runChecks(), this.checkIntervalMs);

    this.runCleanup();
    this.cleanupInterval = setInterval(() => this.runCleanup(), CLEANUP_INTERVAL_MS);
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    logger.info('Health check scheduler stopped');
  }

  private async runCleanup(): Promise<void> {
    try {
      const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
      await db
        .delete(healthChecks)
        .where(sql`${healthChecks.checkedAt} < ${cutoff}`);
      logger.info(`Health check retention cleanup: removed records older than ${RETENTION_DAYS} days`);
    } catch (err) {
      logger.error({ err }, 'Health check retention cleanup failed');
    }
  }

  private async runChecks(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Health check run already in progress, skipping');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();

    try {
      logger.info('Starting health check run');
      const results = await healthCheckService.checkDueServers();
      const duration = Date.now() - startTime;
      const healthyCount = results.filter(r => r.status === 'healthy').length;
      const unhealthyCount = results.filter(r => r.status !== 'healthy').length;

      logger.info(
        `Health check run completed in ${duration}ms: ${results.length} checked, ${healthyCount} healthy, ${unhealthyCount} unhealthy`
      );

      results
        .filter(r => r.status !== 'healthy')
        .forEach(r => {
          logger.warn(`Server ${r.serverId} is ${r.status}: ${r.errorMessage || `HTTP ${r.statusCode}`}`);
        });
    } catch (error) {
      logger.error({ err: error }, 'Health check run failed');
    } finally {
      this.isRunning = false;
    }
  }

  async checkServerNow(serverId: string): Promise<void> {
    try {
      await healthCheckService.checkServer(serverId);
      logger.info(`Manual health check completed for server ${serverId}`);
    } catch (error) {
      logger.error({ err: error }, `Manual health check failed for server ${serverId}`);
      throw error;
    }
  }
}

export const healthCheckScheduler = new HealthCheckScheduler();
