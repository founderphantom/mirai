# @proj-airi/database-schema

Database schema and migrations for the AIRI project using Drizzle ORM with Cloudflare D1.

## Features

- 🗄️ **Drizzle ORM** - Type-safe database access with SQLite (D1)
- 🔐 **Better-Auth Integration** - Compatible schema for authentication
- 💳 **Polar Integration** - Subscription and payment management
- 🎭 **Character Management** - AI character ownership and configuration
- 📊 **Usage Tracking** - Usage-based billing support
- 🏪 **Marketplace Ready** - Schema for future character marketplace

## Installation

This package is part of the AIRI monorepo and uses pnpm workspaces:

```bash
pnpm install
```

## Database Setup

### 1. Create Cloudflare D1 Database

```bash
# Create the database
wrangler d1 create mirai-production

# Note the database_id from the output
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env` and fill in your Cloudflare credentials:

```env
CLOUDFLARE_ACCOUNT_ID=your_account_id_here
CLOUDFLARE_D1_DATABASE_ID=your_d1_database_id_here
CLOUDFLARE_API_TOKEN=your_api_token_here
DATABASE_NAME=mirai-production
```

### 3. Generate Migrations

```bash
pnpm db:generate
```

This will create migration files in `drizzle/migrations/`.

### 4. Apply Migrations

```bash
pnpm db:push
```

Or use Wrangler:

```bash
wrangler d1 execute mirai-production --file=./drizzle/migrations/0000_initial.sql
```

## Usage in Cloudflare Workers

### Setting up the Worker

First, add the D1 binding to your `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "mirai-production"
database_id = "your-database-id"
```

### Using the Database Client

```typescript
import { createDbClient } from '@proj-airi/database-schema/client'
import { user, characters } from '@proj-airi/database-schema/schema'

export interface Env {
  DB: D1Database
}

export default {
  async fetch(request: Request, env: Env) {
    const db = createDbClient(env.DB)

    // Query users
    const users = await db.select().from(user)

    // Create a character
    const newCharacter = await db.insert(characters).values({
      id: crypto.randomUUID(),
      userId: 'user-123',
      inworldCharacterId: 'inworld-abc',
      displayName: 'My Character',
      personalityConfig: {
        motivations: ['Help people'],
        flaws: ['Too helpful'],
        dialogueStyle: 'Friendly',
        adjectives: ['Kind', 'Empathetic']
      },
      createdAt: new Date(),
      updatedAt: new Date()
    })

    return Response.json({ users, newCharacter })
  }
}
```

### Better-Auth Integration

The schema is compatible with better-auth's Drizzle adapter:

```typescript
import { betterAuth } from 'better-auth'
import { createDbClient } from '@proj-airi/database-schema/client'
import { polar } from '@polar-sh/better-auth'

export const auth = betterAuth({
  database: {
    provider: 'd1',
    d1: env.DB
  },
  plugins: [
    polar({
      // Polar configuration
    })
  ]
})
```

## Schema Overview

### Auth Tables

- **user** - User accounts with Polar integration
- **session** - User sessions
- **account** - OAuth provider accounts
- **verification** - Email verification tokens

### Application Tables

- **characters** - User-owned AI characters
- **conversations** - Conversation metadata
- **voiceSessions** - Voice session tracking
- **subscriptions** - Polar subscription data
- **usageEvents** - Usage-based billing events

### Marketplace Tables (Future)

- **marketplaceItems** - Published characters
- **purchases** - Marketplace transactions

## Development

### Build

```bash
pnpm build
```

### Watch Mode

```bash
pnpm dev
```

### Type Check

```bash
pnpm typecheck
```

### Drizzle Studio

Open Drizzle Studio to browse your database:

```bash
pnpm db:studio
```

## Migration Workflow

1. **Modify Schema** - Edit files in `src/schema/`
2. **Generate Migration** - Run `pnpm db:generate`
3. **Review Migration** - Check generated SQL in `drizzle/migrations/`
4. **Apply Migration** - Run `pnpm db:push` or use Wrangler
5. **Commit Changes** - Commit both schema and migration files

## Scripts

- `pnpm build` - Build the package
- `pnpm dev` - Watch mode for development
- `pnpm typecheck` - Run TypeScript type checking
- `pnpm db:generate` - Generate migrations from schema changes
- `pnpm db:migrate` - Apply migrations to database
- `pnpm db:push` - Push schema changes directly (dev only)
- `pnpm db:studio` - Open Drizzle Studio
- `pnpm db:drop` - Drop a migration

## Type Safety

All tables export TypeScript types:

```typescript
import type { User, Character, Subscription } from '@proj-airi/database-schema'

// Select types (full row)
type UserRow = User

// Insert types (for creation)
type NewUserData = NewUser
```

## Best Practices

1. **Always use migrations** in production - Don't use `db:push`
2. **Review generated SQL** before applying migrations
3. **Test migrations** on a development database first
4. **Use transactions** for multi-step operations
5. **Add indexes** for frequently queried columns

## Cloudflare D1 Considerations

- D1 uses SQLite syntax
- Timestamp columns use integer storage (Unix timestamps)
- JSON columns stored as TEXT
- Foreign keys supported with `onDelete` cascades
- Indexes automatically created from schema

## Resources

- [Drizzle ORM Documentation](https://orm.drizzle.team)
- [Cloudflare D1 Documentation](https://developers.cloudflare.com/d1/)
- [Better-Auth Documentation](https://www.better-auth.com)
- [Polar Documentation](https://polar.sh/docs)

## License

MIT
