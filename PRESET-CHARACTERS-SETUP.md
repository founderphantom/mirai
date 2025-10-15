# Preset Characters Setup Guide

**Last Updated:** 2025-10-14
**Status:** Debugging Inworld API Integration

---

## Issue Summary

The preset character seeding is failing with this error:
```
{"error":"Failed to seed presets","message":"Failed to create Inworld character: Not Found"}
```

This means the Inworld API is returning a 404 (Not Found) error, which could be due to:
1. Incorrect API endpoint URL
2. Invalid or incorrect `INWORLD_WORKSPACE_ID`
3. Invalid or expired `INWORLD_API_KEY`
4. Incorrect API version or authentication method

---

## What We've Fixed

✅ **Improved Error Logging**
- Added detailed logging to see the full Inworld API response
- Logs now show the exact URL, request body, and error details

✅ **Added Two Seeding Approaches**
- **Approach A (API)**: Create characters via Inworld Studio REST API (original)
- **Approach B (Simple)**: Reference pre-created characters (workaround)

✅ **Created Test Script**
- Test Inworld API connectivity independently
- Try multiple endpoint formats to find the correct one

---

## Step 1: Test Inworld API Connectivity

First, let's verify your Inworld credentials are correct. Unfortunately, the test script needs to be deployed separately. For now, let's proceed with testing the seed endpoint directly.

---

## Step 2A: Try the Original API Seed (With Better Logging)

Try running the original seed command again to see detailed error info:

```bash
curl -X POST https://mirai-api-gateway.founder-968.workers.dev/admin/seed-presets \
  -H "X-Admin-Secret: 26fe7f6be3758b9f7e58dd269bcceeee2542b43ecb2a92f5bf1bdebab211d415" \
  -H "Content-Type: application/json"
```

Now check the logs for detailed error information:

```bash
cd apps/workers/api-gateway
wrangler tail
```

Look for logs with `[SEED]` prefix. They will show:
- The full Inworld API URL being used
- The request body sent to Inworld
- The exact error response from Inworld

**Common Issues to Check:**

1. **Wrong API Endpoint Domain**
   - We're using: `https://studio.inworld.ai`
   - Try: `https://studio.inworld.app` or `https://api.inworld.ai`

2. **Workspace ID Format**
   - Should be just the ID: `abc-123-def-456`
   - NOT the full path: `workspaces/abc-123-def-456`

3. **API Key**
   - Check if it's expired or invalid
   - Verify you're using the correct workspace's API key

---

## Step 2B: Use Simple Seed (Workaround - Recommended for MVP)

This approach skips the Inworld API call and just references pre-created characters.

### Prerequisites

1. **Create Character in Inworld Studio UI:**
   - Go to https://studio.inworld.ai
   - Create a character named "Hiyori" with the following personality:
     - Motivations: "Help users feel comfortable and happy"
     - Flaws: "Sometimes too enthusiastic"
     - Dialogue Style: "Cheerful, friendly, and upbeat"
     - Adjectives: "Cheerful, Energetic, Helpful, Curious, Optimistic"
   - Copy the character's resource name (format: workspaces/{workspace-id}/characters/{character-id})

2. **Update the Seed Script:**

Edit packages/database-schema/src/seed-presets-simple.ts:

Find line 28 and replace with your actual character ID:
```typescript
inworldCharacterId: 'workspaces/your-workspace-id/characters/your-character-id',
```

3. **Rebuild and Deploy:**

```bash
# Rebuild database schema
pnpm --filter @proj-airi/database-schema build

# Deploy API gateway
cd apps/workers/api-gateway
wrangler deploy
```

4. **Run Simple Seed:**

```bash
curl -X POST https://mirai-api-gateway.founder-968.workers.dev/admin/seed-presets-simple \
  -H "X-Admin-Secret: 26fe7f6be3758b9f7e58dd269bcceeee2542b43ecb2a92f5bf1bdebab211d415" \
  -H "Content-Type: application/json"
```

Expected response:
```json
{
  "success": true,
  "message": "Preset characters seeded successfully (simple mode)"
}
```

---

## Step 3: Verify Preset Characters

Check if the characters were seeded successfully:

```bash
curl -X GET https://mirai-api-gateway.founder-968.workers.dev/admin/seed-presets \
  -H "X-Admin-Secret: 26fe7f6be3758b9f7e58dd269bcceeee2542b43ecb2a92f5bf1bdebab211d415"
```

Expected response:
```json
{
  "presetCount": 1,
  "presets": [
    {
      "id": "preset-hiyori-001",
      "displayName": "Hiyori",
      "description": "A cheerful and energetic AI companion...",
      "inworldCharacterId": "workspaces/.../characters/...",
      "createdAt": "2025-10-14T..."
    }
  ]
}
```

---

## Recommended Approach for MVP

**Use the Simple Seed (Step 2B) for MVP**

Why?
- ✅ Faster to implement
- ✅ More reliable (no API calls)
- ✅ Easier to debug
- ✅ Same end result

You can always switch to the API approach later when you need to dynamically create characters.

---

**Author:** Claude Code
**Date:** 2025-10-14
