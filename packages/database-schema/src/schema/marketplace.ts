/**
 * Marketplace Schema
 *
 * Tables for character marketplace and purchases (future feature)
 */

import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { user } from './auth'
import { characters } from './characters'

/**
 * Marketplace items table
 * Characters published to the marketplace
 */
export const marketplaceItems = sqliteTable('marketplace_items', {
  id: text('id').primaryKey(),
  characterId: text('character_id')
    .references(() => characters.id, { onDelete: 'cascade' }),
  creatorUserId: text('creator_user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  priceCents: integer('price_cents').notNull(),
  purchaseCount: integer('purchase_count').default(0),
  ratingAvg: integer('rating_avg').default(0), // Stored as integer (multiply by 100 for precision)
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
})

/**
 * Purchases table
 * User purchases from marketplace
 */
export const purchases = sqliteTable('purchases', {
  id: text('id').primaryKey(),
  buyerUserId: text('buyer_user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  marketplaceItemId: text('marketplace_item_id')
    .notNull()
    .references(() => marketplaceItems.id, { onDelete: 'cascade' }),
  polarOrderId: text('polar_order_id'), // Polar order ID
  pricePaidCents: integer('price_paid_cents').notNull(),
  purchasedAt: integer('purchased_at', { mode: 'timestamp' }).notNull(),
})

/**
 * Type exports
 */
export type MarketplaceItem = typeof marketplaceItems.$inferSelect
export type NewMarketplaceItem = typeof marketplaceItems.$inferInsert

export type Purchase = typeof purchases.$inferSelect
export type NewPurchase = typeof purchases.$inferInsert
