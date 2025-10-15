# Preset Characters Deployment Guide

**Date:** 2025-10-15
**Status:** Ready for Deployment

## Overview

This guide walks you through deploying preset characters (starting with Hiyori) to your Mirai MVP application.

## Prerequisites

- ✅ Wrangler CLI installed (`pnpm add -g wrangler`)
- ✅ Cloudflare account configured
- ✅ Database migrations applied
- ✅ API Gateway worker deployed
- ✅ Authentication working

## Step 1: Deploy the API Gateway Worker

Make sure your latest changes are deployed:

```bash
cd apps/workers/api-gateway
pnpm run deploy
```

This deploys the updated endpoints:
- `/api/characters/:id` - Now supports preset characters
- `/api/characters/presets` - Lists preset characters (no auth required)
- `/api/assets/public/*` - Serves public assets (no auth required)
- `/admin/seed-presets-runtime` - Seeds preset characters to database

## Step 2: Set Admin Secret

Set an admin secret for seeding operations:

```bash
cd apps/workers/api-gateway
wrangler secret put ADMIN_SECRET
# Enter a secure random string (e.g., use: openssl rand -hex 32)
```

Save this secret somewhere secure - you'll need it for Step 4.

## Step 3: Upload Hiyori Avatar Thumbnail

You need to upload a thumbnail image for the Hiyori character to R2.

### Option A: Using Wrangler CLI

```bash
# Create a placeholder image if you don't have one
# (Or use your actual Hiyori thumbnail image)

# Upload to R2 using wrangler
wrangler r2 object put mirai-user-assets/presets/hiyori/avatar-thumbnail.png \
  --file path/to/hiyori-thumbnail.png \
  --content-type image/png
```

### Option B: Using API Endpoint (Temporary Upload Script)

Create a temporary upload script:

```typescript
// upload-preset-asset.ts
const ADMIN_SECRET = 'your-admin-secret-here'
const API_URL = 'https://mirai-api-gateway.founder-968.workers.dev'

async function uploadAsset() {
  const response = await fetch('https://placeholder.com/150x150', {
    // Or use a real image URL/file
  })

  const blob = await response.blob()
  const formData = new FormData()
  formData.append('file', blob, 'avatar-thumbnail.png')

  const uploadResponse = await fetch(`${API_URL}/admin/upload-preset-asset`, {
    method: 'POST',
    headers: {
      'X-Admin-Secret': ADMIN_SECRET,
    },
    body: formData,
  })

  console.log(await uploadResponse.json())
}

uploadAsset()
```

### Option C: Manual Upload via Cloudflare Dashboard

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Navigate to **R2** > **mirai-user-assets**
3. Create folder: `presets/hiyori/`
4. Upload your image as `avatar-thumbnail.png`
5. Path should be: `presets/hiyori/avatar-thumbnail.png`

## Step 4: Seed Preset Characters to Database

Run the seed endpoint to insert Hiyori into the database:

```bash
curl -X POST https://mirai-api-gateway.founder-968.workers.dev/admin/seed-presets-runtime \
  -H "X-Admin-Secret: YOUR_ADMIN_SECRET" \
  -H "Content-Type: application/json"
```

**Expected response:**
```json
{
  "success": true,
  "message": "Preset characters seeded successfully (Runtime mode)"
}
```

## Step 5: Verify Preset Character

Check that the preset character was seeded correctly:

```bash
curl https://mirai-api-gateway.founder-968.workers.dev/api/characters/presets
```

**Expected response:**
```json
{
  "characters": [
    {
      "id": "preset-hiyori-001",
      "userId": null,
      "inworldCharacterId": "runtime-character-hiyori",
      "displayName": "Hiyori",
      "description": "A cheerful and energetic AI companion who loves to chat and help out!",
      "live2dModelKey": "presets/hiyori/hiyori.model3.json",
      "avatarThumbnail": "/api/assets/public/presets/hiyori/avatar-thumbnail.png",
      "personalityConfig": {
        "motivations": [...],
        "flaws": [...],
        "dialogueStyle": "Cheerful, friendly, and upbeat with a touch of playfulness",
        "adjectives": ["Cheerful", "Energetic", "Helpful", "Curious", "Optimistic"],
        "voiceConfig": {
          "pitch": 1.1,
          "speed": 1.0,
          "emotionRange": "high"
        }
      },
      "isPreset": true,
      "isPublic": false,
      "totalConversations": 0,
      "createdAt": "2025-10-15T...",
      "updatedAt": "2025-10-15T..."
    }
  ]
}
```

## Step 6: Test Avatar Thumbnail Access

Verify the avatar thumbnail is publicly accessible:

```bash
curl -I https://mirai-api-gateway.founder-968.workers.dev/api/assets/public/presets/hiyori/avatar-thumbnail.png
```

**Expected response:**
```
HTTP/2 200
content-type: image/png
cache-control: public, max-age=31536000
etag: "..."
access-control-allow-origin: *
```

## Step 7: Test in Dashboard

1. Navigate to your frontend: `https://mirai-stage-web.founder-968.workers.dev/dashboard`
2. You should see the Hiyori character card with her avatar
3. Click "Start Conversation with Hiyori"
4. You should be redirected to `/stage?character=preset-hiyori-001`

## Troubleshooting

### Issue: 404 Error for `/api/characters/preset-hiyori-001`

**Cause:** Character service wasn't allowing access to preset characters.

**Fix:** Already fixed in `apps/workers/api-gateway/src/services/characters.ts` - the `getCharacter()` method now supports preset characters.

### Issue: Avatar thumbnail returns 401 Unauthorized

**Cause:** Public assets route wasn't excluded from auth middleware.

**Fix:** Already fixed in `apps/workers/api-gateway/src/index.ts` - `/api/assets/public/*` is now excluded from auth.

### Issue: Avatar thumbnail returns 404 Not Found

**Cause:** Image not uploaded to R2 bucket, or uploaded to wrong path.

**Solution:**
1. Check R2 bucket contents:
   ```bash
   wrangler r2 object list mirai-user-assets --prefix presets/hiyori/
   ```
2. Verify the path is exactly: `presets/hiyori/avatar-thumbnail.png`
3. Re-upload if necessary (see Step 3)

### Issue: "Failed to fetch preset characters"

**Cause:** Worker not deployed with latest changes.

**Solution:**
```bash
cd apps/workers/api-gateway
pnpm run deploy
```

### Issue: Preset characters not showing on dashboard

**Cause:** Database not seeded yet.

**Solution:** Run the seed endpoint again (Step 4)

## Architecture Summary

### URL Structure

- **API Gateway:** `https://mirai-api-gateway.founder-968.workers.dev`
- **Frontend:** `https://mirai-stage-web.founder-968.workers.dev`
- **Public Assets:** `/api/assets/public/presets/{character}/{file}`

### Database Schema

```sql
-- Preset characters have:
-- - userId = NULL (no owner)
-- - isPreset = true (marks as preset)
-- - isPublic = false (not for marketplace)
-- - live2dModelKey = path in R2 bucket
-- - avatarThumbnail = URL to public asset endpoint
```

### Authentication Flow

```
User → Dashboard (/dashboard)
  ↓
  GET /api/characters/presets (NO AUTH REQUIRED)
  ↓
  Returns: [{ id: "preset-hiyori-001", ... }]
  ↓
  User clicks "Start Conversation"
  ↓
  Navigate to /stage?character=preset-hiyori-001
  ↓
  GET /api/characters/preset-hiyori-001 (AUTH REQUIRED)
  ↓
  Returns: Character details (accessible because isPreset=true)
  ↓
  Render Live2D + Voice Chat
```

## Next Steps

### Adding More Preset Characters

1. Add character definition to `packages/database-schema/src/seed-presets-runtime.ts`:
   ```typescript
   {
     id: 'preset-luna-002',
     displayName: 'Luna',
     description: '...',
     live2dModelKey: 'presets/luna/luna.model3.json',
     avatarThumbnail: '/api/assets/public/presets/luna/avatar-thumbnail.png',
     inworldCharacterId: 'runtime-character-luna',
     personalityConfig: { ... }
   }
   ```

2. Upload assets to R2:
   ```bash
   wrangler r2 object put mirai-user-assets/presets/luna/avatar-thumbnail.png --file luna-thumbnail.png
   wrangler r2 object put mirai-user-assets/presets/luna/luna.model3.json --file luna.model3.json
   ```

3. Re-run seed endpoint (it will skip existing characters)

4. Deploy:
   ```bash
   cd packages/database-schema
   pnpm run build

   cd ../../apps/workers/api-gateway
   pnpm run deploy
   ```

### User-Created Characters (Future)

Users can create their own characters via:
```
POST /api/characters
{
  "displayName": "My Character",
  "personalityConfig": { ... },
  "live2dModelKey": "...",  // Optional
  "avatarThumbnail": "..."  // Optional
}
```

These characters will have:
- `userId = <user-id>` (owned by user)
- `isPreset = false`
- Access restricted to owner only

## Deployment Checklist

- [ ] API Gateway deployed with latest changes
- [ ] Admin secret set in Cloudflare
- [ ] Hiyori thumbnail uploaded to R2
- [ ] Preset characters seeded to database
- [ ] Avatar thumbnail accessible publicly
- [ ] Frontend can fetch preset characters
- [ ] "Start Conversation" button works
- [ ] Voice chat loads successfully

## Monitoring

### Check Logs

```bash
# API Gateway logs
wrangler tail mirai-api-gateway

# Frontend logs
wrangler tail mirai-stage-web
```

### Check R2 Usage

```bash
wrangler r2 object list mirai-user-assets --prefix presets/
```

### Check Database

```bash
wrangler d1 execute mirai-production --command "SELECT * FROM characters WHERE isPreset = 1"
```

---

**Maintained by:** Phantom Systems Inc
**Last Updated:** 2025-10-15
