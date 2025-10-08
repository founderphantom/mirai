/**
 * Better-Auth Schema for Drizzle ORM
 *
 * This schema is compatible with better-auth's Drizzle adapter.
 * It includes the core auth tables plus custom extensions for Polar integration.
 *
 * @see https://www.better-auth.com/docs/adapters/drizzle
 */

import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

/**
 * User table
 * Core better-auth table with custom extensions for Polar and subscriptions
 */
export const user = sqliteTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: integer('emailVerified', { mode: 'boolean' }).notNull().default(false),
  image: text('image'),
  createdAt: integer('createdAt', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updatedAt', { mode: 'timestamp' }).notNull(),

  // Custom fields for Mirai
  displayName: text('display_name'),
  avatarUrl: text('avatar_url'),

  // Polar integration
  polarCustomerId: text('polar_customer_id'),
  subscriptionTier: text('subscription_tier', {
    enum: ['free', 'pro', 'enterprise']
  }).notNull().default('free'),
  subscriptionStatus: text('subscription_status', {
    enum: ['active', 'canceled', 'past_due', 'incomplete']
  }),
})

/**
 * Session table
 * Core better-auth table for managing user sessions
 */
export const session = sqliteTable('session', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  token: text('token').notNull().unique(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }),
})

/**
 * Account table
 * Core better-auth table for OAuth provider accounts
 */
export const account = sqliteTable('account', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  expiresAt: integer('expires_at', { mode: 'timestamp' }),
  accessTokenExpiresAt: integer('access_token_expires_at', { mode: 'timestamp' }),
  refreshTokenExpiresAt: integer('refresh_token_expires_at', { mode: 'timestamp' }),
  scope: text('scope'),
  password: text('password'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }),
})

/**
 * Verification table
 * Core better-auth table for email verification tokens
 */
export const verification = sqliteTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }),
  updatedAt: integer('updated_at', { mode: 'timestamp' }),
})

/**
 * Type exports for TypeScript
 */
export type User = typeof user.$inferSelect
export type NewUser = typeof user.$inferInsert

export type Session = typeof session.$inferSelect
export type NewSession = typeof session.$inferInsert

export type Account = typeof account.$inferSelect
export type NewAccount = typeof account.$inferInsert

export type Verification = typeof verification.$inferSelect
export type NewVerification = typeof verification.$inferInsert
