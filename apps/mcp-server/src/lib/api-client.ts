const CATALOG_API_URL = process.env.CATALOG_API_URL || 'http://localhost:3000';
const apiKey = process.env.CATALOG_API_KEY || '';

const rawTimeout = parseInt(process.env.CATALOG_REQUEST_TIMEOUT || '15000', 10);
const requestTimeout = Number.isNaN(rawTimeout) ? 15000 : rawTimeout;

export async function apiGet<T = unknown>(path: string): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestTimeout);
  try {
    const headers: Record<string, string> = {};
    if (apiKey) headers['X-API-Key'] = apiKey;
    const response = await fetch(`${CATALOG_API_URL}${path}`, { headers, signal: controller.signal });
    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }
    return response.json();
  } finally {
    clearTimeout(timeout);
  }
}
