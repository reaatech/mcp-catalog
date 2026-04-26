# Skill: React Component

## Purpose

Generate a new React component with TypeScript and Tailwind CSS for the mcp-catalog web UI. This skill covers creating reusable, accessible, and well-tested components.

## Prerequisites

- Project setup completed
- React app running
- Basic understanding of React and TypeScript
- Familiarity with Tailwind CSS

## Tools Required

- React 18+
- TypeScript
- Tailwind CSS
- Vite (build tool)
- Vitest + Testing Library (testing)

## Steps

### 1. Create Component Structure

Create a new component file in `apps/web/src/components/`:

```typescript
// apps/web/src/components/ServerCard.tsx
import React from 'react';
import { Link } from 'react-router-dom';
import { HealthBadge } from './HealthBadge';
import { CapabilityTags } from './CapabilityTags';

export interface ServerCardProps {
  id: string;
  name: string;
  description?: string;
  url: string;
  status: 'healthy' | 'unhealthy' | 'unknown';
  registeredAt: string;
  capabilities?: Array<{
    id: string;
    name: string;
    category: string;
    tags: string[];
  }>;
  healthCheckCount?: number;
  className?: string;
}

export const ServerCard: React.FC<ServerCardProps> = ({
  id,
  name,
  description,
  url,
  status,
  registeredAt,
  capabilities = [],
  healthCheckCount = 0,
  className = '',
}) => {
  const formattedDate = new Date(registeredAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  return (
    <div
      className={`bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200 ${className}`}
      data-testid="server-card"
    >
      {/* Card Header */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <Link
              to={`/servers/${id}`}
              className="text-lg font-semibold text-gray-900 hover:text-blue-600 transition-colors"
            >
              {name}
            </Link>
            {description && (
              <p className="mt-1 text-sm text-gray-600 line-clamp-2">
                {description}
              </p>
            )}
          </div>
          <HealthBadge status={status} className="ml-2 flex-shrink-0" />
        </div>
      </div>

      {/* Card Body */}
      <div className="p-4">
        {/* URL */}
        <div className="mb-3">
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 6H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
              />
            </svg>
            {new URL(url).hostname}
          </a>
        </div>

        {/* Capabilities */}
        {capabilities.length > 0 && (
          <div className="mb-3">
            <CapabilityTags capabilities={capabilities} />
          </div>
        )}

        {/* Meta Information */}
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>Registered {formattedDate}</span>
          {healthCheckCount > 0 && (
            <span>{healthCheckCount} health checks</span>
          )}
        </div>
      </div>

      {/* Card Footer */}
      <div className="px-4 py-3 bg-gray-50 rounded-b-lg">
        <Link
          to={`/servers/${id}`}
          className="text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors"
        >
          View Details →
        </Link>
      </div>
    </div>
  );
};
```

### 2. Create Supporting Components

Create `apps/web/src/components/HealthBadge.tsx`:

```typescript
import React from 'react';

export interface HealthBadgeProps {
  status: 'healthy' | 'unhealthy' | 'unknown';
  showLabel?: boolean;
  className?: string;
}

export const HealthBadge: React.FC<HealthBadgeProps> = ({
  status,
  showLabel = true,
  className = '',
}) => {
  const statusConfig = {
    healthy: {
      bgColor: 'bg-green-100',
      textColor: 'text-green-800',
      dotColor: 'bg-green-500',
      label: 'Healthy',
    },
    unhealthy: {
      bgColor: 'bg-red-100',
      textColor: 'text-red-800',
      dotColor: 'bg-red-500',
      label: 'Unhealthy',
    },
    unknown: {
      bgColor: 'bg-gray-100',
      textColor: 'text-gray-800',
      dotColor: 'bg-gray-500',
      label: 'Unknown',
    },
  };

  const config = statusConfig[status];

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${config.bgColor} ${config.textColor} ${className}`}
      data-testid="health-badge"
      data-status={status}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${config.dotColor}`} />
      {showLabel && config.label}
    </span>
  );
};
```

Create `apps/web/src/components/CapabilityTags.tsx`:

```typescript
import React from 'react';

export interface Capability {
  id: string;
  name: string;
  category: string;
  tags: string[];
}

export interface CapabilityTagsProps {
  capabilities: Capability[];
  maxDisplay?: number;
  className?: string;
}

export const CapabilityTags: React.FC<CapabilityTagsProps> = ({
  capabilities,
  maxDisplay = 3,
  className = '',
}) => {
  const displayCapabilities = capabilities.slice(0, maxDisplay);
  const remainingCount = capabilities.length - maxDisplay;

  const categoryColors: Record<string, string> = {
    database: 'bg-blue-100 text-blue-800',
    filesystem: 'bg-yellow-100 text-yellow-800',
    search: 'bg-purple-100 text-purple-800',
    crm: 'bg-green-100 text-green-800',
    default: 'bg-gray-100 text-gray-800',
  };

  return (
    <div className={`flex flex-wrap gap-1.5 ${className}`}>
      {displayCapabilities.map((cap) => {
        const colorClass =
          categoryColors[cap.category] || categoryColors.default;
        return (
          <span
            key={cap.id}
            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colorClass}`}
          >
            {cap.name}
          </span>
        );
      })}
      {remainingCount > 0 && (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
          +{remainingCount} more
        </span>
      )}
    </div>
  );
};
```

### 3. Add TypeScript Types

Create `apps/web/src/types/server.ts`:

```typescript
export interface Server {
  id: string;
  name: string;
  description?: string;
  url: string;
  healthEndpoint?: string;
  status: 'healthy' | 'unhealthy' | 'unknown';
  lastHealthCheck?: string;
  healthCheckInterval: number;
  registeredAt: string;
  updatedAt: string;
  registeredBy?: string;
  metadata?: Record<string, unknown>;
  capabilities?: Capability[];
}

export interface Capability {
  id: string;
  serverId: string;
  name: string;
  description?: string;
  category: string;
  tags: string[];
  schema?: Record<string, unknown>;
  createdAt: string;
  tools?: Tool[];
  resources?: Resource[];
}

export interface Tool {
  id: string;
  capabilityId: string;
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  createdAt: string;
}

export interface Resource {
  id: string;
  capabilityId: string;
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
  schema?: Record<string, unknown>;
  createdAt: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'developer' | 'viewer';
  createdAt: string;
  lastLoginAt?: string;
}

export interface HealthCheck {
  id: string;
  serverId: string;
  status: 'healthy' | 'unhealthy' | 'timeout' | 'error';
  responseTimeMs: number;
  statusCode?: number;
  errorMessage?: string;
  checkedAt: string;
}
```

### 4. Create Custom Hook

Create `apps/web/src/hooks/useServers.ts`:

```typescript
import { useState, useEffect, useCallback } from 'react';
import { Server } from '../types/server';

interface UseServersOptions {
  limit?: number;
  offset?: number;
  status?: 'healthy' | 'unhealthy' | 'unknown';
  category?: string;
  search?: string;
}

interface UseServersResult {
  servers: Server[];
  total: number;
  loading: boolean;
  error: Error | null;
  hasMore: boolean;
  loadMore: () => void;
  refresh: () => void;
}

export function useServers(options: UseServersOptions = {}): UseServersResult {
  const { limit = 20, offset = 0, status, category, search } = options;

  const [servers, setServers] = useState<Server[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchServers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (limit) params.append('limit', limit.toString());
      if (offset) params.append('offset', offset.toString());
      if (status) params.append('status', status);
      if (category) params.append('category', category);
      if (search) params.append('q', search);

      const response = await fetch(`/api/v1/servers?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch servers: ${response.statusText}`);
      }

      const data = await response.json();
      setServers(data.data || data);
      setTotal(data.pagination?.total || data.length);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('An error occurred'));
    } finally {
      setLoading(false);
    }
  }, [limit, offset, status, category, search]);

  useEffect(() => {
    fetchServers();
  }, [fetchServers]);

  const loadMore = useCallback(() => {
    // Implement load more logic
  }, []);

  const refresh = useCallback(() => {
    fetchServers();
  }, [fetchServers]);

  return {
    servers,
    total,
    loading,
    error,
    hasMore: servers.length < total,
    loadMore,
    refresh,
  };
}
```

### 5. Write Tests

Create `apps/web/src/components/ServerCard.test.tsx`:

```typescript
import React from 'react';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ServerCard, ServerCardProps } from './ServerCard';

const renderWithRouter = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      {component}
    </BrowserRouter>
  );
};

const mockServerProps: ServerCardProps = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  name: 'Test MCP Server',
  description: 'A test MCP server for demonstration',
  url: 'http://localhost:4000',
  status: 'healthy',
  registeredAt: '2024-01-15T10:30:00Z',
  capabilities: [
    {
      id: 'cap-1',
      name: 'Database Query',
      category: 'database',
      tags: ['sql', 'query'],
    },
    {
      id: 'cap-2',
      name: 'File System',
      category: 'filesystem',
      tags: ['files'],
    },
  ],
  healthCheckCount: 42,
};

describe('ServerCard', () => {
  it('should render server name and description', () => {
    renderWithRouter(<ServerCard {...mockServerProps} />);
    
    expect(screen.getByText('Test MCP Server')).toBeInTheDocument();
    expect(
      screen.getByText('A test MCP server for demonstration')
    ).toBeInTheDocument();
  });

  it('should render health badge with correct status', () => {
    renderWithRouter(<ServerCard {...mockServerProps} />);
    
    const healthBadge = screen.getByTestId('health-badge');
    expect(healthBadge).toHaveAttribute('data-status', 'healthy');
    expect(healthBadge).toHaveTextContent('Healthy');
  });

  it('should render server URL as link', () => {
    renderWithRouter(<ServerCard {...mockServerProps} />);
    
    const link = screen.getByText('localhost');
    expect(link).toHaveAttribute('href', 'http://localhost:4000');
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('should render capability tags', () => {
    renderWithRouter(<ServerCard {...mockServerProps} />);
    
    expect(screen.getByText('Database Query')).toBeInTheDocument();
    expect(screen.getByText('File System')).toBeInTheDocument();
  });

  it('should render registration date', () => {
    renderWithRouter(<ServerCard {...mockServerProps} />);
    
    expect(screen.getByText(/Registered/)).toBeInTheDocument();
  });

  it('should render health check count', () => {
    renderWithRouter(<ServerCard {...mockServerProps} />);
    
    expect(screen.getByText('42 health checks')).toBeInTheDocument();
  });

  it('should link to server details', () => {
    renderWithRouter(<ServerCard {...mockServerProps} />);
    
    const detailsLink = screen.getByText('View Details →');
    expect(detailsLink).toHaveAttribute(
      'href',
      `/servers/${mockServerProps.id}`
    );
  });

  it('should handle missing optional fields', () => {
    const minimalProps: ServerCardProps = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      name: 'Minimal Server',
      url: 'http://example.com',
      status: 'unknown',
      registeredAt: '2024-01-15T10:30:00Z',
    };

    renderWithRouter(<ServerCard {...minimalProps} />);
    
    expect(screen.getByText('Minimal Server')).toBeInTheDocument();
    expect(screen.queryByText(/description/i)).not.toBeInTheDocument();
  });
});
```

### 6. Add Storybook Story (Optional)

Create `apps/web/src/components/ServerCard.stories.tsx`:

```typescript
import type { Meta, StoryObj } from '@storybook/react';
import { ServerCard } from './ServerCard';

const meta: Meta<typeof ServerCard> = {
  title: 'Components/ServerCard',
  component: ServerCard,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
};

export default meta;
type Story = StoryObj<typeof ServerCard>;

export const Healthy: Story = {
  args: {
    id: '123e4567-e89b-12d3-a456-426614174000',
    name: 'Database MCP Server',
    description: 'Provides database query capabilities for PostgreSQL and MySQL',
    url: 'http://localhost:4000',
    status: 'healthy',
    registeredAt: '2024-01-15T10:30:00Z',
    capabilities: [
      {
        id: 'cap-1',
        name: 'PostgreSQL Query',
        category: 'database',
        tags: ['sql', 'postgresql'],
      },
    ],
    healthCheckCount: 150,
  },
};

export const Unhealthy: Story = {
  args: {
    ...Healthy.args,
    status: 'unhealthy',
    name: 'Failing Server',
  },
};

export const Unknown: Story = {
  args: {
    ...Healthy.args,
    status: 'unknown',
    name: 'New Server',
  },
};

export const Minimal: Story = {
  args: {
    id: '123e4567-e89b-12d3-a456-426614174001',
    name: 'Minimal Server',
    url: 'http://example.com',
    status: 'unknown',
    registeredAt: '2024-01-15T10:30:00Z',
  },
};

export const MultipleCapabilities: Story = {
  args: {
    ...Healthy.args,
    name: 'Multi-Purpose Server',
    capabilities: [
      { id: 'cap-1', name: 'Database', category: 'database', tags: ['sql'] },
      { id: 'cap-2', name: 'File System', category: 'filesystem', tags: ['files'] },
      { id: 'cap-3', name: 'Web Search', category: 'search', tags: ['web'] },
      { id: 'cap-4', name: 'CRM', category: 'crm', tags: ['salesforce'] },
      { id: 'cap-5', name: 'Analytics', category: 'analytics', tags: ['data'] },
    ],
  },
};
```

## Output

After completing this skill, you should have:

- A fully functional React component with TypeScript
- Supporting components (HealthBadge, CapabilityTags)
- TypeScript types for data models
- Custom hook for data fetching
- Comprehensive test coverage
- Storybook stories (optional)
- Responsive design with Tailwind CSS

## Verification

Test your component:

```bash
# Start development server
pnpm -F web dev

# Run tests
pnpm -F web test

# Check test coverage
pnpm -F web test --coverage

# View Storybook (if added)
pnpm -F web storybook
```

## Example Interaction

**User**: "Create a component to display MCP server information"

**Agent**:
1. Creates ServerCard component with all props
2. Creates supporting HealthBadge and CapabilityTags components
3. Defines TypeScript types
4. Creates useServers hook for data fetching
5. Writes comprehensive tests
6. Adds Storybook stories

**Expected Output**:
```
✅ ServerCard component created
✅ HealthBadge component created
✅ CapabilityTags component created
✅ TypeScript types defined
✅ useServers hook created
✅ Tests written (8 test cases)
✅ Storybook stories added (5 stories)

Test Results:
- ✓ should render server name and description
- ✓ should render health badge with correct status
- ✓ should render server URL as link
- ✓ should render capability tags
- ✓ should render registration date
- ✓ should render health check count
- ✓ should link to server details
- ✓ should handle missing optional fields

Coverage: 95%
```

## Best Practices

1. **Use TypeScript** for type safety
2. **Write tests** for all components
3. **Follow accessibility** guidelines (ARIA labels, keyboard navigation)
4. **Use semantic HTML** elements
5. **Implement responsive design** with Tailwind
6. **Keep components small** and focused
7. **Use composition** over configuration
8. **Add loading states** for async operations
9. **Handle errors gracefully**
10. **Document props** with JSDoc comments

## Component Patterns

### Container Component
```typescript
export const ServerList: React.FC = () => {
  const { servers, loading, error } = useServers();

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage error={error} />;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {servers.map((server) => (
        <ServerCard key={server.id} {...server} />
      ))}
    </div>
  );
};
```

### Form Component
```typescript
export const ServerForm: React.FC<{ onSubmit: (data: ServerData) => void }> = ({
  onSubmit,
}) => {
  const [formData, setFormData] = useState({
    name: '',
    url: '',
    description: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Form fields */}
    </form>
  );
};
```

### Modal Component
```typescript
export const Modal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}> = ({ isOpen, onClose, children }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="fixed inset-0 bg-black opacity-30" onClick={onClose} />
        <div className="relative bg-white rounded-lg p-6 max-w-md w-full">
          {children}
        </div>
      </div>
    </div>
  );
};
```

## Next Steps

After creating React components:

1. Integrate with API endpoints
2. Add state management (if needed)
3. Implement routing
4. Add authentication UI
5. Create admin dashboard
6. Add real-time updates (WebSocket)
