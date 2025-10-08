# Authentication Setup Guide

## Issue: 500 Error on Sign In with Google

The authentication endpoints are returning 500 errors because required environment variables (secrets) are not configured in Cloudflare Workers.

## Root Cause

The API Gateway requires the following secrets to be configured:

### ❌ Missing Secrets:
- `BETTER_AUTH_SECRET` - Secret key for Better-Auth
- `GOOGLE_CLIENT_ID` - Google OAuth client ID
- `GOOGLE_CLIENT_SECRET` - Google OAuth client secret
- `DISCORD_CLIENT_ID` - Discord OAuth client ID (optional)
- `DISCORD_CLIENT_SECRET` - Discord OAuth client secret (optional)
- `POLAR_ACCESS_TOKEN` - Polar payment platform token
- `POLAR_ORGANIZATION_ID` - Polar organization ID
- `POLAR_WEBHOOK_SECRET` - Polar webhook secret
- `INWORLD_API_KEY` - Inworld AI API key
- `INWORLD_WORKSPACE_ID` - Inworld AI workspace ID

### ✅ Already Configured:
- `ENVIRONMENT` = "production"
- `BETTER_AUTH_URL` = "https://api.miraichat.app"
- D1 Database binding
- R2 Bucket binding
- KV Namespace bindings

---

## Step 1: Generate Better-Auth Secret

```bash
# Install Better-Auth CLI
npm install -g @better-auth/cli

# Generate a secure secret
npx @better-auth/cli secret
```

Copy the generated secret - you'll need it in Step 4.

---

## Step 2: Set Up Google OAuth

### 2.1 Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Navigate to **APIs & Services** → **Credentials**

### 2.2 Configure OAuth Consent Screen

1. Click **OAuth consent screen** (left sidebar)
2. Select **External** user type
3. Fill in:
   - App name: `Mirai`
   - User support email: your email
   - Developer contact: your email
4. Click **Save and Continue**
5. Skip **Scopes** (click Save and Continue)
6. Add test users if needed
7. Click **Save and Continue**

### 2.3 Create OAuth Credentials

1. Go to **Credentials** tab
2. Click **Create Credentials** → **OAuth client ID**
3. Application type: **Web application**
4. Name: `Mirai Production`
5. **Authorized redirect URIs**:
   ```
   https://api.miraichat.app/api/auth/callback/google
   https://mirai-api-gateway.founder-968.workers.dev/api/auth/callback/google
   ```
6. Click **Create**
7. **Copy the Client ID and Client Secret** - you'll need them in Step 4

---

## Step 3: Set Up Discord OAuth (Optional)

### 3.1 Create Discord Application

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click **New Application**
3. Name: `Mirai`
4. Click **Create**

### 3.2 Configure OAuth2

1. Navigate to **OAuth2** → **General**
2. **Redirects**:
   ```
   https://api.miraichat.app/api/auth/callback/discord
   https://mirai-api-gateway.founder-968.workers.dev/api/auth/callback/discord
   ```
3. Click **Save Changes**
4. **Copy Client ID and Client Secret** - you'll need them in Step 4

---

## Step 4: Configure Cloudflare Secrets

### Option A: Using Wrangler CLI (Recommended)

```bash
cd apps/workers/api-gateway

# Set Better-Auth secret
wrangler secret put BETTER_AUTH_SECRET
# Paste the secret from Step 1

# Set Google OAuth credentials
wrangler secret put GOOGLE_CLIENT_ID
# Paste Google Client ID from Step 2

wrangler secret put GOOGLE_CLIENT_SECRET
# Paste Google Client Secret from Step 2

# Set Discord OAuth credentials (optional)
wrangler secret put DISCORD_CLIENT_ID
# Paste Discord Client ID from Step 3

wrangler secret put DISCORD_CLIENT_SECRET
# Paste Discord Client Secret from Step 3

# Set Polar credentials (get these from Polar dashboard)
wrangler secret put POLAR_ACCESS_TOKEN
wrangler secret put POLAR_ORGANIZATION_ID
wrangler secret put POLAR_WEBHOOK_SECRET

# Set Inworld AI credentials (get these from Inworld dashboard)
wrangler secret put INWORLD_API_KEY
wrangler secret put INWORLD_WORKSPACE_ID
```

### Option B: Using Cloudflare Dashboard

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Navigate to **Workers & Pages**
3. Click on your worker: `mirai-api-gateway`
4. Go to **Settings** → **Variables and Secrets**
5. Under **Environment Variables**, click **Add variable**
6. Add each secret:
   - Variable name: `BETTER_AUTH_SECRET`
   - Value: (paste the secret)
   - Click **Encrypt** checkbox
   - Click **Add variable**
7. Repeat for all secrets listed above

---

## Step 5: Apply Database Migration

The database schema needs to be initialized with Better-Auth tables.

### 5.1 Check Current Database Status

```bash
# List all tables in the database
wrangler d1 execute mirai-production --command="SELECT name FROM sqlite_master WHERE type='table';"
```

### 5.2 Apply Migration (if tables don't exist)

```bash
cd packages/database-schema

# Apply the migration to production database
wrangler d1 execute mirai-production --file=./drizzle/migrations/0000_classy_sasquatch.sql
```

### 5.3 Verify Tables Were Created

```bash
wrangler d1 execute mirai-production --command="SELECT name FROM sqlite_master WHERE type='table';"
```

Expected tables:
- ✅ `user`
- ✅ `session`
- ✅ `account`
- ✅ `verification`
- ✅ `subscriptions`
- ✅ `usage_events`
- ✅ `characters`
- ✅ `conversations`
- ✅ `voice_sessions`
- ✅ `marketplace_items`
- ✅ `purchases`

---

## Step 6: Deploy API Gateway

```bash
cd apps/workers/api-gateway

# Deploy the worker with new secrets
wrangler deploy
```

---

## Step 7: Test Authentication

### 7.1 Test Health Endpoint

```bash
curl https://mirai-api-gateway.founder-968.workers.dev/health
```

Expected response:
```json
{
  "status": "ok",
  "environment": "production",
  "timestamp": "2025-10-08T..."
}
```

### 7.2 Test Google OAuth Flow

1. Open your frontend: `https://miraichat.app` or `https://mirai-stage-web.founder-968.workers.dev`
2. Click **Sign In**
3. Click **Sign in with Google**
4. You should be redirected to Google login
5. After successful login, you should be redirected back to the dashboard

---

## Step 8: Monitor Logs

### View Worker Logs

```bash
# Stream logs in real-time
wrangler tail mirai-api-gateway
```

### Check for Errors

Look for:
- ❌ `[AUTH] Missing environment variable` - Secret not configured
- ❌ `Database error` - Migration not applied
- ❌ `OAuth error` - Check redirect URIs in Google/Discord console
- ✅ `[AUTH] User signed in` - Success!

---

## Troubleshooting

### Error: "Invalid client ID"

**Cause:** `GOOGLE_CLIENT_ID` is not set or incorrect.

**Solution:**
```bash
wrangler secret put GOOGLE_CLIENT_ID
# Paste the correct Client ID from Google Cloud Console
```

### Error: "Redirect URI mismatch"

**Cause:** The redirect URI in Google Cloud Console doesn't match.

**Solution:**
1. Go to Google Cloud Console → Credentials
2. Edit your OAuth client
3. Add both redirect URIs:
   - `https://api.miraichat.app/api/auth/callback/google`
   - `https://mirai-api-gateway.founder-968.workers.dev/api/auth/callback/google`

### Error: "Database error: no such table: user"

**Cause:** Database migration was not applied.

**Solution:**
```bash
cd packages/database-schema
wrangler d1 execute mirai-production --file=./drizzle/migrations/0000_classy_sasquatch.sql
```

### Error: "Secret key is required"

**Cause:** `BETTER_AUTH_SECRET` is not set.

**Solution:**
```bash
npx @better-auth/cli secret
wrangler secret put BETTER_AUTH_SECRET
# Paste the generated secret
```

---

## Temporary Workaround: Disable OAuth (Development Only)

If you need to test without OAuth temporarily:

1. Edit `apps/workers/api-gateway/src/lib/auth.ts`
2. Comment out the `socialProviders` section:

```typescript
// socialProviders: {
//   google: {
//     clientId: env.GOOGLE_CLIENT_ID,
//     clientSecret: env.GOOGLE_CLIENT_SECRET,
//     scope: ['email', 'profile'],
//   },
//   discord: {
//     clientId: env.DISCORD_CLIENT_ID,
//     clientSecret: env.DISCORD_CLIENT_SECRET,
//     scope: ['identify', 'email'],
//   },
// },
```

3. Use email/password sign up instead

**⚠️ Warning:** This is only for development. Do not deploy to production without proper OAuth.

---

## Next Steps

Once authentication is working:

1. ✅ Test sign up with email/password
2. ✅ Test sign in with Google
3. ✅ Test sign in with Discord
4. ✅ Configure Polar for payments (optional)
5. ✅ Configure Inworld AI for character conversations

---

## Support

- **Better-Auth:** https://www.better-auth.com/docs
- **Google OAuth:** https://developers.google.com/identity/protocols/oauth2
- **Discord OAuth:** https://discord.com/developers/docs/topics/oauth2
- **Cloudflare Workers:** https://developers.cloudflare.com/workers/
