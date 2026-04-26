import type { Prompt, GetPromptRequest } from '@modelcontextprotocol/sdk/types.js';
import { apiGet } from './lib/api-client.js';

interface CatalogServer {
  name: string;
  status: string;
  description?: string | null;
  url: string;
  capabilities?: { name: string }[];
}

interface CatalogCapability {
  name: string;
  category: string;
  description?: string | null;
}

export const prompts: Prompt[] = [
  {
    name: 'discover_tools',
    description: 'Help discover MCP tools for a specific use case or requirement',
    arguments: [
      {
        name: 'useCase',
        description: 'Describe what you want to accomplish (e.g., "query Salesforce data", "manage files")',
        required: true,
      },
    ],
  },
  {
    name: 'compare_servers',
    description: 'Compare capabilities of multiple MCP servers',
    arguments: [
      {
        name: 'serverIds',
        description: 'Comma-separated list of server IDs or names to compare',
        required: true,
      },
    ],
  },
];

export async function handlePrompt(request: GetPromptRequest) {
  const promptName = request.params.name;
  const args = request.params.arguments || {};

  switch (promptName) {
    case 'discover_tools': {
      const useCase = args.useCase;
      if (!useCase) {
        throw new Error('useCase argument is required');
      }

      const data = await apiGet(`/api/v1/search?q=${encodeURIComponent(useCase)}`);

      let description = `Based on your requirement: "${useCase}"\n\n`;
      description += 'Here are the relevant MCP servers and tools:\n\n';

      if (data.servers?.length) {
        (data.servers as CatalogServer[]).forEach((server) => {
          description += `**${server.name}** (${server.status})\n`;
          description += `${server.description || 'No description'}\n`;
          description += `\n`;
        });
      }

      if (data.capabilities?.length) {
        description += `\n## Matching Capabilities\n\n`;
        (data.capabilities as CatalogCapability[]).forEach((cap) => {
          description += `- **${cap.name}** (${cap.category})${cap.description ? ': ' + cap.description : ''}\n`;
        });
      }

      if (!data.servers?.length && !data.capabilities?.length) {
        description += 'No servers found matching your use case. Try describing it differently.\n';
      }

      return {
        description: `Tool discovery for: ${useCase}`,
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: description,
            },
          },
        ],
      };
    }

    case 'compare_servers': {
      const serverIds = args.serverIds;
      if (!serverIds) {
        throw new Error('serverIds argument is required');
      }

      const ids = String(serverIds).split(',').map(id => id.trim());
      let description = '# Server Comparison\n\n';

      for (const serverId of ids) {
        try {
          const server = await apiGet(`/api/v1/servers/${serverId}`) as CatalogServer;
          description += `## ${server.name} (${server.status})\n`;
          description += `${server.description || 'No description'}\n`;
          description += `URL: ${server.url}\n`;
          if (server.capabilities?.length) {
            description += `Capabilities:\n`;
            server.capabilities.forEach((cap) => {
              description += `- ${cap.name} (${(cap as CatalogCapability).category || 'unknown'})\n`;
            });
          }
          description += `\n`;
        } catch {
          description += `## ${serverId}\n`;
          description += `Server not found.\n\n`;
        }
      }

      return {
        description: `Comparison of servers: ${ids.join(', ')}`,
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: description,
            },
          },
        ],
      };
    }

    default:
      throw new Error(`Unknown prompt: ${promptName}`);
  }
}
