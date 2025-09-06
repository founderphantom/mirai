import { AuthService } from '@/services/auth.service';
import { supabaseAdmin } from '@/lib/supabase';
import { subscriptionService } from '@/services/subscription.service';
import { moderationService } from '@/services/moderation.service';
import { testUsers, createTestUser } from '@tests/fixtures/users';
import { 
  mockSupabaseResponse, 
  mockSupabaseError,
  mockAuthUser,
  mockUserProfile 
} from '@tests/helpers/mock-supabase';

jest.mock('@/lib/supabase');
jest.mock('@/services/subscription.service');
jest.mock('@/services/moderation.service');

describe('AuthService', () => {
  let authService: AuthService;
  
  beforeEach(() => {
    authService = new AuthService();
    jest.clearAllMocks();
  });

  describe('signUp', () => {
    it('should successfully create a new user', async () => {
      const testUser = createTestUser();
      const mockProfile = { ...mockUserProfile, ...testUser };
      
      // Mock Supabase responses - setup chainable mock
      const chainableMock = {
        select: jest.fn().mockReturnThis(),
        insert: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: null }),
      };
      
      (supabaseAdmin.from as jest.Mock).mockReturnValue(chainableMock);
      
      (supabaseAdmin.auth.signUp as jest.Mock).mockResolvedValue({
        data: { 
          user: { ...mockAuthUser, id: testUser.id, email: testUser.email },
          session: {
            access_token: 'test-access-token',
            refresh_token: 'test-refresh-token',
            expires_in: 3600,
            token_type: 'bearer'
          }
        },
        error: null,
      });
      
      (subscriptionService.getUserProfile as jest.Mock).mockResolvedValue(mockProfile);
      
      const result = await authService.signUp(
        testUser.email,
        testUser.password,
        { full_name: testUser.full_name }
      );
      
      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('session');
      expect(result.user.email).toBe(testUser.email);
      expect(result.session.access_token).toBeDefined();
      expect(result.session.refresh_token).toBeDefined();
    });

    it('should reject duplicate email addresses', async () => {
      const existingUser = testUsers.free;
      
      (supabaseAdmin.auth.signUp as jest.Mock).mockResolvedValue({
        data: null,
        error: { message: 'User already registered' },
      });
      
      await expect(
        authService.signUp(existingUser.email, 'NewPassword123!')
      ).rejects.toThrow('User already registered');
    });

    it('should rollback user creation if profile creation fails', async () => {
      const testUser = createTestUser();
      
      (supabaseAdmin.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        insert: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: null }),
      });
      
      (supabaseAdmin.auth.signUp as jest.Mock).mockResolvedValue({
        data: { 
          user: { ...mockAuthUser, id: testUser.id, email: testUser.email },
          session: {
            access_token: 'test-access-token',
            refresh_token: 'test-refresh-token',
            expires_in: 3600,
            token_type: 'bearer'
          }
        },
        error: null,
      });
      
      (subscriptionService.getUserProfile as jest.Mock).mockResolvedValue(null);
      (subscriptionService.upsertUserProfile as jest.Mock).mockResolvedValue(null);
      
      (supabaseAdmin.auth.admin.deleteUser as jest.Mock).mockResolvedValue({
        data: null,
        error: null,
      });
      
      await expect(
        authService.signUp(testUser.email, testUser.password)
      ).rejects.toThrow('Failed to create user profile');
      
      expect(supabaseAdmin.auth.admin.deleteUser).toHaveBeenCalledWith(testUser.id);
    });

    it('should handle Supabase auth errors', async () => {
      const testUser = createTestUser();
      
      (supabaseAdmin.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: null }),
      });
      
      (supabaseAdmin.auth.signUp as jest.Mock).mockResolvedValue({
        data: null,
        error: { message: 'Invalid password format' },
      });
      
      await expect(
        authService.signUp(testUser.email, 'weak')
      ).rejects.toThrow('Invalid password format');
    });
  });

  describe('signIn', () => {
    it('should successfully authenticate valid credentials', async () => {
      const testUser = testUsers.plus;
      const mockProfile = { ...mockUserProfile, ...testUser };
      
      (supabaseAdmin.auth.signInWithPassword as jest.Mock).mockResolvedValue({
        data: { 
          user: { ...mockAuthUser, id: testUser.id },
          session: {
            access_token: 'test-access-token',
            refresh_token: 'test-refresh-token',
            expires_in: 3600,
            token_type: 'bearer'
          }
        },
        error: null,
      });
      
      (subscriptionService.getUserProfile as jest.Mock).mockResolvedValue(mockProfile);
      
      (moderationService.isUserBanned as jest.Mock).mockResolvedValue({
        banned: false,
      });
      
      (supabaseAdmin.from as jest.Mock).mockReturnValue({
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ data: null, error: null }),
      });
      
      const result = await authService.signIn(testUser.email, testUser.password);
      
      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('session');
      expect(result.user.email).toBe(testUser.email);
      expect(result.user.subscription_tier).toBe('plus');
      expect(result.session.access_token).toBeDefined();
    });

    it('should reject invalid credentials', async () => {
      (supabaseAdmin.auth.signInWithPassword as jest.Mock).mockResolvedValue({
        data: null,
        error: { message: 'Invalid login credentials' },
      });
      
      await expect(
        authService.signIn('wrong@email.com', 'wrongpassword')
      ).rejects.toThrow('Invalid credentials');
    });

    it('should reject banned users', async () => {
      const testUser = testUsers.banned;
      
      (supabaseAdmin.auth.signInWithPassword as jest.Mock).mockResolvedValue({
        data: { 
          user: { ...mockAuthUser, id: testUser.id },
          session: {
            access_token: 'test-access-token',
            refresh_token: 'test-refresh-token',
            expires_in: 3600,
            token_type: 'bearer'
          }
        },
        error: null,
      });
      
      (subscriptionService.getUserProfile as jest.Mock).mockResolvedValue({
        ...mockUserProfile,
        ...testUser,
      });
      
      (moderationService.isUserBanned as jest.Mock).mockResolvedValue({
        banned: true,
        reason: 'Terms of service violation',
      });
      
      await expect(
        authService.signIn(testUser.email, testUser.password)
      ).rejects.toThrow('Terms of service violation');
    });

    it('should handle missing user profile', async () => {
      const testUser = createTestUser();
      
      (supabaseAdmin.auth.signInWithPassword as jest.Mock).mockResolvedValue({
        data: { 
          user: { ...mockAuthUser, id: testUser.id },
          session: {
            access_token: 'test-access-token',
            refresh_token: 'test-refresh-token',
            expires_in: 3600,
            token_type: 'bearer'
          }
        },
        error: null,
      });
      
      (subscriptionService.getUserProfile as jest.Mock).mockResolvedValue(null);
      
      await expect(
        authService.signIn(testUser.email, testUser.password)
      ).rejects.toThrow('User profile not found');
    });
  });

  describe('refreshTokens', () => {
    it('should generate new tokens with valid refresh token', async () => {
      const testUser = testUsers.pro;
      const mockProfile = { ...mockUserProfile, ...testUser };
      
      (supabaseAdmin.auth.refreshSession as jest.Mock).mockResolvedValue({
        data: {
          session: {
            access_token: 'new-access-token',
            refresh_token: 'new-refresh-token',
            expires_in: 3600,
            token_type: 'bearer',
          },
          user: { ...mockAuthUser, id: testUser.id },
        },
        error: null,
      });
      
      (subscriptionService.getUserProfile as jest.Mock).mockResolvedValue(mockProfile);
      
      (moderationService.isUserBanned as jest.Mock).mockResolvedValue({
        banned: false,
      });
      
      const result = await authService.refreshTokens('valid-refresh-token');
      
      expect(result).toHaveProperty('access_token');
      expect(result).toHaveProperty('refresh_token');
      expect(result.access_token).toBe('new-access-token');
      expect(result.refresh_token).toBe('new-refresh-token');
    });

    it('should reject invalid refresh token', async () => {
      (supabaseAdmin.auth.refreshSession as jest.Mock).mockResolvedValue({
        data: null,
        error: { message: 'Invalid refresh token' },
      });
      
      await expect(
        authService.refreshTokens('invalid-token')
      ).rejects.toThrow('Invalid refresh token');
    });

    it('should reject expired refresh token', async () => {
      (supabaseAdmin.auth.refreshSession as jest.Mock).mockResolvedValue({
        data: null,
        error: { message: 'Refresh token expired' },
      });
      
      await expect(
        authService.refreshTokens('expired-token')
      ).rejects.toThrow('Invalid refresh token');
    });

    it('should reject access token as refresh token', async () => {
      (supabaseAdmin.auth.refreshSession as jest.Mock).mockResolvedValue({
        data: null,
        error: { message: 'Invalid token type' },
      });
      
      await expect(
        authService.refreshTokens('access-token')
      ).rejects.toThrow('Invalid refresh token');
    });

    it('should reject refresh for banned users', async () => {
      const testUser = testUsers.banned;
      
      (supabaseAdmin.auth.refreshSession as jest.Mock).mockResolvedValue({
        data: {
          session: {
            access_token: 'new-access-token',
            refresh_token: 'new-refresh-token',
            expires_in: 3600,
            token_type: 'bearer',
          },
          user: { ...mockAuthUser, id: testUser.id },
        },
        error: null,
      });
      
      (subscriptionService.getUserProfile as jest.Mock).mockResolvedValue({
        ...mockUserProfile,
        ...testUser,
      });
      
      (moderationService.isUserBanned as jest.Mock).mockResolvedValue({
        banned: true,
        reason: 'Account disabled',
      });
      
      await expect(
        authService.refreshTokens('valid-refresh-token')
      ).rejects.toThrow('Account is disabled');
    });
  });

  describe('getSession', () => {
    it('should return valid session for authenticated user', async () => {
      const testUser = testUsers.free;
      const mockProfile = { ...mockUserProfile, ...testUser };
      
      (subscriptionService.getUserProfile as jest.Mock).mockResolvedValue(mockProfile);
      
      (moderationService.isUserBanned as jest.Mock).mockResolvedValue({
        banned: false,
      });
      
      (subscriptionService.getUserLimits as jest.Mock).mockResolvedValue({
        daily_message_limit: 50,
        model_access: ['gpt-3.5-turbo'],
        features: ['basic_chat'],
      });
      
      const result = await authService.getSession(testUser.id);
      
      expect(result).toHaveProperty('user');
      expect(result.user.id).toBe(testUser.id);
      expect(result.user.email).toBe(testUser.email);
      expect(result.user.limits).toBeDefined();
    });

    it('should reject session for non-existent user', async () => {
      (subscriptionService.getUserProfile as jest.Mock).mockResolvedValue(null);
      
      await expect(
        authService.getSession('non-existent-id')
      ).rejects.toThrow('User not found');
    });

    it('should reject session for banned user', async () => {
      const testUser = testUsers.banned;
      const mockProfile = { ...mockUserProfile, ...testUser };
      
      (subscriptionService.getUserProfile as jest.Mock).mockResolvedValue(mockProfile);
      
      (moderationService.isUserBanned as jest.Mock).mockResolvedValue({
        banned: true,
        reason: 'Suspended for violations',
      });
      
      await expect(
        authService.getSession(testUser.id)
      ).rejects.toThrow('Suspended for violations');
    });
  });

  describe('resetPassword', () => {
    it('should send password reset email', async () => {
      const testUser = testUsers.free;
      
      (supabaseAdmin.auth.resetPasswordForEmail as jest.Mock).mockResolvedValue({
        data: {},
        error: null,
      });
      
      (supabaseAdmin.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { id: testUser.id },
          error: null,
        }),
      });
      
      const result = await authService.resetPassword(testUser.email);
      
      expect(result).toEqual({ success: true });
      expect(supabaseAdmin.auth.resetPasswordForEmail).toHaveBeenCalledWith(
        testUser.email,
        expect.objectContaining({
          redirectTo: expect.stringContaining('/reset-password'),
        })
      );
    });

    it('should handle reset for non-existent email gracefully', async () => {
      (supabaseAdmin.auth.resetPasswordForEmail as jest.Mock).mockResolvedValue({
        data: {},
        error: null,
      });
      
      (supabaseAdmin.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST116' },
        }),
      });
      
      // Should not throw error for security reasons
      const result = await authService.resetPassword('nonexistent@example.com');
      
      expect(result).toEqual({ success: true });
    });
  });

  describe('updatePassword', () => {
    it('should update password with valid current password', async () => {
      const testUser = testUsers.free;
      
      (supabaseAdmin.auth.updateUser as jest.Mock).mockResolvedValue({
        data: { 
          user: { ...mockAuthUser, id: testUser.id }
        },
        error: null,
      });
      
      (supabaseAdmin.from as jest.Mock).mockReturnValue({
        insert: jest.fn().mockResolvedValue({ data: null, error: null }),
      });
      
      const result = await authService.updatePassword('valid-access-token', 'NewPassword123!');
      
      expect(result).toEqual({ success: true });
      expect(supabaseAdmin.auth.updateUser).toHaveBeenCalledWith(
        'valid-access-token',
        { password: 'NewPassword123!' }
      );
    });

    it('should reject update with incorrect current password', async () => {
      (supabaseAdmin.auth.updateUser as jest.Mock).mockResolvedValue({
        data: null,
        error: { message: 'Invalid access token' },
      });
      
      await expect(
        authService.updatePassword('invalid-token', 'NewPassword123!')
      ).rejects.toThrow('Invalid access token');
    });
  });

  describe('createApiKey', () => {
    it('should create a new API key', async () => {
      const testUser = testUsers.pro;
      
      (supabaseAdmin.from as jest.Mock).mockReturnValue({
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            id: 'api-key-id',
            name: 'Test API Key',
            key: expect.stringMatching(/^sk_/),
            expires_at: null,
            created_at: new Date().toISOString(),
          },
          error: null,
        }),
      });
      
      const result = await authService.createApiKey(testUser.id, 'Test API Key');
      
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('key');
      expect(result.key).toMatch(/^sk_/);
      expect(result.name).toBe('Test API Key');
    });

    it('should create API key with expiration', async () => {
      const testUser = testUsers.pro;
      const expiresIn = 30 * 24 * 60 * 60 * 1000; // 30 days
      
      (supabaseAdmin.from as jest.Mock).mockReturnValue({
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            id: 'api-key-id',
            name: 'Temporary API Key',
            key: expect.stringMatching(/^sk_/),
            expires_at: new Date(Date.now() + expiresIn).toISOString(),
            created_at: new Date().toISOString(),
          },
          error: null,
        }),
      });
      
      const result = await authService.createApiKey(testUser.id, 'Temporary API Key', expiresIn);
      
      expect(result).toHaveProperty('expires_at');
      expect(result.expires_at).toBeDefined();
    });

    it('should handle database errors when creating API key', async () => {
      const testUser = testUsers.pro;
      
      (supabaseAdmin.from as jest.Mock).mockReturnValue({
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database error' },
        }),
      });
      
      await expect(
        authService.createApiKey(testUser.id, 'Failed API Key')
      ).rejects.toThrow('Failed to create API key');
    });
  });
});