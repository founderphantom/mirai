/**
 * Subscription and Payment Schema
 *
 * Tables for managing Polar subscriptions and usage-based billing
 */

import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { user } from './auth'

/**
 * Subscriptions table
 * Synced from Polar webhooks
 */
export const subscriptions = sqliteTable('subscriptions', {
  id: text('id').primaryKey(), // Polar subscription ID
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  polarCustomerId: text('polar_customer_id').notNull(),
  productId: text('product_id').notNull(), // Polar product ID
  priceId: text('price_id').notNull(), // Polar price ID
  status: text('status', {
    enum: ['active', 'canceled', 'incomplete', 'past_due', 'trialing']
  }).notNull(),
  currentPeriodStart: integer('current_period_start', { mode: 'timestamp' }).notNull(),
  currentPeriodEnd: integer('current_period_end', { mode: 'timestamp' }).notNull(),
  cancelAtPeriodEnd: integer('cancel_at_period_end', { mode: 'boolean' }).default(false),
  canceledAt: integer('canceled_at', { mode: 'timestamp' }),
  // Trial information
  trialStart: integer('trial_start', { mode: 'timestamp' }),
  trialEnd: integer('trial_end', { mode: 'timestamp' }),
  // Metadata
  metadata: text('metadata', { mode: 'json' }), // Store additional Polar metadata
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
}, (table) => ({
  userIdIdx: index('idx_user_subscription').on(table.userId),
  polarCustomerIdx: index('idx_polar_customer').on(table.polarCustomerId),
  statusIdx: index('idx_subscription_status').on(table.status),
}))

/**
 * Usage events table
 * For usage-based billing via Polar
 */
export const usageEvents = sqliteTable('usage_events', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  eventType: text('event_type', {
    enum: ['voice_minutes', 'character_creation', 'message_sent']
  }).notNull(),
  quantity: integer('quantity').notNull(), // e.g., number of minutes
  metadata: text('metadata', { mode: 'json' }), // Additional context as JSON
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  polarSynced: integer('polar_synced', { mode: 'boolean' }).default(false),
}, (table) => ({
  userUsageIdx: index('idx_user_usage').on(table.userId, table.createdAt),
  polarSyncIdx: index('idx_polar_sync').on(table.polarSynced, table.createdAt),
}))

/**
 * Type exports
 */
export type Subscription = typeof subscriptions.$inferSelect
export type NewSubscription = typeof subscriptions.$inferInsert

export type UsageEvent = typeof usageEvents.$inferSelect
export type NewUsageEvent = typeof usageEvents.$inferInsert
