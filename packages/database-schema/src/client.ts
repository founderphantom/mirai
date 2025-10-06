/**
 * Database Client for Cloudflare Workers
 *
 * Creates a Drizzle ORM client for use in Cloudflare Workers with D1 binding
 */

import { drizzle } from 'drizzle-orm/d1'
import type { DrizzleD1Database } from 'drizzle-orm/d1'
import * as schema from './schema'

/**
 * Create a Drizzle client from a D1 binding
 *
 * @example
 * ```typescript
 * // In your Cloudflare Worker
 * import { createDbClient } from '@proj-airi/database-schema/client'
 *
 * export interface Env {
 *   DB: D1Database
 * }
 *
 * export default {
 *   async fetch(request: Request, env: Env) {
 *     const db = createDbClient(env.DB)
 *     const users = await db.select().from(schema.user)
 *     return Response.json(users)
 *   }
 * }
 * ```
 */
export function createDbClient(d1: D1Database): DrizzleD1Database<typeof schema> {
  return drizzle(d1, { schema })
}

/**
 * Export the database schema for direct use
 */
export { schema }

/**
 * Type for the database client
 */
export type DbClient = DrizzleD1Database<typeof schema>
