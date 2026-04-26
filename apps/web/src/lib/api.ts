import type { Server, Capability, HealthSummary, HealthCheckRecord, User, AuditLog, AccessPolicy, PaginatedResponse } from '../types/server.js';

const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';
const HEALTH_BASE = import.meta.env.VITE_HEALTH_URL || '/health';

const TOKEN_KEY = 'mcp_catalog_token';
const API_KEY = 'mcp_catalog_api_key';
const USER_KEY = 'mcp_catalog_user';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'developer' | 'viewer';
}

export const authStore = {
  getToken: () => localStorage.getItem(TOKEN_KEY),
  getApiKey: () => localStorage.getItem(API_KEY),
  getUser: (): AuthUser | null => {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as AuthUser;
    } catch {
      return null;
    }
  },
  setSession: (token: string, user: AuthUser) => {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },
  clear: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(API_KEY);
    localStorage.removeItem(USER_KEY);
  },
};

function getAuthHeaders(): Record<string, string> {
  const token = authStore.getToken();
  const apiKey = authStore.getApiKey();
  if (token) return { Authorization: `Bearer ${token}` };
  if (apiKey) return { 'X-API-Key': apiKey };
  return {};
}

async function fetchJson<T>(url: string, options: RequestInit = {}): Promise<T> {
  const hasBody = options.body !== undefined || options.method === 'POST' || options.method === 'PUT' || options.method === 'PATCH';
  const response = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
      ...getAuthHeaders(),
    },
  });

  if (response.status === 401) {
    authStore.clear();
    window.dispatchEvent(new CustomEvent('mcp-catalog:auth-cleared'));
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

function buildQuery(params: Record<string, string | number | undefined>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') query.append(key, String(value));
  }
  const s = query.toString();
  return s ? `?${s}` : '';
}

export const api = {
  // Auth
  login: async (email: string, password: string) => {
    const res = await fetchJson<{ token: string; user: AuthUser }>(
      `${API_BASE}/auth/login`,
      { method: 'POST', body: JSON.stringify({ email, password }) }
    );
    authStore.setSession(res.token, res.user);
    return res;
  },
  logout: async () => {
    try {
      await fetch(`${API_BASE}/auth/logout`, { method: 'POST', credentials: 'include' });
    } catch {
      // ignore errors during logout
    }
    authStore.clear();
  },

  // Servers
  listServers: (params?: { status?: string; search?: string; limit?: number; offset?: number }) =>
    fetchJson<PaginatedResponse<Server>>(`${API_BASE}/servers${buildQuery(params ?? {})}`),

  getServer: (id: string) => fetchJson<Server>(`${API_BASE}/servers/${id}`),

  refreshToken: async () => {
    const res = await fetchJson<{ token: string }>(
      `${API_BASE}/auth/refresh`,
      { method: 'POST' }
    );
    const user = authStore.getUser();
    if (user) {
      authStore.setSession(res.token, user);
    }
    return res;
  },

  createServer: (data: Record<string, unknown>) =>
    fetchJson<Server>(`${API_BASE}/servers`, { method: 'POST', body: JSON.stringify(data) }),

  updateServer: (id: string, data: Record<string, unknown>) =>
    fetchJson<Server>(`${API_BASE}/servers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  deleteServer: (id: string) =>
    fetchJson<void>(`${API_BASE}/servers/${id}`, { method: 'DELETE' }),

  // Capabilities
  listCapabilities: (params?: { serverId?: string; category?: string; limit?: number; offset?: number }) =>
    fetchJson<PaginatedResponse<Capability>>(`${API_BASE}/capabilities${buildQuery(params ?? {})}`),

  getCapability: (id: string) => fetchJson<Capability>(`${API_BASE}/capabilities/${id}`),

  // Search
  search: (params: { q: string; category?: string; tags?: string; status?: string; limit?: number; offset?: number }) =>
    fetchJson<{ servers: Server[]; capabilities: Capability[]; pagination: PaginatedResponse<unknown>['pagination'] }>(
      `${API_BASE}/search${buildQuery(params)}`
    ),

  // Health
  getHealthSummary: () => fetchJson<HealthSummary>(`${HEALTH_BASE}/summary`),
  getHealthHistory: (serverId: string) => fetchJson<HealthCheckRecord[]>(`${HEALTH_BASE}/history/${serverId}`),

  // Admin
  listUsers: () => fetchJson<PaginatedResponse<User>>(`${API_BASE}/admin/users`),
  createUser: (data: Record<string, unknown>) =>
    fetchJson<User>(`${API_BASE}/admin/users`, { method: 'POST', body: JSON.stringify(data) }),
  deleteUser: (id: string) =>
    fetchJson<void>(`${API_BASE}/admin/users/${id}`, { method: 'DELETE' }),
  listAuditLogs: () => fetchJson<PaginatedResponse<AuditLog>>(`${API_BASE}/admin/audit-logs`),
  listAccessPolicies: () => fetchJson<PaginatedResponse<AccessPolicy>>(`${API_BASE}/admin/access-policies`),
};
