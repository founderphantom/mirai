import { nanoid } from 'nanoid';

export interface TestUser {
  id: string;
  email: string;
  password: string;
  full_name: string;
  avatar_url: string | null;
  subscription_tier: 'free' | 'plus' | 'pro' | 'enterprise';
  subscription_status: 'active' | 'canceled' | 'past_due' | 'incomplete';
  daily_message_count: number;
  total_message_count: number;
  created_at: string;
  updated_at: string;
}

export const testUsers: Record<string, TestUser> = {
  free: {
    id: 'user_free_' + nanoid(10),
    email: 'free.user@test.com',
    password: 'Test123!@#',
    full_name: 'Free User',
    avatar_url: null,
    subscription_tier: 'free',
    subscription_status: 'active',
    daily_message_count: 0,
    total_message_count: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  plus: {
    id: 'user_plus_' + nanoid(10),
    email: 'plus.user@test.com',
    password: 'Test123!@#',
    full_name: 'Plus User',
    avatar_url: 'https://example.com/avatar-plus.jpg',
    subscription_tier: 'plus',
    subscription_status: 'active',
    daily_message_count: 10,
    total_message_count: 150,
    created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  pro: {
    id: 'user_pro_' + nanoid(10),
    email: 'pro.user@test.com',
    password: 'Test123!@#',
    full_name: 'Pro User',
    avatar_url: 'https://example.com/avatar-pro.jpg',
    subscription_tier: 'pro',
    subscription_status: 'active',
    daily_message_count: 50,
    total_message_count: 1500,
    created_at: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  enterprise: {
    id: 'user_enterprise_' + nanoid(10),
    email: 'enterprise.user@test.com',
    password: 'Test123!@#',
    full_name: 'Enterprise User',
    avatar_url: 'https://example.com/avatar-enterprise.jpg',
    subscription_tier: 'enterprise',
    subscription_status: 'active',
    daily_message_count: 500,
    total_message_count: 15000,
    created_at: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  banned: {
    id: 'user_banned_' + nanoid(10),
    email: 'banned.user@test.com',
    password: 'Test123!@#',
    full_name: 'Banned User',
    avatar_url: null,
    subscription_tier: 'free',
    subscription_status: 'canceled',
    daily_message_count: 0,
    total_message_count: 0,
    created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  expired: {
    id: 'user_expired_' + nanoid(10),
    email: 'expired.user@test.com',
    password: 'Test123!@#',
    full_name: 'Expired User',
    avatar_url: null,
    subscription_tier: 'plus',
    subscription_status: 'past_due',
    daily_message_count: 0,
    total_message_count: 100,
    created_at: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  admin: {
    id: 'user_admin_' + nanoid(10),
    email: 'admin.user@test.com',
    password: 'Test123!@#',
    full_name: 'Admin User',
    avatar_url: 'https://example.com/avatar-admin.jpg',
    subscription_tier: 'enterprise',
    subscription_status: 'active',
    daily_message_count: 1000,
    total_message_count: 50000,
    created_at: new Date(Date.now() - 730 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  },
};

export function createTestUser(overrides?: Partial<TestUser>): TestUser {
  return {
    id: 'user_test_' + nanoid(10),
    email: `test.${nanoid(8)}@test.com`,
    password: 'Test123!@#',
    full_name: 'Test User',
    avatar_url: null,
    subscription_tier: 'free',
    subscription_status: 'active',
    daily_message_count: 0,
    total_message_count: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

export const invalidEmails = [
  'invalid',
  '@test.com',
  'test@',
  'test@.com',
  'test..user@test.com',
  'test user@test.com',
  'test@test',
];

export const weakPasswords = [
  '123456',
  'password',
  'test',
  'Test1',
  'test123',
  '        ',
];

export const validPasswords = [
  'Test123!@#',
  'SecureP@ssw0rd',
  'MyV3ryStr0ng!Pass',
  'C0mpl3x&P@ssword',
];