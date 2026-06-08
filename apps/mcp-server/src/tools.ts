import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { apiGet } from './lib/api-client.js';

// Zod schemas for runtime input validation
const searchSchema = z.object({
  q: z.string().min(1),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  status: z.enum(['healthy', 'unhealthy', 'unknown']).optional(),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
});

const getServerSchema = z.object({
  serverId: z.string().min(1),
});

const listCapabilitiesSchema = z.object({
  category: z.string().optional(),
  serverId: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).default(0),
});

const checkHealthSchema = z.object({
  serverId: z.string().min(1),
});

const getToolSchema = z.object({
  toolId: z.string().min(1),
  capabilityId: z.string().optional(),
});

interface CatalogServer {
  id: string;
  name: string;
  description?: string | null;
  url: string;
  status: string;
  registeredAt: string;
  lastHealthCheck?: string | null;
  healthCheckInterval?: number;
  metadata?: Record<string, unknown>;
  capabilities?: CatalogCapability[];
}

interface CatalogCapability {
  id: string;
  name: string;
  description?: string | null;
  category: string;
  tags: string[];
  serverId?: string;
  tools?: CatalogTool[];
}

interface CatalogTool {
  id: string;
  name: string;
  description?: string | null;
  inputSchema: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
}

interface HealthCheckRecord {
  serverId: string;
  status: string;
  responseTimeMs: number;
  statusCode?: number;
  errorMessage?: string;
  checkedAt: string;
}

export const tools: Tool[] = [
  {
    name: 'catalog_search',
    description: `Search the MCP catalog for servers and capabilities.

Use this tool to find MCP servers by capability, category, or keywords.
Perfect for discovering tools that can perform specific tasks like:
- "I need a tool that can query Salesforce"
- "Find database query tools"
- "Search for file system capabilities"

The search covers server names, descriptions, capability names, and tags.`,
    inputSchema: {
      type: 'object',
      properties: {
        q: {
          type: 'string',
          description: 'Search query - keywords to search for in server names, descriptions, and capabilities',
        },
        category: {
          type: 'string',
          description: 'Filter by category (e.g., "database", "filesystem", "search", "crm")',
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Filter by specific tags (e.g., ["sql", "postgresql"])',
        },
        status: {
          type: 'string',
          enum: ['healthy', 'unhealthy', 'unknown'],
          description: 'Filter by server health status',
        },
        limit: {
          type: 'number',
          minimum: 1,
          maximum: 100,
          default: 20,
          description: 'Maximum number of results to return',
        },
        offset: {
          type: 'number',
          minimum: 0,
          default: 0,
          description: 'Number of results to skip for pagination',
        },
      },
      required: ['q'],
    },
  },
  {
    name: 'catalog_get_server',
    description: `Get detailed information about a specific MCP server.

Use this tool to retrieve comprehensive details about a registered MCP server,
including its capabilities, tools, resources, and health status.

You can specify what additional information to include.`,
    inputSchema: {
      type: 'object',
      properties: {
        serverId: {
          type: 'string',
          description: 'Server ID (UUID) from catalog_search or catalog://servers',
        },
      },
      required: ['serverId'],
    },
  },
  {
    name: 'catalog_list_capabilities',
    description: `List all available capabilities in the MCP catalog.

Use this tool to browse what types of tools and services are available across all registered MCP servers.
Capabilities are grouped by category (database, filesystem, search, CRM, etc.).

This is useful when you want to explore what's available without a specific search query.`,
    inputSchema: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          description: 'Filter by category (e.g., "database", "filesystem", "search")',
        },
        serverId: {
          type: 'string',
          description: 'Filter by specific server ID',
        },
        limit: {
          type: 'number',
          minimum: 1,
          maximum: 100,
          default: 50,
          description: 'Maximum number of capabilities to return',
        },
        offset: {
          type: 'number',
          minimum: 0,
          default: 0,
          description: 'Number of capabilities to skip',
        },
      },
    },
  },
  {
    name: 'catalog_check_health',
    description: `Check the health status of a registered MCP server.

Use this tool to verify if a specific MCP server is currently operational and responding.
This will return the current status along with recent health history.

Useful for:
- Verifying a server is online before using its tools
- Monitoring server availability
- Troubleshooting connectivity issues`,
    inputSchema: {
      type: 'object',
      properties: {
        serverId: {
          type: 'string',
          description: 'Server ID (UUID) from catalog_search or catalog://servers',
        },
      },
      required: ['serverId'],
    },
  },
  {
    name: 'catalog_get_tool',
    description: `Get detailed information about a specific tool from the catalog.

Use this tool to retrieve comprehensive details about a tool's input/output schemas,
description, and which MCP server provides it.

This is useful when you need to understand how to use a specific tool or want to see
its exact input requirements and expected outputs.`,
    inputSchema: {
      type: 'object',
      properties: {
        toolId: {
          type: 'string',
          description: 'Tool ID or name to look up',
        },
        capabilityId: {
          type: 'string',
          description: 'Optional capability ID to narrow the search',
        },
      },
      required: ['toolId'],
    },
  },
];

export async function handleTool(name: string, args: Record<string, unknown>) {
  switch (name) {
    case 'catalog_search': {
      const parsed = searchSchema.safeParse(args);
      if (!parsed.success) {
        throw new Error(`Invalid arguments: ${parsed.error.message}`);
      }
      const { q, category, tags, status, limit, offset } = parsed.data;
      const params = new URLSearchParams();
      params.append('q', q);
      if (category) params.append('category', category);
      if (tags) tags.forEach((t) => params.append('tags', t));
      if (status) params.append('status', status);
      params.append('limit', String(limit));
      params.append('offset', String(offset));

      const data = await apiGet<{ servers?: CatalogServer[]; capabilities?: CatalogCapability[] }>(`/api/v1/search?${params.toString()}`);

      if (!data.servers?.length && !data.capabilities?.length) {
        return `No results found matching "${q}". Try different keywords or remove filters.`;
      }

      let result = `Search results for "${q}":\n\n`;

      if (data.servers?.length) {
        result += `## Servers (${data.servers.length})\n\n`;
        data.servers.forEach((server, i) => {
          result += `${i + 1}. **${server.name}** (${server.status})\n`;
          result += `   ${server.description || 'No description'}\n`;
          result += `   URL: ${server.url}\n\n`;
        });
      }

      if (data.capabilities?.length) {
        result += `## Capabilities (${data.capabilities.length})\n\n`;
        data.capabilities.forEach((cap, i) => {
          result += `${i + 1}. **${cap.name}** (${cap.category})\n`;
          result += `   ${cap.description || 'No description'}\n`;
          if (cap.tags?.length) result += `   Tags: ${cap.tags.join(', ')}\n`;
          result += `\n`;
        });
      }

      return result;
    }

    case 'catalog_get_server': {
      const parsed = getServerSchema.safeParse(args);
      if (!parsed.success) {
        throw new Error(`Invalid arguments: ${parsed.error.message}`);
      }
      const { serverId } = parsed.data;
      const server = await apiGet<CatalogServer>(`/api/v1/servers/${serverId}`);

      let result = `# ${server.name}\n\n`;
      result += `**Status:** ${server.status}\n`;
      result += `**URL:** ${server.url}\n`;
      if (server.description) result += `\n${server.description}\n`;
      result += `\n**Registered:** ${new Date(server.registeredAt).toLocaleDateString()}\n`;
      result += `**Last Health Check:** ${server.lastHealthCheck ? new Date(server.lastHealthCheck).toLocaleString() : 'Never'}\n`;

      if (server.capabilities?.length) {
        result += `\n## Capabilities (${server.capabilities.length})\n\n`;
        server.capabilities.forEach((cap) => {
          result += `### ${cap.name}\n`;
          result += `**Category:** ${cap.category}\n`;
          if (cap.description) result += `${cap.description}\n`;
          if (cap.tags?.length) result += `**Tags:** ${cap.tags.join(', ')}\n`;
          result += `\n`;
        });
      }

      if (server.metadata) {
        result += `\n## Metadata\n\n\`\`\`json\n${JSON.stringify(server.metadata, null, 2)}\n\`\`\`\n`;
      }

      return result;
    }

    case 'catalog_list_capabilities': {
      const parsed = listCapabilitiesSchema.safeParse(args);
      if (!parsed.success) {
        throw new Error(`Invalid arguments: ${parsed.error.message}`);
      }
      const { category, serverId, limit, offset } = parsed.data;
      const params = new URLSearchParams();
      if (category) params.append('category', category);
      if (serverId) params.append('serverId', serverId);
      params.append('limit', String(limit));
      params.append('offset', String(offset));

      const data = await apiGet<{ data: CatalogCapability[] }>(`/api/v1/capabilities?${params.toString()}`);
      const capabilities = data.data;

      if (capabilities.length === 0) {
        return category
          ? `No capabilities found in category "${category}".`
          : 'No capabilities found in the catalog.';
      }

      // Group by category
      const grouped: Record<string, CatalogCapability[]> = {};
      capabilities.forEach((cap) => {
        if (!grouped[cap.category]) grouped[cap.category] = [];
        grouped[cap.category].push(cap);
      });

      let result = `# Available Capabilities\n\n`;
      result += `Total: ${capabilities.length} capabilities\n\n`;

      Object.entries(grouped).forEach(([cat, caps]) => {
        result += `## ${cat.charAt(0).toUpperCase() + cat.slice(1)}\n\n`;
        caps.forEach((cap) => {
          result += `### ${cap.name}\n`;
          if (cap.description) result += `${cap.description}\n`;
          if (cap.tags?.length) result += `**Tags:** ${cap.tags.join(', ')}\n`;
          result += `\n`;
        });
      });

      return result;
    }

    case 'catalog_check_health': {
      const parsed = checkHealthSchema.safeParse(args);
      if (!parsed.success) {
        throw new Error(`Invalid arguments: ${parsed.error.message}`);
      }
      const { serverId } = parsed.data;

      const server = await apiGet<CatalogServer>(`/api/v1/servers/${serverId}`);
      const healthHistory = await apiGet<HealthCheckRecord[]>(`/health/history/${serverId}`).catch(() => []);

      let result = `# Health Check: ${server.name}\n\n`;
      result += `**Current Status:** ${server.status.toUpperCase()}\n`;
      result += `**Server URL:** ${server.url}\n`;
      if (server.lastHealthCheck) {
        const lastCheck = new Date(server.lastHealthCheck);
        const minutesAgo = Math.floor((Date.now() - lastCheck.getTime()) / 60000);
        result += `**Last Check:** ${lastCheck.toLocaleString()} (${minutesAgo} minutes ago)\n`;
      }

      result += '\n## Status Interpretation\n\n';
      switch (server.status) {
        case 'healthy':
          result += '✅ Server is operational and responding normally.\n';
          break;
        case 'unhealthy':
          result += '❌ Server is not responding or experiencing issues.\n';
          break;
        case 'unknown':
          result += '⚠️ Server status is unknown - no health checks have been performed yet.\n';
          break;
      }

      if (healthHistory.length > 0) {
        result += '\n## Recent Health Checks\n\n';
        result += '| Time | Status | Response Time |\n';
        result += '|------|--------|---------------|\n';
        healthHistory.slice(0, 5).forEach((check) => {
          const time = new Date(check.checkedAt).toLocaleTimeString();
          const emoji = check.status === 'healthy' ? '✅' : '❌';
          result += `| ${time} | ${emoji} ${check.status} | ${check.responseTimeMs}ms |\n`;
        });
      }

      return result;
    }

    case 'catalog_get_tool': {
      const parsed = getToolSchema.safeParse(args);
      if (!parsed.success) {
        throw new Error(`Invalid arguments: ${parsed.error.message}`);
      }
      const { toolId, capabilityId } = parsed.data;

      // First get the capability to find the tool
      let tool: CatalogTool | undefined;
      let cap: CatalogCapability | undefined;

      if (capabilityId) {
        cap = await apiGet<CatalogCapability>(`/api/v1/capabilities/${capabilityId}`);
        tool = cap.tools?.find((t) => t.id === toolId || t.name === toolId);
      } else {
        const caps = await apiGet<{ data: CatalogCapability[] }>('/api/v1/capabilities?limit=100');
        const capList = caps.data;
        const fullCaps = await Promise.all(
          capList.map((c) => apiGet<CatalogCapability>(`/api/v1/capabilities/${c.id}`))
        );
        for (const fullCap of fullCaps) {
          const found = fullCap.tools?.find((t) => t.id === toolId || t.name === toolId);
          if (found) {
            tool = found;
            cap = fullCap;
            break;
          }
        }
      }

      if (!tool || !cap) {
        throw new Error(`Tool "${toolId}" not found in the catalog`);
      }

      let result = `# Tool: ${tool.name}\n\n`;
      result += `**Description:** ${tool.description || 'No description provided'}\n`;
      result += `**Capability:** ${cap.name}\n`;
      result += `**Category:** ${cap.category}\n\n`;

      result += '## Input Schema\n\n```json\n';
      result += JSON.stringify(tool.inputSchema, null, 2);
      result += '\n```\n\n';

      if (tool.outputSchema) {
        result += '## Output Schema\n\n```json\n';
        result += JSON.stringify(tool.outputSchema, null, 2);
        result += '\n```\n\n';
      }

      return result;
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
