export interface Server {
  id: string;
  name: string;
  description: string | null;
  url: string;
  healthEndpoint: string | null;
  status: 'healthy' | 'unhealthy' | 'unknown';
  lastHealthCheck: Date | null;
  healthCheckInterval: number;
  registeredAt: Date;
  updatedAt: Date;
  registeredBy: string | null;
  metadata: Record<string, unknown> | null;
}

export interface Capability {
  id: string;
  serverId: string;
  name: string;
  description: string | null;
  category: string;
  tags: string[];
  schema: Record<string, unknown> | null;
  createdAt: Date;
}

export interface Tool {
  id: string;
  capabilityId: string;
  name: string;
  description: string | null;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown> | null;
  createdAt: Date;
}

export interface Resource {
  id: string;
  capabilityId: string;
  uri: string;
  name: string;
  description: string | null;
  mimeType: string | null;
  schema: Record<string, unknown> | null;
  createdAt: Date;
}

export interface User {
  id: string;
  email: string;
  name: string;
  passwordHash: string | null;
  role: 'admin' | 'developer' | 'viewer';
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt: Date | null;
}

export interface ApiKey {
  id: string;
  userId: string;
  keyHash: string;
  name: string;
  permissions: Record<string, unknown> | null;
  expiresAt: Date | null;
  createdAt: Date;
  lastUsedAt: Date | null;
}

export interface AccessPolicy {
  id: string;
  serverId: string | null;
  capabilityId: string | null;
  userId: string | null;
  role: string | null;
  teamId: string | null;
  permission: 'discover' | 'view_details' | 'execute';
  createdAt: Date;
}

export interface HealthCheck {
  id: string;
  serverId: string;
  status: 'healthy' | 'unhealthy' | 'timeout' | 'error';
  responseTimeMs: number;
  statusCode: number | null;
  errorMessage: string | null;
  checkedAt: Date;
}

export interface AuditLog {
  id: string;
  userId: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  details: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
}
