import { cleanEnv, port, str, num, url } from 'envalid';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');

const envFile = process.env.NODE_ENV === 'test'
  ? resolve(projectRoot, '.env.test')
  : resolve(projectRoot, '.env');

dotenv.config({ path: envFile });

export const env = cleanEnv(process.env, {
  NODE_ENV: str({ choices: ['development', 'test', 'production'], default: 'development' }),
  PORT: port({ default: 3000 }),
  HOST: str({ default: '0.0.0.0' }),
  DATABASE_URL: url(),
  JWT_SECRET: str({
    desc: 'Secret key for JWT signing (min 32 characters)',
  }),
  JWT_EXPIRES_IN: str({ default: '24h' }),
  JWT_REFRESH_EXPIRES_IN: str({ default: '7d' }),
  COOKIE_SECRET: str({ default: '' }),
  COOKIE_DOMAIN: str({ default: '' }),
  API_KEY_HASH_ROUNDS: num({ default: 12 }),
  HEALTH_CHECK_INTERVAL: num({ default: 60 }),
  HEALTH_CHECK_TIMEOUT: num({ default: 10 }),
  HEALTH_CHECK_RETRIES: num({ default: 3 }),
  CORS_ORIGIN: str({ default: 'http://localhost:5173' }),
  RATE_LIMIT_WINDOW: str({ default: '15m' }),
  RATE_LIMIT_MAX: num({ default: 100 }),
  LOGIN_RATE_LIMIT_WINDOW: str({ default: '15m' }),
  LOGIN_RATE_LIMIT_MAX: num({ default: 5 }),
  PASSWORD_MIN_LENGTH: num({ default: 10 }),
  LOG_LEVEL: str({ choices: ['trace', 'debug', 'info', 'warn', 'error', 'fatal'], default: 'info' }),
  LOG_FORMAT: str({ choices: ['json', 'pretty'], default: 'pretty' }),
  SEARCH_PAGE_SIZE: num({ default: 20 }),
  SEARCH_MAX_RESULTS: num({ default: 1000 }),
  TRUST_PROXY: str({ default: 'false' }),
});

// Runtime security validation
if (env.JWT_SECRET.length < 32) {
  throw new Error(
    'JWT_SECRET must be at least 32 characters long for security. ' +
    'Generate a strong secret with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
  );
}
