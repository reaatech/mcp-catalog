# Skill: MCP Tool

## Purpose

Add a new tool to the MCP server interface for the mcp-catalog. This skill covers creating MCP tools that expose catalog functionality to AI agents, enabling dynamic discovery and interaction with registered MCP servers.

## Prerequisites

- Project setup completed
- MCP server running
- Basic understanding of the Model Context Protocol
- Familiarity with TypeScript

## Tools Required

- @modelcontextprotocol/sdk
- TypeScript
- Access to the catalog database/API

## Steps

### 1. Set Up MCP Server Structure

Create the MCP server entry point in `apps/mcp-server/src/index.ts`:

```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { catalogSearchTool } from './tools/search.js';
import { catalogGetServerTool } from './tools/getServer.js';
import { catalogListCapabilitiesTool } from './tools/listCapabilities.js';
import { catalogCheckHealthTool } from './tools/checkHealth.js';
import { catalogGetToolTool } from './tools/getTool.js';

// Define all available tools
const TOOLS: Tool[] = [
  catalogSearchTool,
  catalogGetServerTool,
  catalogListCapabilitiesTool,
  catalogCheckHealthTool,
  catalogGetToolTool,
];

// Tool handlers
const TOOL_HANDLERS: Record<
  string,
  (args: Record<string, unknown>) => Promise<unknown>
> = {
  catalog_search: catalogSearchTool.handler,
  catalog_get_server: catalogGetServerTool.handler,
  catalog_list_capabilities: catalogListCapabilitiesTool.handler,
  catalog_check_health: catalogCheckHealthTool.handler,
  catalog_get_tool: catalogGetToolTool.handler,
};

async function main() {
  const server = new Server(
    {
      name: 'mcp-catalog',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
        resources: {},
        prompts: {},
      },
    }
  );

  // List tools handler
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools: TOOLS };
  });

  // Call tool handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    
    if (!TOOL_HANDLERS[name]) {
      throw new Error(`Unknown tool: ${name}`);
    }

    try {
      const result = await TOOL_HANDLERS[name](args || {});
      return {
        content: [
          {
            type: 'text',
            text: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error executing ${name}: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        isError: true,
      };
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  console.error('MCP Catalog server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
```

### 2. Create a Search Tool

Create `apps/mcp-server/src/tools/search.ts`:

```typescript
import { Tool } from '@modelcontextprotocol/sdk/types.js';

export interface CatalogSearchArgs {
  q: string;
  category?: string;
  tags?: string[];
  status?: 'healthy' | 'unhealthy' | 'unknown';
  limit?: number;
  offset?: number;
}

export const catalogSearchTool: Tool & { handler: (args: CatalogSearchArgs) => Promise<unknown> } = {
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

  handler: async (args: CatalogSearchArgs) => {
    const { q, category, tags, status, limit = 20, offset = 0 } = args;

    // Build query parameters
    const params = new URLSearchParams();
    params.append('q', q);
    if (category) params.append('category', category);
    if (tags) tags.forEach(tag => params.append('tags', tag));
    if (status) params.append('status', status);
    params.append('limit', limit.toString());
    params.append('offset', offset.toString());

    // Call catalog API
    const catalogUrl = process.env.CATALOG_API_URL || 'http://localhost:3000';
    const response = await fetch(`${catalogUrl}/api/v1/search?${params.toString()}`);

    if (!response.ok) {
      throw new Error(`Search failed: ${response.statusText}`);
    }

    const data = await response.json();

    // Format results for display
    if (!data.results || data.results.length === 0) {
      return `No servers found matching "${q}". Try different keywords or remove filters.`;
    }

    let resultText = `Found ${data.total || data.results.length} server(s) matching "${q}":\n\n`;

    data.results.forEach((server: any, index: number) => {
      resultText += `${index + 1}. **${server.name}** (${server.status})\n`;
      resultText += `   ${server.description || 'No description'}\n`;
      resultText += `   URL: ${server.url}\n`;
      
      if (server.capabilities && server.capabilities.length > 0) {
        resultText += `   Capabilities: ${server.capabilities.map((c: any) => c.name).join(', ')}\n`;
      }
      
      if (server.tags && server.tags.length > 0) {
        resultText += `   Tags: ${server.tags.join(', ')}\n`;
      }
      
      resultText += '\n';
    });

    // Add pagination info
    if (data.pagination?.hasMore) {
      resultText += `Showing ${data.results.length} of ${data.total} results. Use offset parameter to see more.`;
    }

    return resultText;
  },
};
```

### 3. Create Get Server Details Tool

Create `apps/mcp-server/src/tools/getServer.ts`:

```typescript
import { Tool } from '@modelcontextprotocol/sdk/types.js';

export interface CatalogGetServerArgs {
  serverId: string;
  include?: 'capabilities' | 'tools' | 'resources' | 'all';
}

export const catalogGetServerTool: Tool & { handler: (args: CatalogGetServerArgs) => Promise<unknown> } = {
  name: 'catalog_get_server',
  description: `Get detailed information about a specific MCP server.

Use this tool to retrieve comprehensive details about a registered MCP server,
including its capabilities, tools, resources, and health status.

You can specify what additional information to include:
- 'capabilities': Include capability definitions
- 'tools': Include tool schemas and descriptions
- 'resources': Include resource definitions
- 'all': Include everything

Example: "Get details for the Salesforce MCP server with all capabilities"`,
  
  inputSchema: {
    type: 'object',
    properties: {
      serverId: {
        type: 'string',
        description: 'Server ID (UUID) or server name',
      },
      include: {
        type: 'string',
        enum: ['capabilities', 'tools', 'resources', 'all'],
        description: 'Additional information to include in the response',
      },
    },
    required: ['serverId'],
  },

  handler: async (args: CatalogGetServerArgs) => {
    const { serverId, include } = args;

    const catalogUrl = process.env.CATALOG_API_URL || 'http://localhost:3000';
    const params = include ? `?include=${include}` : '';
    
    const response = await fetch(`${catalogUrl}/api/v1/servers/${serverId}${params}`);

    if (response.status === 404) {
      throw new Error(`Server "${serverId}" not found in the catalog`);
    }

    if (!response.ok) {
      throw new Error(`Failed to get server details: ${response.statusText}`);
    }

    const server = await response.json();

    let resultText = `# ${server.name}\n\n`;
    resultText += `**Status:** ${server.status}\n`;
    resultText += `**URL:** ${server.url}\n`;
    
    if (server.description) {
      resultText += `\n${server.description}\n`;
    }

    resultText += `\n**Registered:** ${new Date(server.registeredAt).toLocaleDateString()}\n`;
    resultText += `**Last Health Check:** ${server.lastHealthCheck ? new Date(server.lastHealthCheck).toLocaleString() : 'Never'}\n`;

    if (server.capabilities && server.capabilities.length > 0) {
      resultText += `\n## Capabilities (${server.capabilities.length})\n\n`;
      
      server.capabilities.forEach((cap: any) => {
        resultText += `### ${cap.name}\n`;
        resultText += `**Category:** ${cap.category}\n`;
        
        if (cap.description) {
          resultText += `${cap.description}\n`;
        }

        if (cap.tags && cap.tags.length > 0) {
          resultText += `**Tags:** ${cap.tags.join(', ')}\n`;
        }

        if (cap.tools && cap.tools.length > 0) {
          resultText += `\n**Tools:**\n`;
          cap.tools.forEach((tool: any) => {
            resultText += `- ${tool.name}: ${tool.description || 'No description'}\n`;
          });
        }

        resultText += '\n';
      });
    }

    if (server.metadata) {
      resultText += `\n## Metadata\n\`\`\`json\n${JSON.stringify(server.metadata, null, 2)}\n\`\`\`\n`;
    }

    return resultText;
  },
};
```

### 4. Create List Capabilities Tool

Create `apps/mcp-server/src/tools/listCapabilities.ts`:

```typescript
import { Tool } from '@modelcontextprotocol/sdk/types.js';

export interface CatalogListCapabilitiesArgs {
  category?: string;
  limit?: number;
  offset?: number;
}

export const catalogListCapabilitiesTool: Tool & { handler: (args: CatalogListCapabilitiesArgs) => Promise<unknown> } = {
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

  handler: async (args: CatalogListCapabilitiesArgs) => {
    const { category, limit = 50, offset = 0 } = args;

    const catalogUrl = process.env.CATALOG_API_URL || 'http://localhost:3000';
    const params = new URLSearchParams();
    if (category) params.append('category', category);
    params.append('limit', limit.toString());
    params.append('offset', offset.toString());

    const response = await fetch(`${catalogUrl}/api/v1/capabilities?${params.toString()}`);

    if (!response.ok) {
      throw new Error(`Failed to list capabilities: ${response.statusText}`);
    }

    const data = await response.json();
    const capabilities = data.data || data;

    if (capabilities.length === 0) {
      return category 
        ? `No capabilities found in category "${category}".`
        : 'No capabilities found in the catalog.';
    }

    // Group by category
    const grouped: Record<string, any[]> = {};
    capabilities.forEach((cap: any) => {
      if (!grouped[cap.category]) {
        grouped[cap.category] = [];
      }
      grouped[cap.category].push(cap);
    });

    let resultText = `# Available Capabilities\n\n`;
    resultText += `Total: ${capabilities.length} capabilities\n\n`;

    Object.entries(grouped).forEach(([category, caps]) => {
      resultText += `## ${category.charAt(0).toUpperCase() + category.slice(1)}\n\n`;
      
      caps.forEach((cap: any) => {
        resultText += `### ${cap.name}\n`;
        resultText += `**Server:** ${cap.server?.name || cap.serverId}\n`;
        
        if (cap.description) {
          resultText += `${cap.description}\n`;
        }

        if (cap.tags && cap.tags.length > 0) {
          resultText += `**Tags:** ${cap.tags.join(', ')}\n`;
        }

        resultText += '\n';
      });
    });

    return resultText;
  },
};
```

### 5. Create Health Check Tool

Create `apps/mcp-server/src/tools/checkHealth.ts`:

```typescript
import { Tool } from '@modelcontextprotocol/sdk/types.js';

export interface CatalogCheckHealthArgs {
  serverId: string;
}

export const catalogCheckHealthTool: Tool & { handler: (args: CatalogCheckHealthArgs) => Promise<unknown> } = {
  name: 'catalog_check_health',
  description: `Check the health status of a registered MCP server.

Use this tool to verify if a specific MCP server is currently operational and responding.
This will perform a health check and return the current status along with recent health history.

Useful for:
- Verifying a server is online before using its tools
- Monitoring server availability
- Troubleshooting connectivity issues`,
  
  inputSchema: {
    type: 'object',
    properties: {
      serverId: {
        type: 'string',
        description: 'Server ID (UUID) or server name to check',
      },
    },
    required: ['serverId'],
  },

  handler: async (args: CatalogCheckHealthArgs) => {
    const { serverId } = args;

    const catalogUrl = process.env.CATALOG_API_URL || 'http://localhost:3000';

    // First get server details
    const serverResponse = await fetch(`${catalogUrl}/api/v1/servers/${serverId}`);
    
    if (!serverResponse.ok) {
      throw new Error(`Server "${serverId}" not found`);
    }

    const server = await serverResponse.json();

    // Get health check history
    let healthHistory = [];
    try {
      const healthResponse = await fetch(`${catalogUrl}/api/v1/health/history/${serverId}`);
      if (healthResponse.ok) {
        healthHistory = await healthResponse.json();
      }
    } catch (e) {
      // Health history not available
    }

    let resultText = `# Health Check: ${server.name}\n\n`;
    resultText += `**Current Status:** ${server.status.toUpperCase()}\n`;
    resultText += `**Server URL:** ${server.url}\n`;
    
    if (server.lastHealthCheck) {
      const lastCheck = new Date(server.lastHealthCheck);
      const minutesAgo = Math.floor((Date.now() - lastCheck.getTime()) / 60000);
      resultText += `**Last Check:** ${lastCheck.toLocaleString()} (${minutesAgo} minutes ago)\n`;
    }

    if (server.healthEndpoint) {
      resultText += `**Health Endpoint:** ${server.healthEndpoint}\n`;
    }

    // Status interpretation
    resultText += '\n## Status Interpretation\n\n';
    switch (server.status) {
      case 'healthy':
        resultText += '✅ Server is operational and responding normally.\n';
        break;
      case 'unhealthy':
        resultText += '❌ Server is not responding or experiencing issues.\n';
        break;
      case 'unknown':
        resultText += '⚠️ Server status is unknown - no health checks have been performed yet.\n';
        break;
    }

    // Recent health history
    if (healthHistory.length > 0) {
      resultText += '\n## Recent Health Checks\n\n';
      resultText += '| Time | Status | Response Time |\n';
      resultText += '|------|--------|---------------|\n';
      
      healthHistory.slice(0, 5).forEach((check: any) => {
        const time = new Date(check.checkedAt).toLocaleTimeString();
        const statusEmoji = check.status === 'healthy' ? '✅' : '❌';
        resultText += `| ${time} | ${statusEmoji} ${check.status} | ${check.responseTimeMs}ms |\n`;
      });
    }

    return resultText;
  },
};
```

### 6. Create Get Tool Details

Create `apps/mcp-server/src/tools/getTool.ts`:

```typescript
import { Tool } from '@modelcontextprotocol/sdk/types.js';

export interface CatalogGetToolArgs {
  toolId: string;
  serverId?: string;
}

export const catalogGetToolTool: Tool & { handler: (args: CatalogGetToolArgs) => Promise<unknown> } = {
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
      serverId: {
        type: 'string',
        description: 'Optional server ID to narrow the search',
      },
    },
    required: ['toolId'],
  },

  handler: async (args: CatalogGetToolArgs) => {
    const { toolId, serverId } = args;

    const catalogUrl = process.env.CATALOG_API_URL || 'http://localhost:3000';
    const params = serverId ? `?serverId=${serverId}` : '';
    
    const response = await fetch(`${catalogUrl}/api/v1/tools/${toolId}${params}`);

    if (response.status === 404) {
      throw new Error(`Tool "${toolId}" not found in the catalog`);
    }

    if (!response.ok) {
      throw new Error(`Failed to get tool details: ${response.statusText}`);
    }

    const tool = await response.json();

    let resultText = `# Tool: ${tool.name}\n\n`;
    resultText += `**Description:** ${tool.description || 'No description provided'}\n`;
    resultText += `**Server:** ${tool.server?.name || tool.serverId}\n`;
    resultText += `**Category:** ${tool.capability?.category || 'Unknown'}\n\n`;

    resultText += '## Input Schema\n\n```json\n';
    resultText += JSON.stringify(tool.inputSchema, null, 2);
    resultText += '\n```\n\n';

    if (tool.outputSchema) {
      resultText += '## Output Schema\n\n```json\n';
      resultText += JSON.stringify(tool.outputSchema, null, 2);
      resultText += '\n```\n\n';
    }

    if (tool.capability?.tags && tool.capability.tags.length > 0) {
      resultText += `**Tags:** ${tool.capability.tags.join(', ')}\n`;
    }

    return resultText;
  },
};
```

### 7. Add MCP Resources (Optional)

Create `apps/mcp-server/src/resources.ts`:

```typescript
import { Resource } from '@modelcontextprotocol/sdk/types.js';

export const catalogResources: Resource[] = [
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

export async function readResource(uri: string): Promise<string> {
  const catalogUrl = process.env.CATALOG_API_URL || 'http://localhost:3000';
  
  let endpoint: string;
  switch (uri) {
    case 'catalog://servers':
      endpoint = '/api/v1/servers';
      break;
    case 'catalog://capabilities':
      endpoint = '/api/v1/capabilities';
      break;
    case 'catalog://categories':
      endpoint = '/api/v1/categories';
      break;
    default:
      throw new Error(`Unknown resource: ${uri}`);
  }

  const response = await fetch(`${catalogUrl}${endpoint}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch resource: ${response.statusText}`);
  }

  return response.text();
}
```

### 8. Add MCP Prompts (Optional)

Create `apps/mcp-server/src/prompts.ts`:

```typescript
import { Prompt } from '@modelcontextprotocol/sdk/types.js';

export const catalogPrompts: Prompt[] = [
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

export async function getPrompt(promptName: string, args: Record<string, string>): Promise<string> {
  const catalogUrl = process.env.CATALOG_API_URL || 'http://localhost:3000';

  switch (promptName) {
    case 'discover_tools': {
      const useCase = args.useCase;
      const response = await fetch(`${catalogUrl}/api/v1/search?q=${encodeURIComponent(useCase)}`);
      const data = await response.json();

      let result = `Based on your requirement: "${useCase}"\n\n`;
      result += 'Here are the relevant MCP servers and tools:\n\n';

      data.results?.forEach((server: any) => {
        result += `**${server.name}**\n`;
        result += `${server.description || 'No description'}\n`;
        if (server.capabilities?.length > 0) {
          result += `Capabilities: ${server.capabilities.map((c: any) => c.name).join(', ')}\n`;
        }
        result += '\n';
      });

      return result;
    }

    case 'compare_servers': {
      const serverIds = args.serverIds.split(',').map(id => id.trim());
      let result = '# Server Comparison\n\n';

      for (const serverId of serverIds) {
        const response = await fetch(`${catalogUrl}/api/v1/servers/${serverId}?include=all`);
        if (response.ok) {
          const server = await response.json();
          result += `## ${server.name} (${server.status})\n`;
          result += `${server.description || 'No description'}\n`;
          result += `Capabilities: ${server.capabilities?.map((c: any) => c.name).join(', ') || 'None'}\n\n`;
        }
      }

      return result;
    }

    default:
      throw new Error(`Unknown prompt: ${promptName}`);
  }
}
```

## Output

After completing this skill, you should have:

- A fully functional MCP server with multiple tools
- Catalog search functionality
- Server details retrieval
- Capability listing
- Health checking
- Tool details lookup
- Optional resources and prompts
- Proper error handling and user-friendly output

## Verification

Test your MCP server:

```bash
# Build the MCP server
pnpm -F mcp-server build

# Test the server
node apps/mcp-server/dist/index.js

# Or use the MCP inspector
npx @modelcontextprotocol/inspector
```

## Example Interaction

**User**: "Add tools to expose the catalog via MCP"

**Agent**:
1. Sets up MCP server structure
2. Creates catalog_search tool
3. Creates catalog_get_server tool
4. Creates catalog_list_capabilities tool
5. Creates catalog_check_health tool
6. Creates catalog_get_tool tool
7. Adds optional resources and prompts
8. Tests all tools

**Expected Output**:
```
✅ MCP server structure created
✅ catalog_search tool created
✅ catalog_get_server tool created
✅ catalog_list_capabilities tool created
✅ catalog_check_health tool created
✅ catalog_get_tool tool created
✅ Resources added (3 resources)
✅ Prompts added (2 prompts)

Tools available:
- catalog_search: Search for servers by keywords
- catalog_get_server: Get server details
- catalog_list_capabilities: Browse all capabilities
- catalog_check_health: Check server health
- catalog_get_tool: Get tool details

Resources available:
- catalog://servers: List of all servers
- catalog://capabilities: Available capabilities
- catalog://categories: Capability categories

Prompts available:
- discover_tools: Help discover tools for use cases
- compare_servers: Compare multiple servers
```

## Best Practices

1. **Provide clear descriptions** - Help users understand what each tool does
2. **Use proper JSON Schema** - Define input parameters clearly
3. **Handle errors gracefully** - Return helpful error messages
4. **Format output for readability** - Use markdown formatting
5. **Include examples** - Show how to use each tool
6. **Validate inputs** - Check parameters before processing
7. **Cache when appropriate** - Reduce API calls
8. **Rate limit** - Prevent abuse
9. **Log usage** - Track tool usage for analytics
10. **Version your tools** - Plan for future changes

## Next Steps

After creating MCP tools:

1. Add authentication to tools
2. Implement caching for better performance
3. Add more specialized tools
4. Create tool chains/workflows
5. Add real-time notifications
6. Implement tool analytics
