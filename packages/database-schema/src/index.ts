/**
 * @proj-airi/database-schema
 *
 * Database schema and Drizzle ORM configuration for the AIRI project
 * Supports Cloudflare D1, better-auth, and Polar integration
 */

// Re-export everything from schema
export * from './schema'

// Re-export client utilities
export { createDbClient, type DbClient } from './client'
