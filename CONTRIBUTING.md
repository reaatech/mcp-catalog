# Contributing to MCP Catalog

Thank you for your interest in contributing to MCP Catalog! This document provides guidelines and instructions for contributing to the project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [How to Contribute](#how-to-contribute)
- [Coding Standards](#coding-standards)
- [Testing](#testing)
- [Pull Request Process](#pull-request-process)
- [AI Agent Contributions](#ai-agent-contributions)

## Code of Conduct

Please be respectful and constructive in your interactions. We are committed to providing a welcoming and inclusive experience for everyone.

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 9+
- PostgreSQL 15+
- Git

### Setup

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/your-username/mcp-catalog.git
   cd mcp-catalog
   ```

3. Install dependencies:
   ```bash
   pnpm install
   ```

4. Set up environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

5. Run database migrations:
   ```bash
   pnpm -F api db:migrate
   ```

6. Start development servers:
   ```bash
   pnpm dev
   ```

## Development Workflow

### Branch Naming

Use descriptive branch names:
- `feature/description` - New features
- `fix/description` - Bug fixes
- `docs/description` - Documentation changes
- `refactor/description` - Code refactoring

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add search by capability category
fix: resolve health check timeout issue
docs: update API documentation
refactor: improve database query performance
test: add unit tests for registry service
```

## How to Contribute

### Reporting Bugs

1. Check existing issues first
2. Use the bug report template
3. Include:
   - Clear description
   - Steps to reproduce
   - Expected vs actual behavior
   - Environment details (OS, Node version, etc.)

### Suggesting Features

1. Check existing feature requests
2. Use the feature request template
3. Describe the use case and benefits

### Code Contributions

1. **Find an issue** - Check the issue tracker or create a new one
2. **Create a branch** - From the main branch
3. **Make changes** - Follow coding standards
4. **Write tests** - Ensure adequate test coverage
5. **Submit a PR** - Follow the pull request process

## Coding Standards

### TypeScript

- Use strict mode
- Define explicit types (avoid `any`)
- Use interfaces for object shapes
- Export types from index files

### Code Style

- **Formatting**: Prettier (automatic on commit)
- **Linting**: ESLint with TypeScript support
- **Imports**: Organized and grouped

```bash
# Check code style
pnpm lint

# Format code
pnpm format
```

### File Organization

```
apps/
  api/
    src/
      routes/       # API route handlers
      services/     # Business logic
      db/           # Database schema and migrations
      middleware/   # Express/Fastify middleware
      utils/        # Utility functions
  web/
    src/
      components/   # React components
      pages/        # Page components
      hooks/        # Custom React hooks
      utils/        # Utility functions
      types/        # TypeScript types
  mcp-server/
    src/
      tools/        # MCP tool implementations
      resources/    # MCP resources
      prompts/      # MCP prompts
packages/
  shared/
    src/
      types/        # Shared TypeScript types
      utils/        # Shared utilities
```

## Testing

### Running Tests

```bash
# Run all tests
pnpm test

# Run tests with coverage
pnpm test:coverage

# Run specific test file
pnpm test -- api.test.ts

# Run tests in watch mode
pnpm test:watch
```

### Test Coverage

- Minimum 80% coverage required
- Test critical paths thoroughly
- Include edge cases and error scenarios

### Writing Tests

```typescript
// Unit tests
describe('RegistryService', () => {
  it('should create a new server', async () => {
    // Arrange
    const serverData = { name: 'Test', url: 'http://test.com' };
    
    // Act
    const server = await registry.createServer(serverData);
    
    // Assert
    expect(server.name).toBe('Test');
  });
});
```

## Pull Request Process

1. **Update documentation** if needed
2. **Add tests** for new functionality
3. **Ensure all tests pass**:
   ```bash
   pnpm test
   pnpm lint
   pnpm typecheck
   ```
4. **Update CHANGELOG.md** with your changes
5. **Request review** from maintainers
6. **Address feedback** and update PR

### PR Checklist

- [ ] Code follows project standards
- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] No console errors or warnings
- [ ] All CI checks passing
- [ ] Commit messages are descriptive

### Review Process

1. **Automated checks** - CI runs tests, linting, type checking
2. **Code review** - Maintainers review for quality and consistency
3. **Approval** - At least one maintainer approval required
4. **Merge** - Squash and merge to keep history clean

## AI Agent Contributions

This project is designed to be developed with AI agent assistance. Agents can contribute using the predefined skills in the `skills/` directory.

### Using Agent Skills

1. **Discover skills**: Review available skills in `skills/`
2. **Follow the skill**: Each skill provides step-by-step instructions
3. **Report progress**: Use task_progress to track completion
4. **Submit changes**: Create a PR with your changes

### Available Skills

| Skill | Purpose |
|-------|---------|
| `project-setup.md` | Initialize project structure |
| `api-endpoint.md` | Create REST API endpoints |
| `database-migration.md` | Create database migrations |
| `react-component.md` | Generate React components |
| `mcp-tool.md` | Add MCP server tools |
| `health-check.md` | Implement health monitoring |
| `test-coverage.md` | Write comprehensive tests |
| `security-review.md` | Perform security audits |
| `performance-optimization.md` | Optimize performance |
| `documentation.md` | Generate documentation |
| `ci-cd-pipeline.md` | Set up CI/CD workflows |
| `docker-containerization.md` | Create Docker configurations |

### Agent Contribution Guidelines

1. **Use skills appropriately** - Follow the skill instructions
2. **Test your changes** - Run tests before submitting
3. **Document your work** - Update relevant documentation
4. **Communicate clearly** - Provide clear summaries of changes

### Example Agent Workflow

```
1. User requests: "Add a new API endpoint for server search"
2. Agent uses: skills/api-endpoint.md
3. Agent creates: Route, validation, service logic, tests
4. Agent reports: Summary of changes and test results
5. User reviews: Verifies changes and merges PR
```

## Questions?

If you have questions about contributing:

- Check existing documentation
- Search the issue tracker
- Ask in GitHub Discussions
- Contact maintainers directly

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to MCP Catalog! 🚀
