# Voice Session Flow - End-to-End Test Plan

**Generated**: 2025-10-09
**Status**: Ready for Testing
**Goal**: Test complete Voice Session Flow at https://mirai-stage-web.founder-968.workers.dev/stage?character=hiyori_pro_zh

---

## Implementation Status Summary

### ✅ Backend Infrastructure (COMPLETE)

#### 1. API Gateway Worker (`apps/workers/api-gateway`)
- **Voice Routes** (`src/routes/voice.ts`):
  - ✅ `POST /api/voice/session/start` - Creates session, stores in D1 + KV (line 52)
  - ✅ `GET /api/voice/ws` - WebSocket proxy with authentication headers (line 146-219)
  - ✅ `POST /api/voice/session/:id/end` - Updates session metrics (line 221)
- **Session Service** (`src/services/voice.ts`):
  - ✅ Session lifecycle management with VoiceSessionService class
  - ✅ 5-minute session TTL in KV cache
  - ✅ Conversation tracking in D1

#### 2. Voice Agent Container (`apps/workers/container/voice-agent-template`)
- **Worker Entry** (`src/worker.ts`):
  - ✅ Request validation (X-User-ID, X-Inworld-API-Key headers)
  - ✅ Service binding proxy to Durable Object
- **Multi-tenant Server** (`voice_agent/server/index.multi-tenant.ts`):
  - ✅ Character pool manager (100+ sessions per container)
  - ✅ WebSocket session handler with `/session` endpoint
  - ✅ `POST /load` endpoint for character initialization
  - ✅ Message routing to Inworld Platform

#### 3. Database Schema (`packages/database-schema`)
- ✅ Characters table with Inworld integration
- ✅ Conversations table
- ✅ Voice sessions table
- ✅ Migration file: `drizzle/migrations/0000_classy_sasquatch.sql`

### ✅ Frontend Implementation (COMPLETE)

#### 1. Voice Services
- **VoiceSessionManager** (`src/services/voice/VoiceSessionManager.ts`):
  - ✅ `startSession()` - POST to API Gateway
  - ✅ `endSession()` - POST with metrics
  - ✅ WebSocket URL construction
- **VoiceStreamClient** (`src/services/voice/VoiceStreamClient.ts`):
  - ✅ WebSocket connection management
  - ✅ Microphone capture (PCM 16kHz)
  - ✅ TTS audio playback
  - ✅ Transcript/emotion event handling
  - ✅ Session metrics tracking

#### 2. Components
- **VoiceChat.vue** (`src/components/VoiceChat.vue`):
  - ✅ Complete UI with session lifecycle
  - ✅ Live2D renderer integration
  - ✅ Chat history display
  - ✅ Audio visualization
  - ✅ Mute/unmute controls
  - ✅ Error handling with useErrorHandler composable

#### 3. Character API
- ✅ Mock MVP character (Hiyori) with hardcoded data
- ✅ Character fetching functions

### ⚠️ Integration Gap

**Current Issue**: The `/stage` page uses the old `InteractiveArea.vue` component which doesn't integrate with the voice session system.

**Solution**: The `/chat` page already demonstrates the correct integration pattern using the `VoiceChat` component.

**Comparison**:
- ✅ `/chat` page: Uses `VoiceChat` component → **Working integration**
- ❌ `/stage` page: Uses `InteractiveArea.vue` → **Missing voice integration**

---

## Pre-Deployment Checklist

### 1. Database Setup

```bash
# Navigate to database schema package
cd packages/database-schema

# Apply migrations to D1 (production)
wrangler d1 execute mirai-production --file=./drizzle/migrations/0000_classy_sasquatch.sql

# Verify tables created
wrangler d1 execute mirai-production --command="SELECT name FROM sqlite_master WHERE type='table';"
```

**Expected Tables**:
- `user`
- `session`
- `account`
- `verification`
- `characters`
- `conversations`
- `voice_sessions`
- `subscriptions`
- `products`
- `prices`

### 2. Environment Secrets Configuration

#### API Gateway Secrets
```bash
cd apps/workers/api-gateway

# Better-Auth
wrangler secret put BETTER_AUTH_SECRET
# Generate: openssl rand -base64 32

# Inworld Platform
wrangler secret put INWORLD_API_KEY
wrangler secret put INWORLD_WORKSPACE_ID

# OAuth Providers (if enabled)
wrangler secret put GOOGLE_CLIENT_ID
wrangler secret put GOOGLE_CLIENT_SECRET
wrangler secret put DISCORD_CLIENT_ID
wrangler secret put DISCORD_CLIENT_SECRET

# Polar Payment (if enabled)
wrangler secret put POLAR_ACCESS_TOKEN
wrangler secret put POLAR_WEBHOOK_SECRET
```

#### Verify wrangler.toml Bindings
```toml
[[d1_databases]]
binding = "DB"
database_name = "mirai-production"
database_id = "YOUR_D1_DATABASE_ID"

[[kv_namespaces]]
binding = "SESSION_CACHE"
id = "YOUR_KV_NAMESPACE_ID"

[[r2_buckets]]
binding = "PUBLIC_ASSETS"
bucket_name = "mirai-public-assets"

[[r2_buckets]]
binding = "USER_ASSETS"
bucket_name = "mirai-user-assets"
```

### 3. Inworld Platform Setup

1. **Create Inworld Workspace**:
   - Sign up at https://studio.inworld.ai
   - Create new workspace
   - Copy Workspace ID → `INWORLD_WORKSPACE_ID`
   - Generate API Key → `INWORLD_API_KEY`

2. **Create Hiyori Character**:
   - Navigate to Character Studio
   - Create new character with ID: `hiyori_pro_zh`
   - Configure personality, voice, and knowledge base
   - Note the character's full resource name (e.g., `workspaces/xxx/characters/yyy`)

3. **Update Database**:
   ```sql
   INSERT INTO characters (
     id, user_id, inworld_character_id, display_name,
     personality_config, is_public, created_at, updated_at
   ) VALUES (
     'hiyori_pro_zh',
     'YOUR_USER_ID', -- From Better-Auth session
     'workspaces/xxx/characters/yyy', -- From Inworld Studio
     'Hiyori',
     '{"dialogueStyle":"Friendly and supportive","adjectives":["Cheerful","Caring","Energetic"],"tone":"warm"}',
     1,
     CURRENT_TIMESTAMP,
     CURRENT_TIMESTAMP
   );
   ```

### 4. Deploy Workers

```bash
# Deploy API Gateway
cd apps/workers/api-gateway
pnpm install
pnpm run build
wrangler deploy

# Deploy Voice Agent Container
cd apps/workers/container/voice-agent-template
pnpm install
wrangler deploy

# Note: Container deployment may take 2-5 minutes for Docker image build
```

### 5. Deploy Frontend

```bash
cd apps/stage-web
pnpm install
pnpm run build
wrangler pages deploy dist
```

---

## Frontend Integration Fix

### Option A: Update `/stage` Page (Recommended)

**File**: `apps/stage-web/src/pages/stage/index.vue`

Replace the current implementation with the VoiceChat component:

```vue
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import VoiceChat from '@/components/VoiceChat.vue'
import { getMVPCharacter } from '@/services/api/characters'
import type { Character } from '@/services/api/characters'

const route = useRoute()
const character = ref<Character | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)

onMounted(async () => {
  try {
    // Get character ID from query param
    const characterId = route.query.character as string

    if (!characterId) {
      error.value = 'No character specified'
      loading.value = false
      return
    }

    // For MVP: Use hardcoded Hiyori character
    if (characterId === 'hiyori_pro_zh') {
      character.value = getMVPCharacter()
    } else {
      error.value = 'Character not found'
    }

    loading.value = false
  } catch (err) {
    console.error('Failed to load character:', err)
    error.value = 'Failed to load character'
    loading.value = false
  }
})
</script>

<template>
  <div class="stage-page">
    <div v-if="loading" class="loading">
      Loading character...
    </div>

    <div v-else-if="error" class="error">
      {{ error }}
    </div>

    <VoiceChat
      v-else-if="character"
      :character="character"
      @close="() => $router.push('/dashboard')"
    />
  </div>
</template>

<style scoped>
.stage-page {
  min-height: 100vh;
  overflow: hidden;
}

.loading,
.error {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  font-size: 1.25rem;
  color: #6b7280;
}

.error {
  color: #ef4444;
}
</style>
```

### Option B: Keep Existing Stage UI (Alternative)

If you want to keep the existing stage UI with Live2D in the background, integrate VoiceChat as an overlay:

```vue
<template>
  <div>
    <WidgetStage :paused="voiceChatActive" />

    <!-- Existing interactive areas (hidden when voice chat active) -->
    <InteractiveArea v-if="!isMobile && !voiceChatActive" />
    <MobileInteractiveArea v-if="isMobile && !voiceChatActive" />

    <!-- Voice Chat Overlay -->
    <VoiceChat
      v-if="voiceChatActive && selectedCharacter"
      :character="selectedCharacter"
      @close="voiceChatActive = false"
      class="voice-chat-overlay"
    />

    <!-- Start Voice Chat Button -->
    <button
      v-if="!voiceChatActive"
      @click="startVoiceChat"
      class="start-voice-btn"
    >
      Start Voice Chat
    </button>
  </div>
</template>
```

---

## End-to-End Testing Sequence

### Phase 1: Authentication Flow

1. **Test Sign-In**
   ```
   URL: https://mirai-stage-web.founder-968.workers.dev/auth/sign-in
   ```
   - Enter credentials
   - Verify redirect to `/dashboard`
   - Check session cookie in DevTools
   - Verify `GET /api/auth/session` returns user data

2. **Expected Response**:
   ```json
   {
     "user": {
       "id": "uuid",
       "email": "user@example.com",
       "name": "User Name"
     },
     "session": {
       "token": "jwt_token",
       "expiresAt": 1234567890
     }
   }
   ```

### Phase 2: Stage Navigation

1. **Navigate to Stage**
   ```
   URL: https://mirai-stage-web.founder-968.workers.dev/stage?character=hiyori_pro_zh
   ```
   - Character should load (Hiyori)
   - UI should render (after Option A fix)
   - "Start Conversation" button should appear

### Phase 3: Voice Session Start

1. **Click "Start Conversation"**

2. **Monitor Network Tab** (DevTools):
   - Request: `POST /api/voice/session/start`
   - Request Body:
     ```json
     {
       "characterId": "hiyori_pro_zh"
     }
     ```
   - Expected Response:
     ```json
     {
       "sessionKey": "uuid-session-key",
       "conversationId": "uuid-conversation-id",
       "websocketUrl": "wss://mirai-stage-web.founder-968.workers.dev/api/voice/ws?sessionKey=xxx",
       "character": {
         "id": "hiyori_pro_zh",
         "displayName": "Hiyori",
         "inworldCharacterId": "workspaces/xxx/characters/yyy"
       }
     }
     ```

3. **Check D1 Database**:
   ```bash
   wrangler d1 execute mirai-production --command="SELECT * FROM voice_sessions ORDER BY started_at DESC LIMIT 1;"
   ```
   - Verify session record created
   - Check `status = 'active'`

4. **Check KV Cache**:
   ```bash
   wrangler kv:key get --binding=SESSION_CACHE "session:YOUR_SESSION_KEY"
   ```
   - Verify session data stored with 5-minute TTL

### Phase 4: WebSocket Connection

1. **After Session Start**, WebSocket should auto-connect

2. **Monitor WebSocket in DevTools**:
   - URL: `wss://mirai-stage-web.founder-968.workers.dev/api/voice/ws?sessionKey=xxx`
   - Status: `101 Switching Protocols`
   - Connection: `Upgrade: websocket`

3. **API Gateway Log** (CloudFlare Dashboard):
   ```
   [VoiceRoutes] Session validation: { userId: xxx, characterId: xxx }
   [VoiceRoutes] Proxying to container: ws://container/session
   ```

4. **Voice Agent Container Log**:
   ```
   [CharacterPool] Session registered: { characterId: hiyori_pro_zh, sessionKey: xxx }
   [WebSocket] Connection established
   ```

### Phase 5: Character Loading

1. **After WebSocket connects**, frontend sends load request:
   - Request: `POST /load?key=sessionKey`
   - Request Body:
     ```json
     {
       "agent": "hiyori_pro_zh",
       "userName": "User Name"
     }
     ```

2. **Container creates/reuses Inworld app instance**:
   ```
   [CharacterPool] Character instance: hiyori_pro_zh (sessions: 1)
   [InworldApp] Initializing connection to Inworld Platform
   [InworldApp] Connected: workspaces/xxx/characters/yyy
   ```

3. **Expected Response**:
   ```json
   {
     "status": "loaded",
     "characterId": "hiyori_pro_zh"
   }
   ```

### Phase 6: Audio Streaming

1. **Microphone Permission**:
   - Browser prompts for microphone access
   - User grants permission
   - VoiceStreamClient starts capturing audio

2. **Audio Capture Flow**:
   ```
   Browser Microphone
     → MediaStream (getUserMedia)
     → AudioContext (16kHz)
     → ScriptProcessorNode (4096 samples)
     → Float32Array → Int16Array
     → WebSocket.send(binary)
   ```

3. **Monitor Outgoing WebSocket Messages**:
   - Message Type: Binary (ArrayBuffer)
   - Size: ~8KB per chunk (4096 samples * 2 bytes)
   - Frequency: ~256ms per chunk (4096 / 16000)

4. **Container Forwards to Inworld**:
   ```
   [Container] Received audio chunk: 8192 bytes
   [Inworld] STT processing...
   [Inworld] LLM generation...
   [Inworld] TTS synthesis...
   ```

5. **Incoming WebSocket Messages**:

   **Transcript Message** (JSON):
   ```json
   {
     "type": "transcript",
     "text": "Hello! How are you?",
     "speaker": "USER",
     "timestamp": 1234567890
   }
   ```

   **Character Response Transcript** (JSON):
   ```json
   {
     "type": "transcript",
     "text": "Hi! I'm doing great, thanks for asking!",
     "speaker": "CHARACTER",
     "timestamp": 1234567891
   }
   ```

   **Emotion Event** (JSON):
   ```json
   {
     "type": "emotion",
     "emotion": "JOY",
     "intensity": 0.8,
     "timestamp": 1234567891
   }
   ```

   **TTS Audio** (Binary):
   - Format: PCM 24kHz (or MP3/Opus depending on Inworld config)
   - Size: Variable (depends on response length)

6. **Audio Playback Flow**:
   ```
   WebSocket Binary Message
     → ArrayBuffer
     → AudioContext.decodeAudioData()
     → AudioBuffer
     → AudioBufferSourceNode
     → AudioContext.destination (speakers)
   ```

7. **UI Updates**:
   - Chat history shows transcripts
   - Live2D character reflects emotion
   - Audio visualizer animates
   - "Listening" indicator active

### Phase 7: Session End

1. **Click "End Conversation"**

2. **Frontend cleanup**:
   - Stop microphone capture
   - Close WebSocket connection
   - Calculate metrics:
     ```json
     {
       "durationSeconds": 120,
       "audioSeconds": 45
     }
     ```

3. **API Request**:
   - Request: `POST /api/voice/session/:sessionKey/end`
   - Request Body: metrics

4. **Backend updates**:
   ```sql
   UPDATE voice_sessions
   SET
     status = 'ended',
     total_audio_seconds = 45,
     ended_at = CURRENT_TIMESTAMP
   WHERE id = 'session-key';
   ```

5. **Container cleanup**:
   ```
   [CharacterPool] Session removed: sessionKey
   [CharacterPool] Character instance: hiyori_pro_zh (sessions: 0)
   [CharacterPool] Idle timer started (5 minutes)
   ```

---

## Common Issues & Troubleshooting

### Issue 1: WebSocket Connection Fails

**Symptoms**:
- Error: `Failed to connect to voice service`
- WebSocket status: `Error` or `Closed`

**Debugging**:
```bash
# Check API Gateway logs
wrangler tail --name=api-gateway --format=pretty

# Check session key in KV
wrangler kv:key get --binding=SESSION_CACHE "session:YOUR_SESSION_KEY"
```

**Common Causes**:
- Session key expired (5-minute TTL)
- KV cache not configured
- Service binding missing in wrangler.toml
- Container not deployed

### Issue 2: No Audio from Character

**Symptoms**:
- Transcripts appear but no TTS audio plays
- WebSocket receives binary messages but no sound

**Debugging**:
```javascript
// In browser console
console.log('AudioContext state:', audioContext.state)
// If "suspended", user interaction required:
audioContext.resume()
```

**Common Causes**:
- Browser autoplay policy (requires user interaction)
- AudioContext not initialized
- Incorrect audio format from Inworld
- Speakers/audio output disabled

### Issue 3: Microphone Not Capturing

**Symptoms**:
- Microphone permission granted but no audio sent
- User speaks but no transcripts appear

**Debugging**:
```javascript
// In browser console (VoiceStreamClient)
navigator.mediaDevices.getUserMedia({ audio: true })
  .then(stream => {
    console.log('Tracks:', stream.getAudioTracks())
    console.log('Settings:', stream.getAudioTracks()[0].getSettings())
  })
```

**Common Causes**:
- Microphone permission denied
- Wrong input device selected
- Sample rate mismatch (should be 16kHz)
- Microphone muted in OS settings

### Issue 4: Session Creation Fails

**Symptoms**:
- `POST /api/voice/session/start` returns 401 or 403
- Error: `Not authenticated` or `Character not found`

**Debugging**:
```bash
# Check authentication
curl https://mirai-stage-web.founder-968.workers.dev/api/auth/session \
  -H "Cookie: better-auth.session_token=YOUR_TOKEN"

# Check character exists
wrangler d1 execute mirai-production --command="SELECT * FROM characters WHERE id='hiyori_pro_zh';"
```

**Common Causes**:
- User not authenticated (session expired)
- Character not in database
- Character not owned by user (if `is_public = false`)
- Better-Auth configuration error

### Issue 5: Container Initialization Timeout

**Symptoms**:
- WebSocket connects but times out before character loads
- Error: `Container failed to start`

**Debugging**:
```bash
# Check container logs
wrangler tail --name=voice-agent-template --format=pretty

# Check Durable Object status
wrangler durable-objects:list --name=VOICE_AGENT
```

**Common Causes**:
- Cold start delay (~20 seconds for Docker container)
- Inworld API key invalid
- Network timeout to Inworld Platform
- Container out of memory (check Docker limits)

---

## Performance Metrics

### Expected Latencies

| Metric | Expected | Acceptable | Poor |
|--------|----------|------------|------|
| Session Start | < 500ms | < 1s | > 2s |
| WebSocket Connect | < 200ms | < 500ms | > 1s |
| Character Load (cold) | 15-20s | < 30s | > 45s |
| Character Load (warm) | 50-100ms | < 200ms | > 500ms |
| STT Latency | 100-300ms | < 500ms | > 1s |
| LLM Response | 500ms-2s | < 3s | > 5s |
| TTS Synthesis | 200-500ms | < 1s | > 2s |
| End-to-End (speech → audio) | 1-3s | < 4s | > 6s |

### Resource Usage

| Resource | Expected Usage | Limit |
|----------|----------------|-------|
| API Gateway CPU | < 10ms per request | 50ms soft |
| API Gateway Memory | < 50MB | 128MB |
| Container CPU | 0.5-1 vCPU per session | 2 vCPU |
| Container Memory | 200MB + (5MB × sessions) | 1GB |
| D1 Database | < 100 queries/min | 100K/day (free) |
| KV Cache | < 50 reads/min | 100K/day (free) |
| R2 Storage | < 10MB Live2D models | 10GB (free) |
| WebSocket Data | ~8KB/256ms (upload) | ~5KB/s avg |
| | Variable (download, TTS) | ~10-50KB/s |

---

## Success Criteria

### Minimum Viable Test ✅

- [ ] User can sign in and navigate to `/stage?character=hiyori_pro_zh`
- [ ] Character loads without errors
- [ ] "Start Conversation" button appears
- [ ] Clicking button creates session (network shows 200 response)
- [ ] WebSocket connects (status shows "Connected")
- [ ] Microphone permission prompt appears
- [ ] User can speak and sees transcript appear
- [ ] Character responds with audio and transcript
- [ ] Live2D character shows emotion
- [ ] User can end conversation
- [ ] Session metrics saved to database

### Full Production Ready ✅✅

- [ ] All minimum criteria pass
- [ ] End-to-end latency < 4 seconds
- [ ] Character loads in < 20 seconds (cold start)
- [ ] Audio playback is clear without glitches
- [ ] Multiple concurrent sessions work (test 3+ users)
- [ ] Session properly recovers from network interruption
- [ ] Error messages are user-friendly
- [ ] Authentication persists across page reloads
- [ ] Memory usage remains stable during 10-minute session
- [ ] Container scales down after idle period (5 minutes)

---

## Next Steps After Testing

### If Tests Pass ✅

1. **Create Production Character**:
   - Design full personality in Inworld Studio
   - Configure voice, emotions, knowledge base
   - Add Live2D model to R2 bucket
   - Update character record in D1

2. **Add More Characters**:
   - Implement character creation UI
   - Add character gallery/marketplace
   - Enable user-uploaded models

3. **Optimize Performance**:
   - Implement container warm pool
   - Add CDN caching for static assets
   - Optimize Live2D model size
   - Enable audio compression

4. **Add Features**:
   - Voice session history
   - Shared conversations
   - Multi-language support
   - Custom voice training

### If Tests Fail ❌

1. **Debugging Priority**:
   - Check Cloudflare dashboard logs
   - Verify all secrets are set
   - Test each endpoint independently
   - Use `wrangler tail` for real-time logs

2. **Isolate Issues**:
   - Test authentication separately
   - Test WebSocket proxy separately
   - Test container independently (local Docker)
   - Test Inworld API separately (Postman)

3. **Common Fixes**:
   - Redeploy with `wrangler deploy --force`
   - Clear KV cache: `wrangler kv:key delete --binding=SESSION_CACHE "session:*"`
   - Reset D1: re-apply migrations
   - Check CORS headers in responses

---

## Useful Commands

### Database Queries
```bash
# List all sessions
wrangler d1 execute mirai-production --command="SELECT * FROM voice_sessions ORDER BY started_at DESC LIMIT 10;"

# Count active sessions
wrangler d1 execute mirai-production --command="SELECT COUNT(*) FROM voice_sessions WHERE status='active';"

# Get user's conversations
wrangler d1 execute mirai-production --command="SELECT * FROM conversations WHERE user_id='YOUR_USER_ID' ORDER BY started_at DESC;"
```

### Cache Management
```bash
# List session keys
wrangler kv:key list --binding=SESSION_CACHE --prefix="session:"

# Get session data
wrangler kv:key get --binding=SESSION_CACHE "session:YOUR_KEY"

# Delete expired sessions
wrangler kv:key delete --binding=SESSION_CACHE "session:YOUR_KEY"
```

### Deployment
```bash
# Deploy API Gateway
cd apps/workers/api-gateway && wrangler deploy

# Deploy Container
cd apps/workers/container/voice-agent-template && wrangler deploy

# Deploy Frontend
cd apps/stage-web && pnpm build && wrangler pages deploy dist

# Check deployment status
wrangler deployments list
```

### Logs
```bash
# Real-time API Gateway logs
wrangler tail --name=api-gateway --format=pretty

# Real-time Container logs
wrangler tail --name=voice-agent-template --format=pretty

# Filter for errors only
wrangler tail --name=api-gateway --format=pretty | grep ERROR
```

---

## Contact & Resources

- **Cloudflare Dashboard**: https://dash.cloudflare.com
- **Inworld Studio**: https://studio.inworld.ai
- **Wrangler Docs**: https://developers.cloudflare.com/workers/wrangler/
- **Better-Auth Docs**: https://better-auth.com
- **WebSocket MDN**: https://developer.mozilla.org/en-US/docs/Web/API/WebSocket

---

**Test Date**: ________________
**Tested By**: ________________
**Result**: ☐ Pass  ☐ Fail  ☐ Partial
**Notes**: _______________________________________________________________
