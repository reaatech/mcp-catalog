# Skill: Security Review

## Purpose

Perform a security audit on code changes in the mcp-catalog project. This skill covers identifying vulnerabilities, checking for common security issues, and ensuring compliance with security best practices.

## Prerequisites

- Code changes ready for review
- Basic understanding of OWASP Top 10
- Familiarity with security scanning tools
- Access to codebase

## Tools Required

- npm audit / pnpm audit
- ESLint with security plugins
- Snyk (optional)
- OWASP Dependency Check
- Semgrep (optional)

## Steps

### 1. Dependency Security Audit

```bash
# Check for vulnerable dependencies
pnpm audit

# For more detailed analysis
pnpm audit --audit-level moderate

# Review vulnerable dependencies (pnpm does not have an automated fix command)
# Manually update packages identified by audit, then:
pnpm update

# For breaking changes, review changelogs before updating
```

### 2. Code Security Review Checklist

#### Authentication & Authorization
- [ ] All sensitive endpoints require authentication
- [ ] API keys are properly hashed (bcrypt/scrypt)
- [ ] JWT tokens have appropriate expiration
- [ ] Role-based access control is enforced
- [ ] No hardcoded credentials

#### Input Validation
- [ ] All user inputs are validated with Zod schemas
- [ ] SQL injection prevention (parameterized queries)
- [ ] XSS prevention (output encoding)
- [ ] CSRF protection enabled
- [ ] File upload validation (type, size, content)

#### Data Protection
- [ ] Sensitive data is encrypted at rest
- [ ] TLS/HTTPS enforced in production
- [ ] No sensitive data in logs
- [ ] API keys not exposed in client code
- [ ] Proper CORS configuration

#### Session Management
- [ ] Secure session configuration
- [ ] Session timeout implemented
- [ ] Session invalidation on logout
- [ ] No session fixation vulnerabilities

### 3. Automated Security Scanning

Create `scripts/security-scan.sh`:

```bash
#!/bin/bash

echo "🔒 Running Security Scan..."

# 1. Dependency audit
echo "📦 Checking dependencies..."
pnpm audit --audit-level moderate

# 2. ESLint security plugin
echo "🔍 Running ESLint security..."
pnpm exec eslint --plugin security .

# 3. Check for secrets in code
echo "🔑 Scanning for secrets..."
pnpm exec gitleaks detect --source . --report-path gitleaks-report.json

# 4. SAST with Semgrep (if installed)
if command -v semgrep &> /dev/null; then
    echo "🔬 Running Semgrep SAST..."
    semgrep --config=auto --error
fi

echo "✅ Security scan complete!"
```

### 4. Manual Security Review

#### Review Authentication Flow
```typescript
// ❌ Bad: No authentication
fastify.get('/api/v1/admin/users', async (request, reply) => {
  // Anyone can access this
});

// ✅ Good: Requires authentication and admin role
fastify.get('/api/v1/admin/users', {
  onRequest: [fastify.authenticate, fastify.requireAdmin]
}, async (request, reply) => {
  // Only authenticated admins can access
});
```

#### Review Input Validation
```typescript
// ❌ Bad: No validation
fastify.post('/api/v1/servers', async (request, reply) => {
  const { name, url } = request.body; // Trust user input
});

// ✅ Good: Validated with Zod
const createServerSchema = z.object({
  name: z.string().min(1).max(255),
  url: z.string().url(),
  description: z.string().max(1000).optional(),
});

fastify.post('/api/v1/servers', {
  schema: { body: createServerSchema }
}, async (request, reply) => {
  // Input is validated
});
```

#### Review Database Queries
```typescript
// ❌ Bad: SQL injection vulnerable
const query = `SELECT * FROM servers WHERE name = '${name}'`;

// ✅ Good: Parameterized query
const result = await db.select().from(servers).where(eq(servers.name, name));
```

### 5. Security Headers Check

Ensure proper security headers in Fastify:

```typescript
import helmet from '@fastify/helmet';

await fastify.register(helmet, {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
});
```

### 6. Rate Limiting Review

```typescript
import rateLimit from '@fastify/rate-limit';

await fastify.register(rateLimit, {
  max: 100, // 100 requests
  timeWindow: '1 minute',
  allowList: ['127.0.0.1'], // Whitelist
  continueExceeding: false,
});
```

## Security Report Template

Create `SECURITY_REPORT.md`:

```markdown
# Security Review Report

## Date: YYYY-MM-DD
## Reviewer: [Name]
## Scope: [Files/Features reviewed]

## Summary
- Critical Issues: 0
- High Issues: 0
- Medium Issues: 0
- Low Issues: 0

## Findings

### Critical
None found.

### High
None found.

### Medium
1. **Issue**: Description
   - **Location**: file.ts:line
   - **Impact**: What could happen
   - **Recommendation**: How to fix
   - **Status**: Open/Fixed

### Low
1. **Issue**: Description
   - **Location**: file.ts:line
   - **Impact**: Minor concern
   - **Recommendation**: Suggestion
   - **Status**: Open/Fixed

## Recommendations
1. Implement [specific security measure]
2. Update [dependency] to latest version
3. Add [security feature]

## Next Review
Scheduled for: YYYY-MM-DD
```

## Output

After completing this skill, you should have:

- Security audit report
- List of vulnerabilities with severity
- Remediation recommendations
- Fixed security issues
- Updated dependencies

## Verification

```bash
# Run security scan
./scripts/security-scan.sh

# Check audit results
pnpm audit --audit-level moderate

# Verify updates
pnpm audit --audit-level moderate
```

## Best Practices

1. **Review every PR** for security issues
2. **Keep dependencies updated** - Regular audits
3. **Use security headers** - Helmet.js
4. **Validate all inputs** - Never trust user input
5. **Hash sensitive data** - Use bcrypt/scrypt
6. **Implement rate limiting** - Prevent abuse
7. **Use HTTPS** - Encrypt all traffic
8. **Log security events** - For incident response
9. **Follow OWASP guidelines** - Top 10 compliance
10. **Regular security training** - Keep team informed

## Common Vulnerabilities to Check

### 1. SQL Injection
```typescript
// Always use parameterized queries with Drizzle
await db.select().from(servers).where(eq(servers.id, id));
```

### 2. XSS (Cross-Site Scripting)
```typescript
// Sanitize user content before rendering
import DOMPurify from 'dompurify';
const clean = DOMPurify.sanitize(userInput);
```

### 3. CSRF (Cross-Site Request Forgery)
```typescript
// Use CSRF tokens for state-changing requests
await fastify.register(@fastify/csrf);
```

### 4. Broken Authentication
```typescript
// Use strong password hashing
import bcrypt from 'bcryptjs';
const hash = await bcrypt.hash(password, 12);
```

### 5. Sensitive Data Exposure
```typescript
// Never log sensitive data
logger.info({ userId: user.id }, 'User logged in'); // Good
logger.info({ password: user.password }, 'Login attempt'); // Bad!
```

## Next Steps

After security review:

1. Fix all critical and high severity issues
2. Schedule regular security audits
3. Implement automated security testing in CI
4. Set up vulnerability alerts
5. Create incident response plan
