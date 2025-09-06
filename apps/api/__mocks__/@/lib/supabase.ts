import { jest } from '@jest/globals';
import { MockSupabaseClient } from '../../../tests/helpers/mock-supabase';

// Create mock instances with proper auth methods
const createAdminClient = () => {
  const client = new MockSupabaseClient();
  
  // Ensure auth methods are properly defined and mockable
  client.auth = {
    signUp: jest.fn().mockResolvedValue({ data: null, error: null }),
    signInWithPassword: jest.fn().mockResolvedValue({ data: null, error: null }),
    signOut: jest.fn().mockResolvedValue({ error: null }),
    resetPasswordForEmail: jest.fn().mockResolvedValue({ data: null, error: null }),
    getSession: jest.fn().mockResolvedValue({ data: null, error: null }),
    refreshSession: jest.fn().mockResolvedValue({ data: null, error: null }),
    updateUser: jest.fn().mockResolvedValue({ data: null, error: null }),
    getUser: jest.fn().mockResolvedValue({ data: null, error: null }),
    admin: {
      createUser: jest.fn().mockResolvedValue({ data: null, error: null }),
      deleteUser: jest.fn().mockResolvedValue({ data: null, error: null }),
      getUserById: jest.fn().mockResolvedValue({ data: null, error: null }),
      updateUserById: jest.fn().mockResolvedValue({ data: null, error: null }),
      signOut: jest.fn().mockResolvedValue({ error: null }),
    },
  };
  
  return client;
};

// Export the mocked supabase clients
export const supabaseAdmin = createAdminClient();
export const supabase = createAdminClient();

// Mock helper functions and other exports
export const getSupabaseClient = jest.fn(() => createAdminClient());
export const getUserScopedClient = jest.fn(() => createAdminClient());

export const securityHelpers = {
  verifyConversationOwnership: jest.fn().mockResolvedValue(true),
  verifyMessageOwnership: jest.fn().mockResolvedValue(true),
  checkUserRateLimits: jest.fn().mockResolvedValue({
    isAllowed: true,
    limit: 100,
    remaining: 99,
    resetAt: new Date(Date.now() + 3600000),
  }),
};

export const dbHelpers = {
  getUserById: jest.fn(),
  getUserProfile: jest.fn(),
  getUserSubscription: jest.fn(),
  updateUserProfile: jest.fn(),
  createConversation: jest.fn(),
  addMessage: jest.fn(),
  softDeleteMessage: jest.fn(),
  getConversationMessages: jest.fn(),
  updateUsageMetrics: jest.fn(),
  updateDailyAggregates: jest.fn(),
  checkRateLimit: jest.fn().mockResolvedValue(true),
  logApiRequest: jest.fn(),
  getUserUsageSummary: jest.fn(),
  searchMessages: jest.fn(),
  getConversationsWithLastMessage: jest.fn(),
  getConversationMessagesRPC: jest.fn(),
  getConversationSummary: jest.fn(),
  archiveOldConversations: jest.fn(),
  exportConversationJSON: jest.fn(),
};

export const realtimeHelpers = {
  subscribeToConversation: jest.fn(),
  subscribeToUserNotifications: jest.fn(),
  unsubscribe: jest.fn(),
};

export default supabase;