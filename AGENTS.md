# MCP Catalog — AI Agent Development Guide

## Project Information

- **Project**: mcp-catalog
- **GitHub**: [reaatech/mcp-catalog](https://github.com/reaatech/mcp-catalog)
- **License**: MIT
- **Stack**: TypeScript, pnpm, Fastify, PostgreSQL, React, MCP

## Welcome, AI Agents!

This project is designed to be developed with the assistance of AI agents. We leverage the **Model Context Protocol (MCP)** to enable agents to discover and utilize tools dynamically. In fact, this project *is* a catalog of MCP servers, so agents can discover other agents' tools through the catalog itself!

## Agent Skills

We've created a `skills/` directory containing reusable agent skills — predefined workflows and capabilities that agents can use to contribute to this project. Each skill is a markdown file that describes:

- **Purpose**: What the skill accomplishes
- **Prerequisites**: What's needed before using the skill
- **Steps**: Detailed workflow instructions
- **Tools**: MCP tools or other utilities required
- **Examples**: Sample interactions and outputs

### Available Skills

| Skill | Description |
|-------|-------------|
| [`project-setup.md`](skills/project-setup.md) | Initialize a new mcp-catalog project from scratch |
| [`api-endpoint.md`](skills/api-endpoint.md) | Create a new REST API endpoint with validation and documentation |
| [`database-migration.md`](skills/database-migration.md) | Create and apply database migrations with Drizzle ORM |
| [`react-component.md`](skills/react-component.md) | Generate a new React component with TypeScript and Tailwind CSS |
| [`mcp-tool.md`](skills/mcp-tool.md) | Add a new tool to the MCP server interface |
| [`health-check.md`](skills/health-check.md) | Implement health monitoring for a registered MCP server |
| [`test-coverage.md`](skills/test-coverage.md) | Write comprehensive tests for a module or feature |
| [`security-review.md`](skills/security-review.md) | Perform security audit on code changes |
| [`performance-optimization.md`](skills/performance-optimization.md) | Analyze and optimize performance bottlenecks |
| [`documentation.md`](skills/documentation.md) | Generate documentation for APIs, components, or features |
| [`ci-cd-pipeline.md`](skills/ci-cd-pipeline.md) | Set up CI/CD workflows for automated testing and deployment |
| [`docker-containerization.md`](skills/docker-containerization.md) | Create Docker configurations for services |

## How to Use Agent Skills

### For AI Agents

1. **Discover Available Skills**: Use the MCP catalog's own tools to search for relevant skills
2. **Read the Skill**: Load the skill markdown file to understand the workflow
3. **Execute the Skill**: Follow the steps, using MCP tools as needed
4. **Report Progress**: Update task progress and communicate outcomes

### For Human Developers

1. **Request a Skill**: Ask an AI agent to perform a task using a specific skill
2. **Review the Output**: Agents should provide clear summaries of what was done
3. **Validate Changes**: Run tests and review code before merging

## MCP Integration

This project exposes its own catalog as an MCP server, which means AI agents can:

- **Search** for registered MCP servers by capability
- **Discover** tools and resources available in the ecosystem
- **Monitor** health status of services
- **Execute** tools from other MCP servers dynamically

### Example Agent Workflow

```
1. Agent needs to find a tool that queries databases
2. Agent uses `catalog_search` MCP tool with query "database"
3. Catalog returns list of MCP servers with database capabilities
4. Agent selects appropriate server and uses its tools
5. Agent completes the task using discovered capabilities
```

## Development Workflow

### Phase-Based Development

Follow the phases outlined in [`DEV_PLAN.md`](DEV_PLAN.md):

- **Phase 1**: Foundation (Week 1-2)
- **Phase 2**: Core Features (Week 3-4)
- **Phase 3**: Web UI (Week 5-6)
- **Phase 4**: MCP Server Integration (Week 7)
- **Phase 5**: Polish & Production (Week 8)

### Contribution Guidelines

1. **Create a Feature Branch**: `git checkout -b feature/your-feature`
2. **Use Agent Skills**: Leverage relevant skills for your task
3. **Write Tests**: Ensure test coverage for new code
4. **Update Documentation**: Keep docs in sync with changes
5. **Submit a PR**: Request review from maintainers
6. **CI Checks**: Ensure all automated checks pass
7. **Merge**: After approval, merge to main

### Code Quality

- **TypeScript**: Strict mode enabled
- **Formatting**: Prettier with project config
- **Linting**: ESLint with TypeScript support
- **Testing**: Vitest with minimum 80% coverage
- **Security**: Automated security scanning in CI

## Communication

### Task Progress Tracking

Agents should use the `SetTodoList` tool to track progress across skills:

1. Initialize a todo list at the start of a multi-step task
2. Update item statuses as work completes
3. Query the list to communicate current state to users

### Completion Reports

When finishing a task, agents should provide:

- **Summary**: What was accomplished
- **Files Changed**: List of modified/created files
- **Testing**: Test results and coverage
- **Next Steps**: Recommended follow-up actions

## Resources

- **Main Plan**: [`DEV_PLAN.md`](DEV_PLAN.md)
- **Skills Directory**: [`skills/`](skills/)
- **Contributing Guidelines**: [`CONTRIBUTING.md`](CONTRIBUTING.md)
- **GitHub Repository**: [reaatech/mcp-catalog](https://github.com/reaatech/mcp-catalog)
- **MCP Documentation**: [Model Context Protocol](https://modelcontextprotocol.io/)

## License

This project is licensed under the MIT License. See the LICENSE file for details.

---

**Happy developing with AI agents! 🚀**
