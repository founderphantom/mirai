# Better Auth Documentation

**Documentation compiled:** 2025-10-06
**Version:** Latest
**Project:** Mirai MVP - SaaS Authentication System

---

## Table of Contents

1. [Introduction](#introduction)
2. [Installation](#installation)
3. [Basic Usage](#basic-usage)
4. [Core Concepts](#core-concepts)
   - [API](#api)
   - [CLI](#cli)
   - [Client Library](#client-library)
   - [Database](#database)
   - [TypeScript Support](#typescript-support)
   - [Email & Verification](#email--verification)
   - [Hooks](#hooks)
   - [Plugins](#plugins)
   - [OAuth / Social Providers](#oauth--social-providers)
   - [Rate Limiting](#rate-limiting)
   - [Session Management](#session-management)
   - [Users & Accounts](#users--accounts)
5. [Drizzle ORM Adapter](#drizzle-orm-adapter)
6. [Integration with Mirai MVP](#integration-with-mirai-mvp)

---

## Introduction

Better Auth is a framework-agnostic authentication and authorization framework for TypeScript, designed to be comprehensive and extensible through a plugin ecosystem.

### Key Features

- **Advanced Authentication**: Supports out-of-the-box functionality including:
  - Two-factor authentication (2FA)
  - Passkey support
  - Multi-tenancy
  - Multi-session support
  - Enterprise features like Single Sign-On (SSO)
  - Custom Identity Providers (IDP)

- **Unique AI Tooling**:
  - Provides an `LLMs.txt` to help AI models understand system integration
  - Offers an MCP (Model Context Protocol) server for AI model interactions
  - Supports CLI configuration for various AI coding clients like Cursor, Claude Code, and Open Code
  - First-party MCP powered by Chonkie, with alternative providers available

### Core Value Proposition

"Better Auth lets you focus on building your application instead of reinventing the wheel" by providing a comprehensive authentication solution that can be easily customized and extended.

---

## Installation

### Step 1: Install Package

Install Better Auth using your preferred package manager:

```bash
# npm
npm install better-auth

# pnpm
pnpm add better-auth

# yarn
yarn add better-auth

# bun
bun add better-auth
```

### Step 2: Environment Variables

Create a `.env` file in your project root:

```env
BETTER_AUTH_SECRET=<randomly-generated-secret>
BETTER_AUTH_URL=http://localhost:3000
```

Generate a secret:
```bash
npx @better-auth/cli@latest secret
```

### Step 3: Create Auth Instance

Create an `auth.ts` file (server-side):

```typescript
import { betterAuth } from "better-auth"

export const auth = betterAuth({
  database: {
    // Database configuration (see Database section)
  },
  // Additional configuration
})
```

### Step 4: Configure Database

Supported database options:
- Direct database connections (SQLite, PostgreSQL, MySQL)
- ORM adapters (Drizzle, Prisma, MongoDB)

For this project, we'll use Drizzle ORM (see [Drizzle Adapter](#drizzle-orm-adapter) section).

### Step 5: Generate Database Tables

Use the CLI tool to generate and migrate database tables:

```bash
# Generate schema
npx @better-auth/cli generate

# Migrate (optional, for Kysely adapter)
npx @better-auth/cli migrate
```

### Step 6: Configure Authentication Methods

Enable email/password and social providers:

```typescript
export const auth = betterAuth({
  emailAndPassword: {
    enabled: true
  },
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    }
  }
})
```

### Step 7: Mount Server Handler

Create a route handler for `/api/auth/*` in your framework:

**Example (Next.js App Router):**
```typescript
// app/api/auth/[...all]/route.ts
import { auth } from "@/auth"

export const { GET, POST } = auth.handler
```

**Example (Hono on Cloudflare Workers):**
```typescript
import { Hono } from 'hono'
import { auth } from './auth'

const app = new Hono()

app.all('/api/auth/*', async (c) => {
  return auth.handler(c.req.raw)
})
```

### Step 8: Create Client Instance

Import and configure the client-side authentication:

```typescript
// lib/auth-client.ts
import { createAuthClient } from "@better-auth/react"

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"
})
```

---

## Basic Usage

### Email & Password Authentication

**Server Setup:**
```typescript
import { betterAuth } from "better-auth"

export const auth = betterAuth({
  emailAndPassword: {
    enabled: true
  }
})
```

**Sign Up:**
```typescript
const { data, error } = await authClient.signUp.email({
  email: "user@example.com",
  password: "securePassword123",
  name: "John Doe",
  callbackURL: "/dashboard"
})

if (error) {
  console.error("Sign up error:", error)
} else {
  console.log("User created:", data)
}
```

**Sign In:**
```typescript
const { data, error } = await authClient.signIn.email({
  email: "user@example.com",
  password: "securePassword123",
  callbackURL: "/dashboard"
})
```

### Social Sign-On

**Server Configuration:**
```typescript
export const auth = betterAuth({
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
    github: {
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    },
    discord: {
      clientId: process.env.DISCORD_CLIENT_ID!,
      clientSecret: process.env.DISCORD_CLIENT_SECRET!,
    }
  }
})
```

**Client Usage:**
```typescript
// Sign in with Google
await authClient.signIn.social({
  provider: "google",
  callbackURL: "/dashboard"
})
```

### Session Management

**Client-side (React):**
```typescript
import { useSession } from "@better-auth/react"

function App() {
  const { data: session, isPending, error } = useSession()

  if (isPending) return <div>Loading...</div>
  if (!session) return <LoginPage />

  return <Dashboard user={session.user} />
}
```

**Server-side:**
```typescript
const session = await auth.api.getSession({
  headers: await headers()
})

if (!session) {
  return new Response("Unauthorized", { status: 401 })
}
```

### Plugin Usage Example: Two-Factor Authentication

1. **Server configuration**
2. **Database migration**
3. **Client configuration**
4. **Enable/disable two-factor methods**

---

## Core Concepts

### API

The `api` object provides access to all server-side endpoints and can be called directly on the server using the `auth` instance.

#### API Interaction Principles

Endpoints require passing data as specific objects: `body`, `headers`, `query`.

**Server-Side API Call Example:**
```typescript
await auth.api.getSession({
  headers: await headers()
})
```

#### API Call Options

**1. Return Headers:**
```typescript
const { headers, response } = await auth.api.signUpEmail({
  returnHeaders: true,
  body: {
    email: "user@example.com",
    password: "password123",
    name: "John Doe"
  }
})
```

**2. Get Full Response:**
```typescript
const response = await auth.api.signInEmail({
  asResponse: true,
  body: {
    email: "user@example.com",
    password: "password123"
  }
})
```

#### Error Handling

```typescript
import { APIError } from "better-auth"

try {
  await auth.api.signInEmail({
    body: {
      email: "user@example.com",
      password: "wrongpassword"
    }
  })
} catch (error) {
  if (error instanceof APIError) {
    console.log(error.message, error.status)
  }
}
```

#### Available Endpoints

- `getSession()`
- `signInEmail()`
- `signUpEmail()`
- `verifyEmail()`
- And many more...

**Note:** Server-side requests made using `auth.api` aren't affected by rate limiting.

---

### CLI

The Better Auth CLI provides commands for schema generation, database migration, initialization, and diagnostics.

#### Available Commands

**1. `generate`**

Creates database schema for Better Auth.

```bash
npx @better-auth/cli@latest generate [options]
```

Options:
- `--output`: Specify schema save location
- `--config`: Specify config file path
- `--yes`: Skip confirmation prompt

**2. `migrate`**

Applies schema to database (Kysely adapter).

```bash
npx @better-auth/cli@latest migrate [options]
```

Options:
- `--config`: Specify config file path
- `--yes`: Skip confirmation prompt

**3. `init`**

Initializes Better Auth in your project.

```bash
npx @better-auth/cli@latest init [options]
```

Options:
- `--name`: Application name
- `--framework`: Project framework
- `--plugins`: Specify plugins
- `--database`: Choose database
- `--package-manager`: Select package manager

**4. `info`**

Provides diagnostic information about your Better Auth setup.

```bash
npx @better-auth/cli@latest info [options]
```

Options:
- `--config`: Specify config file path
- `--json`: Output as JSON

**5. `secret`**

Generates a secret key for Better Auth.

```bash
npx @better-auth/cli@latest secret
```

#### Example Usage

```bash
# Generate schema and save to custom location
npx @better-auth/cli@latest generate --output ./schema

# Initialize project with specific framework
npx @better-auth/cli@latest init --framework next --database drizzle
```

---

### Client Library

The Better Auth client library provides authentication functionality across multiple frontend frameworks (React, Vue, Svelte, Solid, Vanilla).

#### Installation

```bash
npm i better-auth
```

#### Client Setup

Create a client instance by importing the framework-specific `createAuthClient`:

```typescript
import { createAuthClient } from "better-auth/react"

export const authClient = createAuthClient({
  baseURL: "http://localhost:3000"
})
```

#### Core Features

**Authentication Methods:**
- Sign in with email/password
- Social login
- Magic link authentication

**Hooks:**

Provides reactive hooks like `useSession` to manage authentication state:

```typescript
const { data: session, isPending, error } = useSession()
```

**Error Handling:**

```typescript
const { error } = await authClient.signIn.email({
  email: "test@user.com",
  password: "password1234"
})

if (error) {
  console.error("Error:", error.message, error.status, error.statusText)
}
```

**Plugins:**

Extensible architecture allows adding functionality through plugins:

```typescript
import { createAuthClient } from "better-auth/react"
import { magicLinkClient } from "better-auth/plugins/magic-link"

export const authClient = createAuthClient({
  baseURL: "http://localhost:3000",
  plugins: [magicLinkClient()]
})
```

#### Framework Support

Better Auth provides consistent authentication experience across:
- React
- Vue
- Svelte
- Solid
- Vanilla JavaScript

---

### Database

Better Auth requires a database connection to store user, session, and plugin data.

#### Core Database Schema

The core schema includes four main tables:

1. **User**: Stores user profile information
2. **Session**: Tracks user sessions
3. **Account**: Manages authentication accounts
4. **Verification**: Handles verification requests

#### CLI Database Management

```bash
# Check and update database tables
npx @better-auth/cli migrate

# Generate database schema for different ORMs
npx @better-auth/cli generate
```

#### Database Configuration Options

**Custom Table and Column Names:**

```typescript
export const auth = betterAuth({
  advanced: {
    databaseType: "sqlite"
  }
})
```

**Extending Core Schema:**

```typescript
export const auth = betterAuth({
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: false,
        defaultValue: "user"
      },
      displayName: {
        type: "string",
        required: false
      }
    }
  }
})
```

**ID Generation Customization:**

```typescript
export const auth = betterAuth({
  advanced: {
    generateId: () => customIdGenerator()
  }
})
```

**Database Hooks:**

```typescript
export const auth = betterAuth({
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          console.log("Creating user:", user)
          return user
        },
        after: async (user) => {
          console.log("User created:", user)
        }
      }
    }
  }
})
```

#### Secondary Storage

Allows using key-value stores for session data:

```typescript
import { SecondaryStorage } from "better-auth"
import Redis from "ioredis"

const redis = new Redis()

const secondaryStorage: SecondaryStorage = {
  get: async (key) => {
    const value = await redis.get(key)
    return value ? JSON.parse(value) : null
  },
  set: async (key, value, ttl) => {
    await redis.set(key, JSON.stringify(value), 'EX', ttl)
  },
  delete: async (key) => {
    await redis.del(key)
  }
}

export const auth = betterAuth({
  secondaryStorage
})
```

---

### TypeScript Support

Better Auth is designed to be fully type-safe and built with TypeScript for both client and server.

#### TypeScript Configuration Recommendations

```json
{
  "compilerOptions": {
    "strict": true,
    // OR at minimum:
    "strictNullChecks": true
  }
}
```

#### Type Inference

Uses the `$Infer` property to extract types:

```typescript
// Infer Session type
type Session = typeof authClient.$Infer.Session

// Infer User type
type User = typeof authClient.$Infer.User
```

#### Additional Field Type Management

**Server-side (with additional fields):**
```typescript
export const auth = betterAuth({
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: false,
        defaultValue: "user",
        input: false // Don't allow input during signup
      }
    }
  }
})
```

**Client-side Type Inference Strategies:**

**Monorepo Approach:**
```typescript
import { inferAdditionalFields } from "better-auth/client/plugins"
import type { auth } from "@/server/auth"

export const authClient = createAuthClient({
  plugins: [
    inferAdditionalFields<typeof auth>()
  ]
})
```

**Separate Projects:**
```typescript
export const authClient = createAuthClient<{
  user: {
    role: string
    displayName: string
  }
}>({
  baseURL: "http://localhost:3000"
})
```

---

### Email & Verification

Email verification is a critical security feature that helps prevent spam and abuse.

#### Email Verification Configuration

**1. Automatic Verification on Signup:**
```typescript
export const auth = betterAuth({
  emailVerification: {
    sendOnSignUp: true
  }
})
```

**2. Require Email Verification Before Login:**
```typescript
export const auth = betterAuth({
  emailAndPassword: {
    requireEmailVerification: true
  }
})
```

**3. Manual Verification Trigger:**
```typescript
await authClient.sendVerificationEmail({
  email: "user@email.com",
  callbackURL: "/"
})
```

#### Verification Email Function

You must provide a `sendVerificationEmail` function:

```typescript
export const auth = betterAuth({
  emailVerification: {
    sendVerificationEmail: async ({ user, url, token }, request) => {
      // Use your email service (SendGrid, Resend, etc.)
      await sendEmail({
        to: user.email,
        subject: 'Verify your email address',
        html: `
          <h1>Email Verification</h1>
          <p>Click the link below to verify your email:</p>
          <a href="${url}">Verify Email</a>
          <p>Or use this code: ${token}</p>
        `
      })
    }
  }
})
```

#### Additional Features

**Auto Sign-in After Verification:**
```typescript
export const auth = betterAuth({
  emailVerification: {
    autoSignInAfterVerification: true
  }
})
```

**Custom Callback After Verification:**
```typescript
export const auth = betterAuth({
  emailVerification: {
    afterEmailVerification: async (user) => {
      console.log("User verified:", user.email)
      // Send welcome email, update analytics, etc.
    }
  }
})
```

#### Password Reset Email

```typescript
export const auth = betterAuth({
  emailAndPassword: {
    sendResetPassword: async ({ user, url, token }) => {
      await sendEmail({
        to: user.email,
        subject: 'Reset your password',
        html: `
          <h1>Password Reset</h1>
          <p>Click the link below to reset your password:</p>
          <a href="${url}">Reset Password</a>
        `
      })
    }
  }
})
```

---

### Hooks

Hooks allow you to modify requests and responses at specific points in the authentication flow.

#### Types of Hooks

**1. Before Hooks**

Run *before* an endpoint is executed. Used to:
- Modify requests
- Pre-validate data
- Return early

**2. After Hooks**

Run *after* an endpoint is executed. Used to modify responses.

#### Hook Creation

Hooks are created using `createAuthMiddleware()`:

```typescript
import { betterAuth, createAuthMiddleware } from "better-auth"

export const auth = betterAuth({
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      // Before hook logic
    }),
    after: createAuthMiddleware(async (ctx) => {
      // After hook logic
    })
  }
})
```

#### Hook Context (`ctx`)

**Available Properties:**
- `path`: Current endpoint path
- `body`: Parsed request body
- `headers`: Request headers
- `query`: Query parameters
- `context`: Auth-related context

**Context Methods:**
- `json()`: Send JSON responses
- `redirect()`: Redirect users
- `setCookies()`: Set cookies
- `getSignedCookie()`: Retrieve signed cookies
- `APIError()`: Throw specific error responses

#### Example Hooks

**Before Hook: Email Domain Restriction**
```typescript
export const auth = betterAuth({
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path === "/sign-up/email") {
        if (!ctx.body?.email.endsWith("@example.com")) {
          throw new APIError("BAD_REQUEST", {
            message: "Email must end with @example.com",
          })
        }
      }
    })
  }
})
```

**After Hook: User Registration Notification**
```typescript
export const auth = betterAuth({
  hooks: {
    after: createAuthMiddleware(async (ctx) => {
      if (ctx.path.startsWith("/sign-up")) {
        const newSession = ctx.context.newSession
        if (newSession) {
          // Send notification to admin
          await sendNotification({
            type: "user-register",
            name: newSession.user.name,
            email: newSession.user.email
          })
        }
      }
    })
  }
})
```

**Recommendation:** "We highly recommend using hooks if you need to make custom adjustments to an endpoint rather than making another endpoint outside of Better Auth."

---

### Plugins

Plugins extend the base functionalities of Better Auth and can be server-side, client-side, or both.

#### Key Plugin Capabilities

1. Create custom endpoints
2. Extend database schemas
3. Add middleware
4. Implement hooks
5. Modify request/response handling
6. Create custom rate-limit rules

#### Creating a Server Plugin

```typescript
import { betterAuth } from "better-auth"

const myPlugin = () => {
  return {
    id: "my-plugin",
    endpoints: {
      myEndpoint: {
        method: "POST",
        path: "/my-endpoint",
        handler: async (ctx) => {
          return { message: "Hello from my plugin!" }
        }
      }
    },
    schema: {
      // Custom database tables
    },
    hooks: {
      before: [
        // Before hooks
      ],
      after: [
        // After hooks
      ]
    },
    middlewares: [
      // Custom middleware
    ]
  }
}

export const auth = betterAuth({
  plugins: [myPlugin()]
})
```

#### Creating a Client Plugin

```typescript
const myClientPlugin = () => {
  return {
    id: "my-plugin", // Must match server plugin ID
    $InferServerPlugin: {} as ReturnType<typeof myPlugin>,
    endpoints: {
      myEndpoint: {
        method: "POST",
        path: "/my-endpoint"
      }
    },
    actions: {
      myAction: async (data) => {
        // Custom client-side action
      }
    }
  }
}

// Usage
import { createAuthClient } from "better-auth/react"

export const authClient = createAuthClient({
  plugins: [myClientPlugin()]
})
```

**Key Recommendation:** Keep server and client auth instances in separate files for better organization.

---

### OAuth / Social Providers

Better Auth supports OAuth 2.0 and OpenID Connect authentication with multiple social providers.

#### Supported Providers

- Google
- Facebook
- GitHub
- Discord
- TikTok
- Apple
- And more...
- Generic OAuth Plugin for custom providers

#### Configuration

**Required Credentials:**
- `clientId`
- `clientSecret`

**Optional Provider Settings:**
- `scope`: Define access permissions
- `redirectURI`: Custom callback URL
- `disableSignUp`: Prevent new user registration
- `mapProfileToUser`: Custom user profile mapping
- `refreshAccessToken`: Token renewal method
- `prompt`: Authentication flow control
- `responseMode`: Authorization response method

#### Example Configuration

```typescript
import { betterAuth } from "better-auth"

export const auth = betterAuth({
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      scope: ["email", "profile"]
    },
    github: {
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    },
    discord: {
      clientId: process.env.DISCORD_CLIENT_ID!,
      clientSecret: process.env.DISCORD_CLIENT_SECRET!,
    }
  }
})
```

#### Client Usage

```typescript
// Sign in with Google
await authClient.signIn.social({
  provider: "google",
  callbackURL: "/dashboard"
})

// Sign in with GitHub
await authClient.signIn.social({
  provider: "github",
  callbackURL: "/dashboard"
})
```

#### Custom User Mapping

```typescript
export const auth = betterAuth({
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      mapProfileToUser: (profile) => {
        return {
          email: profile.email,
          name: profile.name,
          image: profile.picture,
          emailVerified: profile.email_verified
        }
      }
    }
  }
})
```

#### Requesting Additional Scopes

You can request additional scopes after signup:

```typescript
await authClient.signIn.social({
  provider: "google",
  scope: ["email", "profile", "https://www.googleapis.com/auth/calendar"]
})
```

---

### Rate Limiting

Rate limiting helps protect your application from abuse and ensures fair usage.

#### Default Configuration

- **Production settings**: 60-second window, 100 max requests
- **Development**: Disabled by default

#### Basic Configuration

```typescript
export const auth = betterAuth({
  rateLimit: {
    window: 10,      // Time window in seconds
    max: 100,        // Max requests in window
    enabled: true    // Enable in development
  }
})
```

#### Custom Path Rules

```typescript
export const auth = betterAuth({
  rateLimit: {
    customRules: {
      "/sign-in/email": {
        window: 10,
        max: 3
      },
      "/two-factor/*": async (request) => ({
        window: 10,
        max: 3
      })
    }
  }
})
```

#### Storage Options

**In-memory (default):**
```typescript
export const auth = betterAuth({
  rateLimit: {
    storage: "memory"
  }
})
```

**Database storage:**
```typescript
export const auth = betterAuth({
  rateLimit: {
    storage: "database"
  }
})
```

Database schema for rate limiting:
```sql
CREATE TABLE rateLimit (
  id TEXT PRIMARY KEY,
  key TEXT NOT NULL,
  count INTEGER NOT NULL,
  lastRequest TIMESTAMP NOT NULL
);
```

**Secondary storage:**
```typescript
export const auth = betterAuth({
  rateLimit: {
    storage: "secondary"
  },
  secondaryStorage: redisStorage
})
```

**Custom storage:**
```typescript
import { RateLimitStorage } from "better-auth"

const customStorage: RateLimitStorage = {
  get: async (key) => {
    // Return { count, lastRequest }
  },
  set: async (key, value) => {
    // Store { count, lastRequest }
  },
  delete: async (key) => {
    // Delete rate limit data
  }
}

export const auth = betterAuth({
  rateLimit: {
    customStorage
  }
})
```

#### IP Address Tracking

```typescript
export const auth = betterAuth({
  rateLimit: {
    ipAddressHeaders: ["x-forwarded-for", "x-real-ip"]
  }
})
```

#### Error Handling

Rate limit errors return an `X-Retry-After` header:

```typescript
try {
  await authClient.signIn.email({ email, password })
} catch (error) {
  if (error.status === 429) {
    const retryAfter = error.headers?.["x-retry-after"]
    console.log(`Rate limited. Retry after ${retryAfter} seconds`)
  }
}
```

**Important:** Server-side requests made using `auth.api` aren't affected by rate limiting.

---

### Session Management

Better Auth uses cookie-based session management with configurable options.

#### Session Table Structure

- `id`: Session token
- `userId`: User identification
- `expiresAt`: Session expiration date
- `ipAddress`: User's IP address
- `userAgent`: Browser/device information

#### Session Configuration

**Expiration:**
```typescript
export const auth = betterAuth({
  session: {
    expiresIn: 7 * 24 * 60 * 60, // 7 days (in seconds)
    updateAge: 24 * 60 * 60       // Update every 24 hours
  }
})
```

**Session Freshness:**
```typescript
export const auth = betterAuth({
  session: {
    freshAge: 24 * 60 * 60 // 1 day
    // Set to 0 to disable freshness checking
  }
})
```

#### Session Management Functions

**Client-side:**

```typescript
// Get current session
const session = await authClient.getSession()

// Use session hook (React)
const { data: session, isPending, error } = useSession()

// List all user sessions
const sessions = await authClient.listSessions()

// Revoke specific session
await authClient.revokeSession({ sessionId: "session-id" })

// Revoke all other sessions
await authClient.revokeOtherSessions()

// Revoke all sessions
await authClient.revokeSessions()

// Sign out
await authClient.signOut()
```

**Server-side:**

```typescript
const session = await auth.api.getSession({
  headers: await headers()
})
```

#### Cookie Caching

Reduces database queries by storing session data in a signed cookie:

```typescript
export const auth = betterAuth({
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60 // 5-minute cache
    }
  }
})
```

#### Custom Session Response

Extend session data with additional fields:

```typescript
export const auth = betterAuth({
  session: {
    customSession: async (session) => {
      return {
        ...session,
        customField: "custom value",
        role: session.user.role
      }
    }
  }
})
```

---

### Users & Accounts

Better Auth provides comprehensive user and account management features.

#### User Information Updates

```typescript
// Client-side
await authClient.updateUser({
  name: "New Name",
  image: "https://example.com/avatar.png"
})

// Server-side
await auth.api.updateUser({
  body: {
    name: "New Name",
    image: "https://example.com/avatar.png"
  }
})
```

#### Email Management

**Enable email change:**
```typescript
export const auth = betterAuth({
  user: {
    changeEmail: {
      enabled: true,
      sendChangeEmailVerification: async ({ user, newEmail, url, token }) => {
        await sendEmail({
          to: newEmail,
          subject: "Verify your new email",
          html: `Click to verify: ${url}`
        })
      }
    }
  }
})
```

**Client usage:**
```typescript
await authClient.changeEmail({
  newEmail: "newemail@example.com",
  callbackURL: "/dashboard"
})
```

#### Password Management

**Client-side password change:**
```typescript
await authClient.changePassword({
  currentPassword: "oldPassword",
  newPassword: "newPassword",
  revokeOtherSessions: true // Optional
})
```

**Server-side password change:**
```typescript
await auth.api.changePassword({
  body: {
    currentPassword: "oldPassword",
    newPassword: "newPassword",
    revokeOtherSessions: true
  }
})
```

**Set password for OAuth users:**
```typescript
await authClient.setPassword({
  password: "newPassword"
})
```

#### User Deletion

**Configuration:**
```typescript
export const auth = betterAuth({
  user: {
    deleteUser: {
      enabled: true,
      sendDeleteAccountVerification: async ({ user, url, token }) => {
        await sendEmail({
          to: user.email,
          subject: "Confirm account deletion",
          html: `Click to confirm: ${url}`
        })
      },
      beforeDelete: async (user) => {
        console.log("Deleting user:", user.id)
        // Clean up user data, cancel subscriptions, etc.
      },
      afterDelete: async (user) => {
        console.log("User deleted:", user.id)
        // Send goodbye email, update analytics, etc.
      }
    }
  }
})
```

**Client usage:**
```typescript
await authClient.deleteUser({
  password: "currentPassword", // Required if password is set
  callbackURL: "/"
})
```

#### Account Linking

**Enable account linking:**
```typescript
export const auth = betterAuth({
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ["google", "github"] // Auto-link these providers
    }
  }
})
```

**Link social account:**
```typescript
await authClient.linkSocial({
  provider: "google",
  callbackURL: "/dashboard"
})
```

**Unlink account:**
```typescript
await authClient.unlinkAccount({
  accountId: "account-id"
})
```

---

## Drizzle ORM Adapter

The Drizzle adapter integrates Better Auth with Drizzle ORM, supporting multiple databases.

### Supported Databases

- MySQL
- PostgreSQL
- SQLite

### Basic Setup

**1. Install dependencies:**
```bash
pnpm add better-auth drizzle-orm
pnpm add -D drizzle-kit
```

**2. Configure auth with Drizzle adapter:**

```typescript
import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { db } from "./database"

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg", // or "sqlite" or "mysql"
  }),
})
```

### Schema Generation

**1. Generate Better Auth schema:**
```bash
npx @better-auth/cli@latest generate
```

This creates a schema file in your project (e.g., `schema.ts`).

**2. Generate migrations with Drizzle Kit:**
```bash
npx drizzle-kit generate
```

**3. Apply migrations:**
```bash
npx drizzle-kit migrate
```

### Example Drizzle Schema

```typescript
// schema.ts
import { pgTable, text, timestamp, boolean } from "drizzle-orm/pg-core"

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("emailVerified").notNull(),
  image: text("image"),
  createdAt: timestamp("createdAt").notNull(),
  updatedAt: timestamp("updatedAt").notNull(),
})

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expiresAt").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("createdAt").notNull(),
  updatedAt: timestamp("updatedAt").notNull(),
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
  userId: text("userId").notNull().references(() => user.id),
})

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("accountId").notNull(),
  providerId: text("providerId").notNull(),
  userId: text("userId").notNull().references(() => user.id),
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  idToken: text("idToken"),
  accessTokenExpiresAt: timestamp("accessTokenExpiresAt"),
  refreshTokenExpiresAt: timestamp("refreshTokenExpiresAt"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("createdAt").notNull(),
  updatedAt: timestamp("updatedAt").notNull(),
})

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt"),
  updatedAt: timestamp("updatedAt"),
})
```

### Advanced Configuration

**Custom Table Mapping:**

```typescript
import * as schema from "./schema"

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      ...schema,
      user: schema.users, // Map 'user' to 'users' table
    },
  }),
})
```

**Plural Table Names:**

```typescript
export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    usePlural: true, // Uses 'users', 'sessions', 'accounts', 'verifications'
  }),
})
```

### Database Setup Example (PostgreSQL)

```typescript
// database.ts
import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import * as schema from "./schema"

const queryClient = postgres(process.env.DATABASE_URL!)

export const db = drizzle(queryClient, { schema })
```

### Cloudflare D1 Example

```typescript
// For Cloudflare Workers with D1
import { drizzle } from "drizzle-orm/d1"
import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"

export default {
  async fetch(request: Request, env: Env) {
    const db = drizzle(env.DB)

    const auth = betterAuth({
      database: drizzleAdapter(db, {
        provider: "sqlite",
      }),
    })

    return auth.handler(request)
  }
}
```

---

## Integration with Mirai MVP

### Project Context

This Mirai MVP is a monorepo using:
- **Package Manager**: pnpm
- **Database ORM**: Drizzle ORM
- **Database Schema Location**: `packages/database-schema`
- **Platform**: Cloudflare Workers + D1
- **Architecture**: See `mvp-cloudflare-inworld-architecture.md`

### Recommended Setup for Mirai

**1. Install Better Auth in your monorepo:**

```bash
# From root
pnpm add better-auth -w

# Or in specific workspace
cd apps/workers/api-gateway
pnpm add better-auth
```

**2. Create auth configuration (`apps/workers/api-gateway/src/auth.ts`):**

```typescript
import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { db } from "@mirai/database-schema" // Your existing db instance

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "sqlite", // For Cloudflare D1
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
    discord: {
      clientId: process.env.DISCORD_CLIENT_ID!,
      clientSecret: process.env.DISCORD_CLIENT_SECRET!,
    }
  },
  user: {
    additionalFields: {
      displayName: {
        type: "string",
        required: false
      },
      avatarUrl: {
        type: "string",
        required: false
      },
      polarCustomerId: {
        type: "string",
        required: false
      },
      subscriptionTier: {
        type: "string",
        required: false,
        defaultValue: "free"
      },
      subscriptionStatus: {
        type: "string",
        required: false
      }
    }
  },
  session: {
    expiresIn: 7 * 24 * 60 * 60, // 7 days
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60 // 5 minutes
    }
  },
  rateLimit: {
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/email": {
        window: 10,
        max: 5
      }
    }
  }
})
```

**3. Generate schema in your database package:**

```bash
cd packages/database-schema
npx @better-auth/cli generate --output ./src/auth-schema.ts
```

**4. Add to your Drizzle schema:**

```typescript
// packages/database-schema/src/schema.ts
export * from "./auth-schema"
export * from "./characters"
export * from "./subscriptions"
// ... other schemas
```

**5. Run migrations:**

```bash
npx drizzle-kit generate
npx drizzle-kit migrate
# Or for D1:
wrangler d1 execute mirai-production --file=./migrations/0001_auth.sql
```

**6. Mount auth handler in API Gateway (`apps/workers/api-gateway/src/index.ts`):**

```typescript
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { auth } from './auth'

const app = new Hono<Env>()

app.use('*', cors())

// Mount Better Auth
app.all('/api/auth/*', async (c) => {
  return auth.handler(c.req.raw)
})

// Protected routes middleware
app.use('/api/*', async (c, next) => {
  const authHeader = c.req.header('Authorization')
  if (!authHeader) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const session = await auth.api.getSession({
    headers: c.req.raw.headers
  })

  if (!session) {
    return c.json({ error: 'Invalid session' }, 401)
  }

  c.set('user', session.user)
  c.set('session', session.session)
  await next()
})

// Your API routes
app.post('/api/characters/create', async (c) => {
  const user = c.get('user')
  // ... character creation logic
})

export default app
```

**7. Setup client in frontend (`apps/stage-web/src/lib/auth-client.ts`):**

```typescript
import { createAuthClient } from "@better-auth/react"

export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:3000"
})

export * from "@better-auth/react"
```

**8. Use in React components:**

```typescript
// apps/stage-web/src/App.tsx
import { useSession } from "./lib/auth-client"

function App() {
  const { data: session, isPending } = useSession()

  if (isPending) return <div>Loading...</div>
  if (!session) return <LoginPage />

  return <Dashboard user={session.user} />
}
```

### Environment Variables

Add to your `.env` file:

```env
# Better Auth
BETTER_AUTH_SECRET=<generated-secret>
BETTER_AUTH_URL=https://api.miraichat.app

# OAuth Providers
GOOGLE_CLIENT_ID=<your-google-client-id>
GOOGLE_CLIENT_SECRET=<your-google-client-secret>
DISCORD_CLIENT_ID=<your-discord-client-id>
DISCORD_CLIENT_SECRET=<your-discord-client-secret>

# Database
DATABASE_URL=<your-d1-connection-string>
```

### Polar Integration (Optional)

Better Auth has a Polar plugin for payment integration:

```typescript
import { polar } from 'better-auth/plugins/polar'

export const auth = betterAuth({
  // ... other config
  plugins: [
    polar({
      apiKey: process.env.POLAR_API_KEY!,
      createCustomerOnSignUp: true,
      use: [
        checkout({
          organizationId: process.env.POLAR_ORGANIZATION_ID!
        }),
        portal(),
        usage(),
        webhooks({
          secret: process.env.POLAR_WEBHOOK_SECRET!
        })
      ]
    })
  ]
})
```

### Next Steps

1. ✅ Generate auth schema with Better Auth CLI
2. ✅ Run Drizzle migrations to create auth tables
3. ✅ Configure OAuth providers (Google, Discord)
4. ✅ Setup email verification with your email service
5. ✅ Test authentication flow
6. ✅ Integrate with character creation and subscription management
7. ✅ Setup Polar plugin for payments

---

## Additional Resources

- [Better Auth Official Docs](https://www.better-auth.com/docs)
- [Better Auth GitHub](https://github.com/better-auth/better-auth)
- [Drizzle ORM Docs](https://orm.drizzle.team)
- [Cloudflare D1 Docs](https://developers.cloudflare.com/d1/)

---

**Document Version:** 1.0
**Last Updated:** 2025-10-06
**Compiled by:** Claude Code for Mirai MVP
