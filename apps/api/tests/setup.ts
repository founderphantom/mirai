import dotenv from 'dotenv';
import path from 'path';

// Load test environment variables
dotenv.config({ path: path.join(__dirname, '../.env.test') });

// Reset nanoid mock counter before each test suite
beforeEach(() => {
  const nanoidMock = require('./mocks/nanoid.mock');
  if (nanoidMock.resetCounter) {
    nanoidMock.resetCounter();
  }
});

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-key-for-testing';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-key-for-testing';
process.env.JWT_ACCESS_EXPIRY = '15m';
process.env.JWT_REFRESH_EXPIRY = '7d';
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'test-anon-key';
process.env.SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'test-service-key';
// Use the same secret for JWT verification in tests
process.env.SUPABASE_JWT_SECRET = 'test-access-secret-key-for-testing';
process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || 'sk_test_fake_key';
process.env.STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_test_fake_key';
process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
process.env.FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
// OpenAI API key is not needed in tests due to mocking
// This ensures we never accidentally call the real API during tests
delete process.env.OPENAI_API_KEY;

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  error: jest.fn(),
  warn: jest.fn(),
  log: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
};

// Add custom matchers
expect.extend({
  toBeValidUUID(received: string) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const pass = uuidRegex.test(received);
    return {
      pass,
      message: () => pass
        ? `expected ${received} not to be a valid UUID`
        : `expected ${received} to be a valid UUID`,
    };
  },
  toBeValidJWT(received: string) {
    const jwtRegex = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/;
    const pass = jwtRegex.test(received);
    return {
      pass,
      message: () => pass
        ? `expected ${received} not to be a valid JWT`
        : `expected ${received} to be a valid JWT`,
    };
  },
  toBeWithinRange(received: number, floor: number, ceiling: number) {
    const pass = received >= floor && received <= ceiling;
    return {
      pass,
      message: () => pass
        ? `expected ${received} not to be within range ${floor} - ${ceiling}`
        : `expected ${received} to be within range ${floor} - ${ceiling}`,
    };
  },
});

// Extend Jest matchers TypeScript definitions
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidUUID(): R;
      toBeValidJWT(): R;
      toBeWithinRange(floor: number, ceiling: number): R;
    }
  }
}

// Global test utilities
export const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Clean up after all tests
afterAll(async () => {
  // Clear all timers before cleanup
  jest.clearAllTimers();
  jest.useRealTimers();
  
  // Clear all mocks
  jest.clearAllMocks();
  jest.restoreAllMocks();
  
  // Force garbage collection if available
  if (global.gc) {
    global.gc();
  }
});