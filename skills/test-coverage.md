# Skill: Test Coverage

## Purpose

Write comprehensive tests for a module or feature in the mcp-catalog project. This skill covers unit tests, integration tests, and E2E tests with proper coverage reporting.

## Prerequisites

- Project setup completed
- Vitest configured
- Basic understanding of testing principles
- Familiarity with testing libraries

## Tools Required

- Vitest (test runner)
- @testing-library/react (for React components)
- @testing-library/node (for API tests)
- supertest (for HTTP testing)

## Steps

### 1. Unit Test Example

Create `apps/api/test/services/registry.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RegistryService } from '../../src/services/registry';
import { db } from '../../src/db';

vi.mock('../../src/db', () => ({
  db: {
    insert: vi.fn(),
    select: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('RegistryService', () => {
  let registryService: RegistryService;

  beforeEach(() => {
    registryService = new RegistryService();
    vi.clearAllMocks();
  });

  describe('createServer', () => {
    it('should create a new server', async () => {
      const serverData = {
        name: 'Test Server',
        url: 'http://localhost:4000',
        description: 'A test server',
      };

      const mockServer = { id: 'uuid', ...serverData, status: 'unknown' };
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockServer]),
        }),
      } as any);

      const result = await registryService.createServer(serverData);

      expect(result.name).toBe(serverData.name);
      expect(result.url).toBe(serverData.url);
      expect(result.status).toBe('unknown');
    });

    it('should throw error for duplicate server name', async () => {
      const serverData = { name: 'Existing Server', url: 'http://example.com' };
      
      vi.mocked(db.insert).mockRejectedValue(new Error('duplicate key value'));

      await expect(registryService.createServer(serverData)).rejects.toThrow(
        'Server name already exists'
      );
    });
  });

  describe('getServer', () => {
    it('should return server by ID', async () => {
      const mockServer = { id: 'uuid', name: 'Test Server', url: 'http://localhost:4000' };
      
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockServer]),
          }),
        }),
      } as any);

      const result = await registryService.getServer('uuid');

      expect(result).toEqual(mockServer);
    });

    it('should return null for non-existent server', async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);

      const result = await registryService.getServer('non-existent');

      expect(result).toBeNull();
    });
  });
});
```

### 2. Integration Test Example

Create `apps/api/test/integration/servers.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { buildServer } from '../utils/server';
import { db } from '../../src/db';
import { servers } from '../../src/db/schema';

describe('Servers API Integration', () => {
  let app: any;
  let testServer: any;

  beforeAll(async () => {
    app = await buildServer();
  });

  afterAll(async () => {
    if (testServer?.id) {
      await db.delete(servers).where(eq(servers.id, testServer.id));
    }
    await app.close();
  });

  describe('POST /api/v1/servers', () => {
    it('should create a new server', async () => {
      const response = await request(app.server)
        .post('/api/v1/servers')
        .send({
          name: 'Integration Test Server',
          url: 'http://localhost:4001',
          description: 'Created during integration test',
        })
        .expect(201);

      expect(response.body).toMatchObject({
        name: 'Integration Test Server',
        url: 'http://localhost:4001',
        status: 'unknown',
      });

      testServer = response.body;
    });

    it('should reject invalid server data', async () => {
      await request(app.server)
        .post('/api/v1/servers')
        .send({ name: 'Missing URL' })
        .expect(400);
    });
  });

  describe('GET /api/v1/servers', () => {
    it('should list all servers', async () => {
      const response = await request(app.server)
        .get('/api/v1/servers')
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBeGreaterThan(0);
    });

    it('should support pagination', async () => {
      const response = await request(app.server)
        .get('/api/v1/servers?limit=5&offset=0')
        .expect(200);

      expect(response.body.length).toBeLessThanOrEqual(5);
    });
  });

  describe('GET /api/v1/servers/:id', () => {
    it('should get server details', async () => {
      if (!testServer) return;

      const response = await request(app.server)
        .get(`/api/v1/servers/${testServer.id}`)
        .expect(200);

      expect(response.body.id).toBe(testServer.id);
      expect(response.body.name).toBe(testServer.name);
    });

    it('should return 404 for non-existent server', async () => {
      await request(app.server)
        .get('/api/v1/servers/00000000-0000-0000-0000-000000000000')
        .expect(404);
    });
  });
});
```

### 3. React Component Test Example

Create `apps/web/src/components/SearchBar.test.tsx`:

```typescript
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SearchBar } from './SearchBar';
import { BrowserRouter } from 'react-router-dom';

const renderWithRouter = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      {component}
    </BrowserRouter>
  );
};

describe('SearchBar', () => {
  it('should render search input', () => {
    renderWithRouter(<SearchBar />);
    
    expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument();
  });

  it('should call onSearch when submitting', async () => {
    const onSearch = vi.fn();
    renderWithRouter(<SearchBar onSearch={onSearch} />);

    const input = screen.getByPlaceholderText(/search/i);
    fireEvent.change(input, { target: { value: 'test query' } });
    fireEvent.submit(input);

    await waitFor(() => {
      expect(onSearch).toHaveBeenCalledWith('test query');
    });
  });

  it('should show autocomplete suggestions', async () => {
    const suggestions = ['database', 'filesystem', 'search'];
    renderWithRouter(<SearchBar suggestions={suggestions} />);

    const input = screen.getByPlaceholderText(/search/i);
    fireEvent.change(input, { target: { value: 'data' } });

    await waitFor(() => {
      expect(screen.getByText('database')).toBeInTheDocument();
    });
  });

  it('should clear input when clear button is clicked', () => {
    renderWithRouter(<SearchBar />);

    const input = screen.getByPlaceholderText(/search/i);
    fireEvent.change(input, { target: { value: 'test' } });
    
    const clearButton = screen.getByRole('button', { name: /clear/i });
    fireEvent.click(clearButton);

    expect(input).toHaveValue('');
  });
});
```

### 4. Configure Test Coverage

Update `apps/api/package.json`:

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  }
}
```

Create `apps/api/vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules',
        'test/**',
        'dist/**',
        '**/*.d.ts',
        '**/*.config.ts',
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80,
        },
      },
    },
  },
});
```

### 5. Run Tests and Generate Report

```bash
# Run all tests
pnpm test

# Run with coverage
pnpm test:coverage

# Run specific test file
pnpm test server.test.ts

# Run tests in watch mode
pnpm test:watch
```

## Output

After completing this skill, you should have:

- Comprehensive test suites for your code
- Unit tests for services and utilities
- Integration tests for API endpoints
- Component tests for React UI
- Coverage reports (HTML, JSON, text)
- Minimum 80% code coverage

## Verification

```bash
# Run tests
pnpm test

# Check coverage
pnpm test:coverage

# View HTML report
open apps/api/coverage/index.html
```

## Best Practices

1. **Test behavior, not implementation** - Focus on what code does
2. **Use descriptive test names** - Explain what and why
3. **Follow Arrange-Act-Assert pattern** - Keep tests organized
4. **Mock external dependencies** - Isolate units under test
5. **Test edge cases** - Null values, empty arrays, errors
6. **Keep tests independent** - No test should depend on another
7. **Clean up after tests** - Use beforeEach/afterEach
8. **Use test fixtures** - Reusable test data
9. **Aim for high coverage** - But prioritize critical paths
10. **Run tests frequently** - Catch issues early

## Coverage Thresholds

```json
{
  "coverage": {
    "thresholds": {
      "global": {
        "branches": 70,
        "functions": 80,
        "lines": 80,
        "statements": 80
      }
    }
  }
}
```

## Next Steps

After writing tests:

1. Set up CI/CD to run tests automatically
2. Add visual regression testing
3. Implement E2E tests with Playwright
4. Add performance testing
5. Set up test coverage badges
