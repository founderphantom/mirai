#!/usr/bin/env tsx
/**
 * Generate a new database migration from schema changes
 *
 * Usage: pnpm db:generate
 */

import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT_DIR = resolve(__dirname, '..')
const ENV_FILE = resolve(ROOT_DIR, '.env')

// Check for .env file
if (!existsSync(ENV_FILE)) {
  console.error('❌ .env file not found!')
  console.error('📝 Copy .env.example to .env and fill in your Cloudflare credentials')
  process.exit(1)
}

try {
  console.log('🔄 Generating migration from schema changes...\n')

  execSync('drizzle-kit generate', {
    cwd: ROOT_DIR,
    stdio: 'inherit',
  })

  console.log('\n✅ Migration generated successfully!')
  console.log('📂 Check drizzle/migrations/ for the new migration file')
  console.log('\n💡 Next steps:')
  console.log('  1. Review the generated SQL migration')
  console.log('  2. Test on a development database')
  console.log('  3. Run `pnpm db:push` to apply the migration')
} catch (error) {
  console.error('❌ Failed to generate migration:', error)
  process.exit(1)
}
