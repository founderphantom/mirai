import { NextApiResponse } from 'next';
import {
  createMockRequest,
  createMockResponse,
} from '@tests/helpers/test-helpers';
import { testUsers } from '@tests/fixtures/users';
import { supabaseAdmin } from '@/lib/supabase';
import { mockAuthUser, mockUserProfile } from '@tests/helpers/mock-supabase';

// Import the actual functions (not mocked initially)
import {
  authenticateUser,
  authenticateApiKey,
  authenticate,
  requireAuth,
  requireSubscription,
  requireRole,
  AuthenticatedRequest,
} from '@/middleware/auth';

// Mock the supabase module
jest.mock('@/lib/supabase');

// Set test timeout to 10 seconds instead of default 30
jest.setTimeout(10000);

describe('Auth Middleware', () => {
  let req: AuthenticatedRequest;
  let res: NextApiResponse;
  let nextCalled: boolean;

  beforeEach(() => {
    const mockReq = createMockRequest();
    req = mockReq.req as AuthenticatedRequest;
    // Always use createMockResponse for consistent jest mocks
    res = createMockResponse() as NextApiResponse;
    nextCalled = false;
    jest.clearAllMocks();
  });

  describe('authenticateUser', () => {
    it('should authenticate valid user with Bearer token', async () => {
      const testUser = testUsers.free;
      const token = 'valid-jwt-token';
      
      req.headers.authorization = `Bearer ${token}`;
      
      (supabaseAdmin.auth.getUser as jest.Mock).mockResolvedValue({
        data: { 
          user: { ...mockAuthUser, id: testUser.id, email: testUser.email }
        },
        error: null,
      });
      
      // Mock the database queries
      const mockUpdate = jest.fn().mockResolvedValue({ data: null, error: null });
      const mockEq = jest.fn().mockResolvedValue({ data: null, error: null });
      
      (supabaseAdmin.from as jest.Mock).mockImplementation((table) => {
        if (table === 'user_profiles') {
          const chain = {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: { ...mockUserProfile, ...testUser },
              error: null,
            }),
            update: jest.fn(() => ({
              eq: mockEq
            })),
          };
          return chain;
        }
        if (table === 'user_violations') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn(() => ({
              eq: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({
                data: null,
                error: null,
              }),
            })),
          };
        }
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: null, error: null }),
        };
      });
      
      await authenticateUser(req, res, () => { nextCalled = true; });
      
      expect(req.user).toBeDefined();
      expect(req.user?.id).toBe(testUser.id);
      expect(req.user?.email).toBe(testUser.email);
      expect(nextCalled).toBe(true);
    });

    it('should reject missing authorization header', async () => {
      nextCalled = false;
      await authenticateUser(req, res, () => { nextCalled = true; });
      
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ 
        error: 'Missing or invalid authorization header' 
      });
      expect(nextCalled).toBe(false);
    });

    it('should reject invalid Bearer format', async () => {
      req.headers.authorization = 'InvalidFormat token';
      
      nextCalled = false;
      await authenticateUser(req, res, () => { nextCalled = true; });
      
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ 
        error: 'Missing or invalid authorization header' 
      });
      expect(nextCalled).toBe(false);
    });

    it('should reject non-existent user', async () => {
      const token = 'valid-jwt-token';
      req.headers.authorization = `Bearer ${token}`;
      
      (supabaseAdmin.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: null },
        error: { message: 'User not found' },
      });
      
      nextCalled = false;
      await authenticateUser(req, res, () => { nextCalled = true; });
      
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ 
        error: 'Invalid or expired token' 
      });
      expect(nextCalled).toBe(false);
    });

    it('should reject inactive user', async () => {
      const testUser = testUsers.banned;
      const token = 'valid-jwt-token';
      
      req.headers.authorization = `Bearer ${token}`;
      
      (supabaseAdmin.auth.getUser as jest.Mock).mockResolvedValue({
        data: { 
          user: { ...mockAuthUser, id: testUser.id, email: testUser.email }
        },
        error: null,
      });
      
      (supabaseAdmin.from as jest.Mock).mockImplementation((table) => {
        if (table === 'user_profiles') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: { ...mockUserProfile, ...testUser },
              error: null,
            }),
            update: jest.fn(() => ({
              eq: jest.fn().mockResolvedValue({ data: null, error: null })
            })),
          };
        }
        if (table === 'user_violations') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn(() => ({
              eq: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({
                data: { 
                  user_id: testUser.id,
                  status: 'active',
                  reason: 'Terms violation'
                },
                error: null,
              }),
            })),
          };
        }
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: null, error: null }),
        };
      });
      
      nextCalled = false;
      await authenticateUser(req, res, () => { nextCalled = true; });
      
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ 
        error: 'Account is suspended' 
      });
      expect(nextCalled).toBe(false);
    });
  });

  describe('authenticateApiKey', () => {
    it('should authenticate valid API key', async () => {
      const testUser = testUsers.pro;
      const apiKey = 'sk_valid_api_key_123';
      
      req.headers['x-api-key'] = apiKey;
      
      (supabaseAdmin.from as jest.Mock).mockImplementation((table) => {
        if (table === 'api_keys') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn(() => ({
              eq: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({
                data: {
                  id: 'api-key-id',
                  user_id: testUser.id,
                  key: apiKey,
                  is_active: true,
                  expires_at: null,
                },
                error: null,
              }),
            })),
            update: jest.fn(() => ({
              eq: jest.fn().mockResolvedValue({ data: null, error: null })
            })),
          };
        }
        if (table === 'user_profiles') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: { ...mockUserProfile, ...testUser },
              error: null,
            }),
          };
        }
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: null, error: null }),
        };
      });
      
      await authenticateApiKey(req, res, () => { nextCalled = true; });
      
      expect(req.user).toBeDefined();
      expect(req.user?.id).toBe(testUser.id);
      expect(req.user?.role).toBe('service');
      expect(nextCalled).toBe(true);
    });

    it('should reject missing API key', async () => {
      nextCalled = false;
      await authenticateApiKey(req, res, () => { nextCalled = true; });
      
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ 
        error: 'Missing API key' 
      });
      expect(nextCalled).toBe(false);
    });

    it('should reject invalid API key', async () => {
      req.headers['x-api-key'] = 'invalid-api-key';
      
      (supabaseAdmin.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn(() => ({
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: null,
            error: { message: 'Not found' },
          }),
        })),
      });
      
      nextCalled = false;
      await authenticateApiKey(req, res, () => { nextCalled = true; });
      
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ 
        error: 'Invalid API key' 
      });
      expect(nextCalled).toBe(false);
    });

    it('should reject expired API key', async () => {
      const apiKey = 'sk_expired_api_key';
      req.headers['x-api-key'] = apiKey;
      
      (supabaseAdmin.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn(() => ({
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: {
              id: 'api-key-id',
              user_id: 'user-id',
              key: apiKey,
              is_active: true,
              expires_at: new Date(Date.now() - 1000).toISOString(), // Expired
            },
            error: null,
          }),
        })),
      });
      
      nextCalled = false;
      await authenticateApiKey(req, res, () => { nextCalled = true; });
      
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ 
        error: 'API key expired' 
      });
      expect(nextCalled).toBe(false);
    });

    it('should reject inactive API key', async () => {
      const apiKey = 'sk_inactive_api_key';
      req.headers['x-api-key'] = apiKey;
      
      // Since the query filters by is_active: true, an inactive key won't be found
      (supabaseAdmin.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn(() => ({
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: null, // No result because key is inactive
            error: { message: 'Not found' },
          }),
        })),
      });
      
      nextCalled = false;
      await authenticateApiKey(req, res, () => { nextCalled = true; });
      
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ 
        error: 'Invalid API key' 
      });
      expect(nextCalled).toBe(false);
    });
  });

  describe('requireAuth', () => {
    it('should allow authenticated users to access protected endpoints', async () => {
      const testUser = testUsers.free;
      const token = 'valid-jwt-token';
      const handler = jest.fn().mockResolvedValue(undefined);
      
      req.headers.authorization = `Bearer ${token}`;
      
      (supabaseAdmin.auth.getUser as jest.Mock).mockResolvedValue({
        data: { 
          user: { ...mockAuthUser, id: testUser.id, email: testUser.email }
        },
        error: null,
      });
      
      (supabaseAdmin.from as jest.Mock).mockImplementation((table) => {
        if (table === 'user_profiles') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: { ...mockUserProfile, ...testUser },
              error: null,
            }),
            update: jest.fn(() => ({
              eq: jest.fn().mockResolvedValue({ data: null, error: null })
            })),
          };
        }
        if (table === 'user_violations') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn(() => ({
              eq: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({
                data: null,
                error: null,
              }),
            })),
          };
        }
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: null, error: null }),
        };
      });
      
      const protectedHandler = requireAuth(handler);
      await protectedHandler(req, res);
      
      expect(handler).toHaveBeenCalledWith(req, res);
      expect(req.user).toBeDefined();
    });

    it('should block unauthenticated users', async () => {
      const handler = jest.fn().mockResolvedValue(undefined);
      
      const protectedHandler = requireAuth(handler);
      await protectedHandler(req, res);
      
      expect(handler).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
    });
  });

  describe('requireSubscription', () => {
    it('should allow users with required subscription plans', async () => {
      const testUser = testUsers.pro;
      const token = 'valid-jwt-token';
      const handler = jest.fn().mockResolvedValue(undefined);
      
      req.headers.authorization = `Bearer ${token}`;
      
      (supabaseAdmin.auth.getUser as jest.Mock).mockResolvedValue({
        data: { 
          user: { ...mockAuthUser, id: testUser.id, email: testUser.email }
        },
        error: null,
      });
      
      (supabaseAdmin.from as jest.Mock).mockImplementation((table) => {
        if (table === 'user_profiles') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: { 
                ...mockUserProfile, 
                ...testUser,
                subscription_tier: 'pro',
                subscription_status: 'active'
              },
              error: null,
            }),
            update: jest.fn(() => ({
              eq: jest.fn().mockResolvedValue({ data: null, error: null })
            })),
          };
        }
        if (table === 'user_violations') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn(() => ({
              eq: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({
                data: null,
                error: null,
              }),
            })),
          };
        }
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: null, error: null }),
        };
      });
      
      const protectedHandler = requireSubscription(['pro', 'enterprise'])(handler);
      await protectedHandler(req, res);
      
      expect(handler).toHaveBeenCalledWith(req, res);
    });

    it('should reject users without subscription', async () => {
      const testUser = testUsers.free;
      const token = 'valid-jwt-token';
      const handler = jest.fn().mockResolvedValue(undefined);
      
      req.headers.authorization = `Bearer ${token}`;
      
      (supabaseAdmin.auth.getUser as jest.Mock).mockResolvedValue({
        data: { 
          user: { ...mockAuthUser, id: testUser.id, email: testUser.email }
        },
        error: null,
      });
      
      (supabaseAdmin.from as jest.Mock).mockImplementation((table) => {
        if (table === 'user_profiles') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: { 
                ...mockUserProfile, 
                ...testUser,
                subscription_tier: null,
                subscription_status: null
              },
              error: null,
            }),
            update: jest.fn(() => ({
              eq: jest.fn().mockResolvedValue({ data: null, error: null })
            })),
          };
        }
        if (table === 'user_violations') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn(() => ({
              eq: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({
                data: null,
                error: null,
              }),
            })),
          };
        }
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: null, error: null }),
        };
      });
      
      const protectedHandler = requireSubscription(['pro'])(handler);
      await protectedHandler(req, res);
      
      expect(handler).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should reject users with insufficient subscription plan', async () => {
      const testUser = testUsers.free;
      const token = 'valid-jwt-token';
      const handler = jest.fn().mockResolvedValue(undefined);
      
      req.headers.authorization = `Bearer ${token}`;
      
      (supabaseAdmin.auth.getUser as jest.Mock).mockResolvedValue({
        data: { 
          user: { ...mockAuthUser, id: testUser.id, email: testUser.email }
        },
        error: null,
      });
      
      (supabaseAdmin.from as jest.Mock).mockImplementation((table) => {
        if (table === 'user_profiles') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: { 
                ...mockUserProfile, 
                ...testUser,
                subscription_tier: 'free',
                subscription_status: 'active'
              },
              error: null,
            }),
            update: jest.fn(() => ({
              eq: jest.fn().mockResolvedValue({ data: null, error: null })
            })),
          };
        }
        if (table === 'user_violations') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn(() => ({
              eq: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({
                data: null,
                error: null,
              }),
            })),
          };
        }
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: null, error: null }),
        };
      });
      
      const protectedHandler = requireSubscription(['pro', 'enterprise'])(handler);
      await protectedHandler(req, res);
      
      expect(handler).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: 'Insufficient subscription tier',
        required: ['pro', 'enterprise'],
        current: 'free',
      }));
    });
  });

  describe('requireRole', () => {
    it('should allow users with required roles', async () => {
      const testUser = testUsers.admin;
      const token = 'valid-jwt-token';
      const handler = jest.fn().mockResolvedValue(undefined);
      
      req.headers.authorization = `Bearer ${token}`;
      
      (supabaseAdmin.auth.getUser as jest.Mock).mockResolvedValue({
        data: { 
          user: { 
            ...mockAuthUser, 
            id: testUser.id, 
            email: testUser.email,
            role: 'admin'
          }
        },
        error: null,
      });
      
      (supabaseAdmin.from as jest.Mock).mockImplementation((table) => {
        if (table === 'user_profiles') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: { ...mockUserProfile, ...testUser },
              error: null,
            }),
            update: jest.fn(() => ({
              eq: jest.fn().mockResolvedValue({ data: null, error: null })
            })),
          };
        }
        if (table === 'user_violations') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn(() => ({
              eq: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({
                data: null,
                error: null,
              }),
            })),
          };
        }
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: null, error: null }),
        };
      });
      
      const protectedHandler = requireRole(['admin'])(handler);
      await protectedHandler(req, res);
      
      expect(handler).toHaveBeenCalledWith(req, res);
    });

    it('should reject users without required role', async () => {
      const testUser = testUsers.free;
      const token = 'valid-jwt-token';
      const handler = jest.fn().mockResolvedValue(undefined);
      
      req.headers.authorization = `Bearer ${token}`;
      
      (supabaseAdmin.auth.getUser as jest.Mock).mockResolvedValue({
        data: { 
          user: { 
            ...mockAuthUser, 
            id: testUser.id, 
            email: testUser.email,
            role: 'user'
          }
        },
        error: null,
      });
      
      (supabaseAdmin.from as jest.Mock).mockImplementation((table) => {
        if (table === 'user_profiles') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: { ...mockUserProfile, ...testUser },
              error: null,
            }),
            update: jest.fn(() => ({
              eq: jest.fn().mockResolvedValue({ data: null, error: null })
            })),
          };
        }
        if (table === 'user_violations') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn(() => ({
              eq: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({
                data: null,
                error: null,
              }),
            })),
          };
        }
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: null, error: null }),
        };
      });
      
      const protectedHandler = requireRole(['admin', 'moderator'])(handler);
      await protectedHandler(req, res);
      
      expect(handler).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: 'Insufficient permissions',
        required: ['admin', 'moderator'],
        current: 'user',
      }));
    });
  });

  describe('authenticate', () => {
    it('should prefer API key authentication when present', async () => {
      const testUser = testUsers.pro;
      const apiKey = 'sk_valid_api_key';
      const handler = jest.fn().mockResolvedValue(undefined);
      
      req.headers['x-api-key'] = apiKey;
      req.headers.authorization = 'Bearer some-jwt-token'; // Should be ignored
      
      (supabaseAdmin.from as jest.Mock).mockImplementation((table) => {
        if (table === 'api_keys') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn(() => ({
              eq: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({
                data: {
                  id: 'api-key-id',
                  user_id: testUser.id,
                  key: apiKey,
                  is_active: true,
                  expires_at: null,
                },
                error: null,
              }),
            })),
            update: jest.fn(() => ({
              eq: jest.fn().mockResolvedValue({ data: null, error: null })
            })),
          };
        }
        if (table === 'user_profiles') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: { ...mockUserProfile, ...testUser },
              error: null,
            }),
          };
        }
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: null, error: null }),
        };
      });
      
      const authenticatedHandler = authenticate(handler);
      await authenticatedHandler(req, res);
      
      expect(handler).toHaveBeenCalledWith(req, res);
      expect(req.user?.role).toBe('service'); // API key sets role to 'service'
    });

    it('should fall back to JWT authentication when no API key', async () => {
      const testUser = testUsers.free;
      const token = 'valid-jwt-token';
      const handler = jest.fn().mockResolvedValue(undefined);
      
      req.headers.authorization = `Bearer ${token}`;
      
      (supabaseAdmin.auth.getUser as jest.Mock).mockResolvedValue({
        data: { 
          user: { ...mockAuthUser, id: testUser.id, email: testUser.email }
        },
        error: null,
      });
      
      (supabaseAdmin.from as jest.Mock).mockImplementation((table) => {
        if (table === 'user_profiles') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: { ...mockUserProfile, ...testUser },
              error: null,
            }),
            update: jest.fn(() => ({
              eq: jest.fn().mockResolvedValue({ data: null, error: null })
            })),
          };
        }
        if (table === 'user_violations') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn(() => ({
              eq: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({
                data: null,
                error: null,
              }),
            })),
          };
        }
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: null, error: null }),
        };
      });
      
      const authenticatedHandler = authenticate(handler);
      await authenticatedHandler(req, res);
      
      expect(handler).toHaveBeenCalledWith(req, res);
      expect(req.user).toBeDefined();
    });
  });
});