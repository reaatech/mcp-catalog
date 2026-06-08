import type { Resource, ReadResourceRequest } from '@modelcontextprotocol/sdk/types.js';
import { apiGet } from './lib/api-client.js';

export const resources: Resource[] = [
  {
    uri: 'catalog://servers',
    name: 'MCP Servers List',
    description: 'List of all registered MCP servers in the catalog',
    mimeType: 'application/json',
  },
  {
    uri: 'catalog://capabilities',
    name: 'Available Capabilities',
    description: 'List of all capabilities available in the catalog',
    mimeType: 'application/json',
  },
  {
    uri: 'catalog://categories',
    name: 'Capability Categories',
    description: 'List of all capability categories',
    mimeType: 'application/json',
  },
];

export async function handleResource(request: ReadResourceRequest) {
  const uri = request.params.uri;

  switch (uri) {
    case 'catalog://servers': {
      const data = await apiGet<{ data: Record<string, unknown>[] }>('/api/v1/servers?limit=100');
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(data.data || data, null, 2),
          },
        ],
      };
    }

    case 'catalog://capabilities': {
      const data = await apiGet<{ data: Record<string, unknown>[] }>('/api/v1/capabilities?limit=100');
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(data.data || data, null, 2),
          },
        ],
      };
    }

    case 'catalog://categories': {
      const data = await apiGet<{ data: { category: string }[] }>('/api/v1/capabilities?limit=100');
      const capabilities = data.data || [];
      const categories = [...new Set(capabilities.map((c) => c.category))].sort();
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(categories, null, 2),
          },
        ],
      };
    }

    default:
      throw new Error(`Unknown resource: ${uri}`);
  }
}
