# Database Setup Guide

Step-by-step guide to set up the database schema for the AIRI project.

## Prerequisites

- Cloudflare account with Workers/D1 enabled
- Wrangler CLI installed (`npm install -g wrangler`)
- Access to Cloudflare dashboard

## Step 1: Create Cloudflare D1 Database

### Using Wrangler CLI

```bash
# Login to Cloudflare
wrangler login

# Create the D1 database
wrangler d1 create mirai-production

# Save the output - you'll need the database_id
```

The output will look like:

```
✅ Successfully created DB 'mirai-production'

[[d1_databases]]
binding = "DB"
database_name = "mirai-production"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

### Using Cloudflare Dashboard

1. Go to **Cloudflare Dashboard** → **Workers & Pages** → **D1**
2. Click **Create database**
3. Name it `mirai-production`
4. Click **Create**
5. Copy the **Database ID** from the database page

## Step 2: Get Cloudflare Credentials

### Account ID

1. Go to **Cloudflare Dashboard**
2. Click on any domain
3. Copy **Account ID** from the right sidebar

### API Token

1. Go to **Cloudflare Dashboard** → **My Profile** → **API Tokens**
2. Click **Create Token**
3. Use template: **Edit Cloudflare Workers**
4. Or create custom token with these permissions:
   - Account → D1 → Edit
   - Account → Workers Scripts → Edit
5. Click **Continue to summary** → **Create Token**
6. **Copy the token immediately** (you won't see it again)

## Step 3: Configure Environment

```bash
cd packages/database-schema

# Copy the example env file
cp .env.example .env

# Edit .env with your credentials
nano .env
```

Fill in your `.env`:

```env
CLOUDFLARE_ACCOUNT_ID=your_account_id_here
CLOUDFLARE_D1_DATABASE_ID=your_d1_database_id_here
CLOUDFLARE_API_TOKEN=your_api_token_here
DATABASE_NAME=mirai-production
```

## Step 4: Install Dependencies

```bash
# From the monorepo root
pnpm install

# Or from packages/database-schema
cd packages/database-schema
pnpm install
```

## Step 5: Generate Initial Migration

```bash
cd packages/database-schema

# Generate SQL migration from schema
pnpm db:generate
```

This creates a migration file in `drizzle/migrations/`.

## Step 6: Review the Migration

```bash
# Check the generated SQL
cat drizzle/migrations/0000_*.sql
```

The migration should include:
- `user`, `session`, `account`, `verification` tables (better-auth)
- `subscriptions`, `usage_events` tables (Polar)
- `characters`, `conversations`, `voice_sessions` tables (app)
- `marketplace_items`, `purchases` tables (marketplace)

## Step 7: Apply Migration to D1

### Option A: Using Wrangler (Recommended)

```bash
# Apply the migration
wrangler d1 execute mirai-production --file=./drizzle/migrations/0000_*.sql

# Verify tables were created
wrangler d1 execute mirai-production --command="SELECT name FROM sqlite_master WHERE type='table';"
```

### Option B: Using Drizzle Kit Push

```bash
pnpm db:push
```

**⚠️ Warning:** This pushes schema directly without migration history. Use only for development.

## Step 8: Verify Database Schema

```bash
# List all tables
wrangler d1 execute mirai-production --command="SELECT name FROM sqlite_master WHERE type='table';"

# Expected tables:
# - user
# - session
# - account
# - verification
# - subscriptions
# - usage_events
# - characters
# - conversations
# - voice_sessions
# - marketplace_items
# - purchases
```

## Step 9: Browse Database with Drizzle Studio

```bash
cd packages/database-schema

# Launch Drizzle Studio
pnpm db:studio
```

This opens a local web UI at `https://local.drizzle.studio` where you can:
- Browse tables
- View data
- Run queries
- Insert test data

## Step 10: Configure Workers

Add the D1 binding to your worker's `wrangler.toml`:

```toml
# apps/workers/api-gateway/wrangler.toml

name = "api-gateway"
main = "src/index.ts"
compatibility_date = "2025-01-01"

[[d1_databases]]
binding = "DB"
database_name = "mirai-production"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

## Step 11: Test Database Connection

Create a test worker:

```typescript
// apps/workers/api-gateway/src/test-db.ts
import { createDbClient } from '@proj-airi/database-schema/client'
import { user } from '@proj-airi/database-schema/schema'

export interface Env {
  DB: D1Database
}

export default {
  async fetch(request: Request, env: Env) {
    const db = createDbClient(env.DB)

    // Query all users
    const users = await db.select().from(user)

    return Response.json({
      success: true,
      userCount: users.length,
      users
    })
  }
}
```

Deploy and test:

```bash
wrangler deploy
curl https://your-worker.workers.dev
```

## Common Issues

### Issue: "Database not found"

**Solution:** Check your `CLOUDFLARE_D1_DATABASE_ID` in `.env`

```bash
wrangler d1 list
```

### Issue: "Unauthorized" or "Invalid API token"

**Solution:** Regenerate your API token with D1 permissions

### Issue: "Table already exists"

**Solution:** The migration was already applied. Check migration history:

```bash
wrangler d1 execute mirai-production --command="SELECT * FROM __drizzle_migrations;"
```

### Issue: Drizzle Studio won't connect

**Solution:** Make sure `.env` is configured correctly and the database exists

## Next Steps

1. ✅ **Set up Better-Auth** in your API gateway worker
2. ✅ **Configure Polar** webhooks for subscription sync
3. ✅ **Implement character creation** endpoints
4. ✅ **Add usage tracking** for billing

## Resources

- [Drizzle ORM Docs](https://orm.drizzle.team)
- [Cloudflare D1 Docs](https://developers.cloudflare.com/d1/)
- [Wrangler CLI Docs](https://developers.cloudflare.com/workers/wrangler/)
- [Better-Auth Docs](https://www.better-auth.com)
- [Polar API Docs](https://polar.sh/docs)

## Support

For issues with:
- **Drizzle ORM:** Check [Drizzle Discord](https://dsc.gg/drizzle)
- **Cloudflare D1:** Check [Cloudflare Discord](https://discord.cloudflare.com)
- **Better-Auth:** Check [Better-Auth GitHub](https://github.com/better-auth/better-auth)
