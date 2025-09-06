import { NextApiRequest, NextApiResponse } from 'next';
import { createMocks, RequestMethod } from 'node-mocks-http';
import jwt from 'jsonwebtoken';
import { TestUser } from '../fixtures/users';

interface MockRequestOptions {
  method?: RequestMethod;
  headers?: Record<string, string>;
  body?: any;
  query?: Record<string, any>;
  cookies?: Record<string, string>;
  url?: string;
}

export function createMockRequest(options: MockRequestOptions = {}) {
  const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
    method: options.method || 'GET',
    headers: options.headers || {},
    body: options.body,
    query: options.query || {},
    cookies: options.cookies || {},
    url: options.url || '/api/test',
  });

  return { req, res };
}

export function createAuthenticatedRequest(
  user: TestUser,
  options: MockRequestOptions = {}
) {
  const token = generateTestToken(user);
  
  return createMockRequest({
    ...options,
    headers: {
      ...options.headers,
      authorization: `Bearer ${token}`,
    },
  });
}

export function createApiKeyRequest(
  apiKey: string,
  options: MockRequestOptions = {}
) {
  return createMockRequest({
    ...options,
    headers: {
      ...options.headers,
      'x-api-key': apiKey,
    },
  });
}

export function generateTestToken(user: TestUser, expiresIn = '15m') {
  const secret = process.env.JWT_ACCESS_SECRET || 'test-access-secret-key-for-testing';
  
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.subscription_tier === 'enterprise' ? 'admin' : 'user',
      type: 'access',
    },
    secret,
    { expiresIn }
  );
}

export function generateExpiredToken(user: TestUser) {
  const secret = process.env.JWT_ACCESS_SECRET || 'test-access-secret-key-for-testing';
  
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: 'user',
      type: 'access',
      exp: Math.floor(Date.now() / 1000) - 3600, // Expired 1 hour ago
    },
    secret
  );
}

export function generateInvalidToken() {
  return 'invalid.token.signature';
}

export async function expectApiError(
  handler: Function,
  req: NextApiRequest,
  res: NextApiResponse,
  expectedStatus: number,
  expectedError?: string | RegExp
) {
  await handler(req, res);
  
  expect(res._getStatusCode()).toBe(expectedStatus);
  
  const data = JSON.parse(res._getData());
  expect(data).toHaveProperty('error');
  
  if (expectedError) {
    if (typeof expectedError === 'string') {
      expect(data.error).toContain(expectedError);
    } else {
      expect(data.error).toMatch(expectedError);
    }
  }
}

export async function expectApiSuccess(
  handler: Function,
  req: NextApiRequest,
  res: NextApiResponse,
  expectedStatus = 200
) {
  await handler(req, res);
  
  expect(res._getStatusCode()).toBe(expectedStatus);
  
  const data = JSON.parse(res._getData());
  return data;
}

export function mockEnvironmentVariables(overrides: Record<string, string> = {}) {
  const originalEnv = { ...process.env };
  
  Object.assign(process.env, {
    NODE_ENV: 'test',
    JWT_ACCESS_SECRET: 'test-access-secret',
    JWT_REFRESH_SECRET: 'test-refresh-secret',
    SUPABASE_URL: 'http://localhost:54321',
    SUPABASE_ANON_KEY: 'test-anon-key',
    SUPABASE_SERVICE_KEY: 'test-service-key',
    SUPABASE_JWT_SECRET: 'test-jwt-secret',
    STRIPE_SECRET_KEY: 'sk_test_fake',
    STRIPE_WEBHOOK_SECRET: 'whsec_test_fake',
    REDIS_URL: 'redis://localhost:6379',
    FRONTEND_URL: 'http://localhost:3000',
    ...overrides,
  });
  
  return () => {
    process.env = originalEnv;
  };
}

export class MockResponse {
  status: number = 200;
  headers: Record<string, string> = {};
  body: any = null;
  
  setHeader(key: string, value: string | string[]) {
    if (Array.isArray(value)) {
      this.headers[key] = value.join(', ');
    } else {
      this.headers[key] = value;
    }
    return this;
  }
  
  status(code: number) {
    this.status = code;
    return this;
  }
  
  json(data: any) {
    this.body = data;
    return this;
  }
  
  send(data: any) {
    this.body = data;
    return this;
  }
  
  end() {
    return this;
  }
}

export function createMockResponse() {
  const res: any = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
    setHeader: jest.fn().mockReturnThis(),
    end: jest.fn().mockReturnThis(),
    headersSent: false,
  };
  return res;
}

// Performance testing helpers
export async function measurePerformance<T>(
  fn: () => Promise<T>,
  label?: string
): Promise<{ result: T; duration: number }> {
  const start = performance.now();
  const result = await fn();
  const duration = performance.now() - start;
  
  if (label) {
    console.log(`[Performance] ${label}: ${duration.toFixed(2)}ms`);
  }
  
  return { result, duration };
}

export async function runConcurrent<T>(
  fn: () => Promise<T>,
  concurrency: number
): Promise<T[]> {
  const promises = Array(concurrency).fill(null).map(() => fn());
  return Promise.all(promises);
}

export async function runSequential<T>(
  fn: () => Promise<T>,
  iterations: number
): Promise<T[]> {
  const results: T[] = [];
  
  for (let i = 0; i < iterations; i++) {
    results.push(await fn());
  }
  
  return results;
}

// Database testing helpers
export function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function createTestDate(daysAgo = 0) {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString();
}

// Assertion helpers
export function expectValidationError(response: any, field?: string) {
  expect(response.error).toBeDefined();
  
  if (field) {
    expect(response.error).toContain(field);
  }
}

export function expectAuthenticationError(response: any) {
  expect(response.error).toMatch(/auth|unauthorized|unauthenticated/i);
}

export function expectAuthorizationError(response: any) {
  expect(response.error).toMatch(/forbidden|permission|unauthorized/i);
}

export function expectRateLimitError(response: any) {
  expect(response.error).toMatch(/rate limit|too many requests/i);
}