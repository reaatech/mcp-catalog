export interface Server {
  id: string;
  name: string;
  description: string | null;
  url: string;
  healthEndpoint: string | null;
  status: 'healthy' | 'unhealthy' | 'unknown';
  lastHealthCheck: string | null;
  healthCheckInterval: number;
  registeredAt: string;
  updatedAt: string;
  registeredBy: string | null;
  metadata: Record<string, unknown> | null;
  capabilities?: Capability[];
}

export interface Capability {
  id: string;
  serverId: string;
  name: string;
  description: string | null;
  category: string;
  tags: string[];
  schema: Record<string, unknown> | null;
  createdAt: string;
  tools?: Tool[];
  resources?: Resource[];
}

export interface Tool {
  id: string;
  capabilityId: string;
  name: string;
  description: string | null;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown> | null;
  createdAt: string;
}

export interface Resource {
  id: string;
  capabilityId: string;
  uri: string;
  name: string;
  description: string | null;
  mimeType: string | null;
  schema: Record<string, unknown> | null;
  createdAt: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
    hasMore: boolean;
  };
}

export interface HealthSummary {
  total: number;
  healthy: number;
  unhealthy: number;
  unknown: number;
  averageResponseTime: number;
}

export interface HealthCheckRecord {
  serverId: string;
  status: 'healthy' | 'unhealthy' | 'timeout' | 'error';
  responseTimeMs: number;
  statusCode?: number;
  errorMessage?: string;
  checkedAt: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'developer' | 'viewer';
  createdAt: string;
}

export interface AccessPolicy {
  id: string;
  serverId: string | null;
  capabilityId: string | null;
  userId: string | null;
  role: string | null;
  teamId: string | null;
  permission: 'discover' | 'view_details' | 'execute';
  createdAt: string;
}

export interface AuditLog {
  id: string;
  userId: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  details: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
}
