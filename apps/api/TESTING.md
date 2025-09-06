# MIRAI API Testing Documentation

## Overview

This document provides comprehensive guidance for testing the MIRAI SaaS platform backend API. The test suite ensures robustness, reliability, and performance of all API endpoints and business logic.

## Test Structure

```
apps/api/
├── tests/
│   ├── fixtures/         # Test data and mock objects
│   │   ├── users.ts      # User test fixtures
│   │   └── conversations.ts # Conversation test fixtures
│   ├── helpers/          # Test utilities
│   │   ├── mock-supabase.ts # Supabase mocking utilities
│   │   └── test-helpers.ts  # Common test helpers
│   ├── unit/            # Unit tests
│   │   ├── services/    # Service layer tests
│   │   └── middleware/  # Middleware tests
│   ├── integration/     # Integration tests
│   │   ├── auth/       # Authentication endpoints
│   │   ├── conversations/ # Conversation endpoints
│   │   └── subscription/ # Subscription endpoints
│   ├── performance/     # Performance tests
│   │   └── load-test.ts # Load and stress testing
│   └── setup.ts        # Test environment setup
├── jest.config.js      # Jest configuration
└── package.json        # Test scripts and dependencies
```

## Running Tests

### All Tests
```bash
npm test
```

### Watch Mode (Development)
```bash
npm run test:watch
```

### Coverage Report
```bash
npm run test:coverage
```

### Specific Test Suites

#### Unit Tests Only
```bash
npm run test:unit
```

#### Integration Tests Only
```bash
npm run test:integration
```

#### Performance Tests
```bash
npm run test:performance
```

### CI/CD Pipeline
```bash
npm run test:ci
```

### Debugging Tests
```bash
npm run test:debug
```

## Test Categories

### 1. Unit Tests

Unit tests focus on individual components in isolation:

- **Services**: Business logic testing
  - Authentication service
  - Conversation service
  - Subscription service
  - Usage tracking service
  - Moderation service

- **Middleware**: Request processing
  - Authentication middleware
  - Rate limiting
  - Validation
  - Error handling

- **Utilities**: Helper functions
  - Token generation/validation
  - Encryption/decryption
  - Data formatting
  - Rate calculations

#### Example Unit Test
```typescript
describe('AuthService', () => {
  it('should successfully create a new user', async () => {
    const result = await authService.signUp(
      'test@example.com',
      'SecurePassword123!'
    );
    
    expect(result).toHaveProperty('user');
    expect(result).toHaveProperty('accessToken');
    expect(result.accessToken).toBeValidJWT();
  });
});
```

### 2. Integration Tests

Integration tests verify API endpoints and their interactions:

- **Authentication Endpoints**
  - POST /api/auth/login
  - POST /api/auth/signup
  - POST /api/auth/logout
  - POST /api/auth/refresh
  - GET /api/auth/session

- **Conversation Endpoints**
  - GET /api/conversations
  - POST /api/conversations
  - GET /api/conversations/[id]
  - PUT /api/conversations/[id]
  - DELETE /api/conversations/[id]
  - GET /api/conversations/[id]/messages
  - POST /api/conversations/[id]/messages

- **Subscription Endpoints**
  - GET /api/subscription/current
  - POST /api/subscription/create-checkout
  - POST /api/subscription/cancel
  - POST /api/subscription/webhook

#### Example Integration Test
```typescript
describe('POST /api/auth/login', () => {
  it('should login with valid credentials', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'test@example.com',
        password: 'Password123!'
      });
    
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.accessToken).toBeDefined();
  });
});
```

### 3. Database Tests

Database interaction testing:

- **Query Performance**
  - Complex joins
  - Pagination
  - Search operations
  - Aggregations

- **Data Integrity**
  - Foreign key constraints
  - Unique constraints
  - Cascade operations
  - Transaction rollbacks

- **RLS (Row Level Security)**
  - User data isolation
  - Permission checks
  - Multi-tenancy

### 4. Performance Tests

Performance and load testing:

- **Concurrent Users**: Simulate 50-100 concurrent users
- **Response Times**: Ensure < 500ms for standard operations
- **Throughput**: Minimum 10 requests/second
- **Memory Usage**: Monitor for memory leaks
- **Database Connections**: Connection pool management

#### Performance Benchmarks
| Operation | Target | Maximum |
|-----------|--------|---------|
| User Login | < 200ms | 500ms |
| Token Validation | < 50ms | 100ms |
| Message Creation | < 100ms | 300ms |
| Conversation List | < 300ms | 500ms |
| Search | < 500ms | 1000ms |

## Test Data Management

### Fixtures

Test fixtures provide consistent test data:

```typescript
// User fixtures
export const testUsers = {
  free: { /* Free tier user */ },
  plus: { /* Plus tier user */ },
  pro: { /* Pro tier user */ },
  enterprise: { /* Enterprise user */ },
  banned: { /* Banned user */ },
  expired: { /* Expired subscription */ }
};
```

### Mock Data Generators

```typescript
// Generate random test data
const user = createTestUser();
const conversation = createTestConversation(user.id);
const message = createTestMessage(conversation.id, user.id);
```

## Mocking Strategy

### External Services

- **Supabase**: Mock database and auth operations
- **Stripe**: Mock payment processing
- **Redis**: Mock caching operations
- **OpenAI/Anthropic**: Mock LLM responses

### Mock Implementation
```typescript
jest.mock('@/lib/supabase');

(supabaseAdmin.from as jest.Mock).mockReturnValue({
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  single: jest.fn().mockResolvedValue({
    data: mockData,
    error: null
  })
});
```

## Coverage Requirements

Minimum coverage thresholds:

- **Branches**: 70%
- **Functions**: 75%
- **Lines**: 80%
- **Statements**: 80%

Check coverage:
```bash
npm run test:coverage
```

## Error Testing

### Common Error Scenarios

1. **Authentication Errors**
   - Invalid credentials
   - Expired tokens
   - Missing authorization
   - Banned users

2. **Validation Errors**
   - Invalid email format
   - Weak passwords
   - Missing required fields
   - Invalid data types

3. **Rate Limiting**
   - Too many requests
   - Quota exceeded
   - Subscription limits

4. **Database Errors**
   - Connection failures
   - Constraint violations
   - Transaction conflicts

## Security Testing

### Security Test Cases

1. **SQL Injection Prevention**
2. **XSS Protection**
3. **CSRF Token Validation**
4. **Rate Limiting Enforcement**
5. **Authentication Bypass Attempts**
6. **Authorization Checks**
7. **Input Sanitization**
8. **Sensitive Data Exposure**

## Best Practices

### Writing Tests

1. **Descriptive Test Names**: Use clear, descriptive test names
2. **Arrange-Act-Assert**: Follow AAA pattern
3. **Test Isolation**: Each test should be independent
4. **Mock External Dependencies**: Don't make real API calls
5. **Test Edge Cases**: Include boundary and error conditions

### Test Maintenance

1. **Keep Tests Updated**: Update tests when features change
2. **Remove Obsolete Tests**: Delete tests for removed features
3. **Refactor Test Code**: Keep test code clean and DRY
4. **Document Complex Tests**: Add comments for complex scenarios

## CI/CD Integration

### GitHub Actions Workflow

```yaml
name: API Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run test:ci
      - uses: codecov/codecov-action@v2
        with:
          file: ./coverage/coverage-final.json
```

## Troubleshooting

### Common Issues

1. **Test Timeouts**
   - Increase timeout: `jest.setTimeout(30000)`
   - Check for unresolved promises

2. **Mock Not Working**
   - Ensure mock is before import
   - Clear mocks between tests: `jest.clearAllMocks()`

3. **Database Connection Issues**
   - Check environment variables
   - Verify test database is running

4. **Flaky Tests**
   - Add proper async/await
   - Use deterministic test data
   - Mock time-dependent operations

## Environment Setup

### Test Environment Variables

Create `.env.test` file:
```env
NODE_ENV=test
SUPABASE_URL=http://localhost:54321
SUPABASE_ANON_KEY=test-anon-key
SUPABASE_SERVICE_KEY=test-service-key
JWT_ACCESS_SECRET=test-access-secret
JWT_REFRESH_SECRET=test-refresh-secret
STRIPE_SECRET_KEY=sk_test_fake
REDIS_URL=redis://localhost:6379
```

### Local Test Database

1. Start local Supabase:
```bash
supabase start
```

2. Run migrations:
```bash
supabase db reset
```

3. Seed test data:
```bash
supabase db seed
```

## Reporting

### Test Reports

- **Console Output**: Default Jest reporter
- **Coverage Report**: HTML report in `coverage/` directory
- **CI Reports**: JUnit XML format for CI/CD

### Monitoring Test Health

1. Track test execution time trends
2. Monitor coverage changes
3. Review flaky test patterns
4. Analyze failure rates

## Contributing

When adding new features:

1. Write tests first (TDD approach)
2. Ensure all tests pass
3. Meet coverage requirements
4. Update this documentation
5. Include tests in PR

## Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)
- [Supabase Testing Guide](https://supabase.com/docs/guides/testing)
- [Node.js Testing Best Practices](https://github.com/goldbergyoni/nodebestpractices#4-testing-and-overall-quality-practices)