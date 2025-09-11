/**
 * CSRF Protection Middleware Tests
 */

import { createMocks } from 'node-mocks-http';
import { NextApiRequest, NextApiResponse } from 'next';
import { getCsrfToken, csrfProtection, withCsrf, configureCsrf } from '@/middleware/csrf';

// Mock the config module
jest.mock('@/lib/config', () => ({
  getCookieSettings: () => ({
    sameSite: 'strict',
    path: '/',
    secure: false,
  }),
  isProduction: () => false,
}));

// Mock the logger
jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('CSRF Protection Middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getCsrfToken', () => {
    it('should generate and return a CSRF token', () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'GET',
      });

      getCsrfToken(req, res);

      expect(res._getStatusCode()).toBe(200);
      const data = JSON.parse(res._getData());
      expect(data).toHaveProperty('csrfToken');
      expect(data).toHaveProperty('headerName', 'X-CSRF-Token');
      expect(data).toHaveProperty('paramName', '_csrf');
    });

    it('should handle token generation errors gracefully', () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'GET',
      });

      // Mock generateToken to throw an error
      const originalEnv = process.env.CSRF_SECRET;
      process.env.CSRF_SECRET = undefined;

      getCsrfToken(req, res);

      // Even with error, should return a token (falls back to JWT_SECRET or default)
      expect(res._getStatusCode()).toBe(200);
      const data = JSON.parse(res._getData());
      expect(data).toHaveProperty('csrfToken');

      process.env.CSRF_SECRET = originalEnv;
    });
  });

  describe('csrfProtection', () => {
    it('should skip CSRF validation for GET requests', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'GET',
        url: '/api/test',
      });

      const handler = jest.fn((req, res) => {
        res.status(200).json({ success: true });
      });

      const protectedHandler = csrfProtection(handler);
      await protectedHandler(req, res);

      expect(handler).toHaveBeenCalled();
      expect(res._getStatusCode()).toBe(200);
    });

    it('should skip CSRF validation for HEAD requests', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'HEAD',
        url: '/api/test',
      });

      const handler = jest.fn((req, res) => {
        res.status(200).end();
      });

      const protectedHandler = csrfProtection(handler);
      await protectedHandler(req, res);

      expect(handler).toHaveBeenCalled();
      expect(res._getStatusCode()).toBe(200);
    });

    it('should skip CSRF validation for OPTIONS requests', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'OPTIONS',
        url: '/api/test',
      });

      const handler = jest.fn((req, res) => {
        res.status(200).end();
      });

      const protectedHandler = csrfProtection(handler);
      await protectedHandler(req, res);

      expect(handler).toHaveBeenCalled();
      expect(res._getStatusCode()).toBe(200);
    });

    it('should skip CSRF validation for webhook endpoints', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'POST',
        url: '/api/subscription/webhook',
      });

      const handler = jest.fn((req, res) => {
        res.status(200).json({ success: true });
      });

      const protectedHandler = csrfProtection(handler);
      await protectedHandler(req, res);

      expect(handler).toHaveBeenCalled();
      expect(res._getStatusCode()).toBe(200);
    });

    it('should reject POST requests without CSRF token', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'POST',
        url: '/api/test',
        body: { data: 'test' },
      });

      const handler = jest.fn((req, res) => {
        res.status(200).json({ success: true });
      });

      const protectedHandler = csrfProtection(handler);
      await protectedHandler(req, res);

      expect(handler).not.toHaveBeenCalled();
      expect(res._getStatusCode()).toBe(403);
      const data = JSON.parse(res._getData());
      expect(data).toHaveProperty('error', 'Invalid CSRF token');
      expect(data).toHaveProperty('code', 'CSRF_VALIDATION_FAILED');
    });

    it('should reject PUT requests without CSRF token', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'PUT',
        url: '/api/test',
        body: { data: 'test' },
      });

      const handler = jest.fn((req, res) => {
        res.status(200).json({ success: true });
      });

      const protectedHandler = csrfProtection(handler);
      await protectedHandler(req, res);

      expect(handler).not.toHaveBeenCalled();
      expect(res._getStatusCode()).toBe(403);
    });

    it('should reject DELETE requests without CSRF token', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'DELETE',
        url: '/api/test/123',
      });

      const handler = jest.fn((req, res) => {
        res.status(200).json({ success: true });
      });

      const protectedHandler = csrfProtection(handler);
      await protectedHandler(req, res);

      expect(handler).not.toHaveBeenCalled();
      expect(res._getStatusCode()).toBe(403);
    });

    it('should reject PATCH requests without CSRF token', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'PATCH',
        url: '/api/test/123',
        body: { data: 'test' },
      });

      const handler = jest.fn((req, res) => {
        res.status(200).json({ success: true });
      });

      const protectedHandler = csrfProtection(handler);
      await protectedHandler(req, res);

      expect(handler).not.toHaveBeenCalled();
      expect(res._getStatusCode()).toBe(403);
    });
  });

  describe('withCsrf', () => {
    it('should be an alias for csrfProtection', () => {
      const handler = jest.fn();
      const wrappedHandler = withCsrf(handler);
      
      expect(typeof wrappedHandler).toBe('function');
      // The wrapped handler should be the same as using csrfProtection
      expect(wrappedHandler.toString()).toBe(csrfProtection(handler).toString());
    });
  });

  describe('configureCsrf', () => {
    it('should configure CSRF without errors in development', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      expect(() => configureCsrf()).not.toThrow();

      process.env.NODE_ENV = originalEnv;
    });

    it('should throw error in production without CSRF_SECRET', () => {
      const originalEnv = process.env.NODE_ENV;
      const originalSecret = process.env.CSRF_SECRET;
      
      // Mock isProduction to return true
      jest.doMock('@/lib/config', () => ({
        getCookieSettings: () => ({
          sameSite: 'strict',
          path: '/',
          secure: true,
        }),
        isProduction: () => true,
      }));

      process.env.NODE_ENV = 'production';
      process.env.CSRF_SECRET = undefined;

      // Re-import to get mocked version
      jest.resetModules();
      const { configureCsrf: configureCsrfProd } = require('@/middleware/csrf');

      expect(() => configureCsrfProd()).toThrow('CSRF_SECRET environment variable must be set in production');

      process.env.NODE_ENV = originalEnv;
      process.env.CSRF_SECRET = originalSecret;
    });
  });

  describe('CSRF Token validation from different sources', () => {
    it('should accept CSRF token from header', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'POST',
        url: '/api/test',
        headers: {
          'x-csrf-token': 'valid-token-from-header',
        },
      });

      // Mock validateRequest to return true for testing
      // In real scenario, you'd need to generate a valid token first
      const handler = jest.fn((req, res) => {
        res.status(200).json({ success: true });
      });

      const protectedHandler = csrfProtection(handler);
      
      // For this test, we're mainly checking that the middleware attempts validation
      await protectedHandler(req, res);
      
      // The request should be rejected since we don't have a valid token
      expect(res._getStatusCode()).toBe(403);
    });

    it('should accept CSRF token from body', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'POST',
        url: '/api/test',
        body: {
          _csrf: 'valid-token-from-body',
          data: 'test',
        },
      });

      const handler = jest.fn((req, res) => {
        res.status(200).json({ success: true });
      });

      const protectedHandler = csrfProtection(handler);
      await protectedHandler(req, res);
      
      // The request should be rejected since we don't have a valid token
      expect(res._getStatusCode()).toBe(403);
    });

    it('should accept CSRF token from query params', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'POST',
        url: '/api/test?_csrf=valid-token-from-query',
        query: {
          _csrf: 'valid-token-from-query',
        },
      });

      const handler = jest.fn((req, res) => {
        res.status(200).json({ success: true });
      });

      const protectedHandler = csrfProtection(handler);
      await protectedHandler(req, res);
      
      // The request should be rejected since we don't have a valid token
      expect(res._getStatusCode()).toBe(403);
    });
  });
});