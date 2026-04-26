import { buildApp } from './app.js';
import { env } from './config.js';
import { logger } from './utils/logger.js';
import { healthCheckScheduler } from './services/healthCheckScheduler.js';
import { pool } from './db/index.js';

async function main() {
  const app = await buildApp();

  // Start health check scheduler
  await healthCheckScheduler.start(env.HEALTH_CHECK_INTERVAL * 1000);

  const shutdown = async () => {
    healthCheckScheduler.stop();
    await app.close();
    await pool.end();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  try {
    await app.listen({ port: env.PORT, host: env.HOST });
    logger.info(`API server running on http://${env.HOST}:${env.PORT}`);
    logger.info(`API documentation available at http://${env.HOST}:${env.PORT}/documentation`);
  } catch (err) {
    logger.error(err, 'Failed to start server');
    process.exit(1);
  }
}

main();
