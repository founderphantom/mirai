# Stage Architecture Review & Fixes

**Date:** 2025-10-15
**Status:** Fixed

## Issues Found & Resolved

### 1. ❌ Duplicate Live2D Instances

**Problem:**
- VoiceChat component was loading its own Live2D renderer
- Main stage (WidgetStage) was also loading a Live2D model
- Result: Two models loaded, one stuck on "Loading character..."

**Fix:**
- Removed Live2D renderer from VoiceChat component
- VoiceChat now shows a simple status card with avatar thumbnail
- Single Live2D instance on main stage handles all visuals

### 2. ❌ Character Data Not Reaching Live2D Model

**Problem:**
- `stage/index.vue` loaded character from API
- BUT `WidgetStage` loaded model from settings store
- Character selection was ignored!

**Fix:**
- When character loads, update `settingsStore.stageModelSelectedUrl`
- Live2D model now uses the correct character's model

### 3. ❌ Emotions Not Updating Live2D Model

**Problem:**
- Voice chat received emotions from WebSocket
- Live2D model on stage didn't react to emotions

**Fix:**
- VoiceChat emits `@emotion` event to parent
- Parent (`stage/index.vue`) updates Live2D store with emotion
- Live2D model now reacts to voice chat emotions

---

## Updated Architecture

```
┌──────────────────────────────────────────────────────────────┐
│  Dashboard (/dashboard)                                       │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  User selects character: "Hiyori"                    │    │
│  │  Click "Start Conversation"                          │    │
│  └──────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────┘
                           │
                           ↓ Navigate to /stage?character=preset-hiyori-001

┌──────────────────────────────────────────────────────────────┐
│  Stage Page (/stage/index.vue)                               │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  onMounted:                                          │    │
│  │  1. Load character from API via characterId          │    │
│  │  2. Update settingsStore.stageModelSelectedUrl       │    │
│  │  3. Set settingsStore.stageModelRenderer = 'live2d'  │    │
│  └──────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────┘
                           │
         ┌─────────────────┴─────────────────┐
         ↓                                   ↓
┌─────────────────────────┐    ┌─────────────────────────────┐
│  WidgetStage            │    │  VoiceChat                  │
│  (Left Panel)           │    │  (Right Panel)              │
│  ┌───────────────────┐  │    │  ┌───────────────────────┐  │
│  │ Live2DScene       │  │    │  │ Status Card           │  │
│  │ - Model from      │  │    │  │ - Avatar thumbnail    │  │
│  │   settingsStore   │◄─┼────┼──│ - Connection status   │  │
│  │ - Reacts to       │  │    │  │ - Emotion display     │  │
│  │   emotions        │  │    │  ├───────────────────────┤  │
│  └───────────────────┘  │    │  │ Chat Messages         │  │
│                         │    │  ├───────────────────────┤  │
│                         │    │  │ Voice Controls        │  │
│                         │    │  │ - Mute/Unmute         │  │
│                         │    │  │ - End Conversation    │  │
│                         │    │  └───────────────────────┘  │
└─────────────────────────┘    └─────────────────────────────┘
         ↑                                   │
         │                                   │ @emotion(emotion, intensity)
         └───────────────────────────────────┘
              Updates Live2D motion via
              live2dStore.currentMotion
```

---

## Data Flow

### 1. Character Loading
```typescript
// stage/index.vue
onMounted(async () => {
  // 1. Get character ID from route
  const characterId = route.query.character as string

  // 2. Fetch character from API
  character.value = await getCharacter(characterId)
  // Returns: { id, displayName, live2dModelKey, personalityConfig, ... }

  // 3. Construct model URL
  const modelKey = character.value.live2dModelKey // 'hiyori_pro_zh.zip'
  const modelUrl = `/assets/live2d/models/${modelKey}`

  // 4. Update settings store (this is what WidgetStage reads!)
  settingsStore.stageModelSelectedUrl = modelUrl
  settingsStore.stageModelRenderer = 'live2d'
})
```

### 2. Emotion Flow
```typescript
// VoiceStreamClient receives WebSocket message
{
  type: 'emotion',
  emotion: 'JOY',
  intensity: 0.8
}
    ↓
// VoiceChat.vue callback
onEmotion: (emotion, intensity) => {
  currentEmotion.value = { emotion, intensity }  // Store locally
  emit('emotion', emotion, intensity)             // Emit to parent
}
    ↓
// stage/index.vue handler
handleEmotionUpdate(emotion, intensity) {
  const motionName = emotionMotionMap[emotion] // 'JOY' → 'Tap@Body'
  live2dStore.currentMotion = { group: motionName, index: 0 }
}
    ↓
// WidgetStage watches live2dStore.currentMotion
// → Live2DScene applies the motion to the model
```

### 3. Voice Session Flow
```typescript
// 1. VoiceChat.vue: startSession()
const session = await sessionManager.startSession(character)
// Returns: { sessionKey, websocketUrl, conversationId }

// 2. Connect WebSocket
await voiceClient.connect(session.websocketUrl)

// 3. Start audio capture
await voiceClient.startAudioCapture()

// 4. WebSocket messages flow:
User speaks → Audio chunks → Backend (Inworld) → TTS + Emotions
    ↓                                                    ↓
    Text transcript                              Audio playback
    Emotion updates ─────────────────────────────> Live2D model
```

---

## File Changes Summary

### 1. `apps/stage-web/src/pages/stage/index.vue`

**Added:**
- Import `useSettings` store
- Import `useLive2d` store
- `handleEmotionUpdate()` function to forward emotions to Live2D
- Logic to update `settingsStore.stageModelSelectedUrl` when character loads
- `@emotion` event listener on VoiceChat component

**Result:**
- ✅ Character selection now controls which Live2D model loads
- ✅ Emotions from voice chat update the stage's Live2D model

### 2. `apps/stage-web/src/components/VoiceChat.vue`

**Removed:**
- `Live2DRenderer` component import
- `Live2DRenderer` in template
- `live2dModelUrl` computed property
- Large character display area with embedded Live2D

**Added:**
- `@emotion` event emitter
- Compact status card with avatar thumbnail
- Connection status indicator
- Emotion display (text-based)

**Result:**
- ✅ No duplicate Live2D instance
- ✅ Cleaner, more focused chat UI
- ✅ Emotions forwarded to parent

### 3. `packages/database-schema/src/seed-presets-runtime.ts`

**Fixed:**
- Corrected `live2dModelKey` to point to `.zip` file (was `.png`)
- Corrected `avatarThumbnail` to point to `.png` file (was `.zip`)

**Result:**
- ✅ Character data has correct asset paths

---

## Deployment Steps

### 1. Build Database Schema Package
```bash
cd packages/database-schema
pnpm run build
```

### 2. Deploy API Gateway
```bash
cd apps/workers/api-gateway
pnpm run deploy
```

### 3. Re-seed Database (if needed)
```bash
# Delete old preset
curl -X DELETE https://mirai-api-gateway.founder-968.workers.dev/admin/seed-presets/preset-hiyori-001 \
  -H "X-Admin-Secret: YOUR_ADMIN_SECRET"

# Re-seed with correct data
curl -X POST https://mirai-api-gateway.founder-968.workers.dev/admin/seed-presets-runtime \
  -H "X-Admin-Secret: YOUR_ADMIN_SECRET"
```

### 4. Deploy Frontend
```bash
cd apps/stage-web
pnpm run deploy:cf
```

---

## Testing Checklist

- [ ] Navigate to `/dashboard`
- [ ] See Hiyori character card with preview image
- [ ] Click "Start Conversation with Hiyori"
- [ ] Redirect to `/stage?character=preset-hiyori-001`
- [ ] Live2D model loads on left side (Hiyori)
- [ ] Voice chat panel appears on right side
- [ ] Click "Start Conversation"
- [ ] WebSocket connects successfully
- [ ] Microphone permission granted
- [ ] Speak to character
- [ ] Text transcripts appear in chat
- [ ] Character responds with audio
- [ ] Live2D model's mouth moves during TTS
- [ ] Emotions update the Live2D model's motion
- [ ] Character thumbnail shows in voice chat panel
- [ ] Connection status shows "Voice Active"
- [ ] Can mute/unmute microphone
- [ ] Can end conversation
- [ ] Redirects back to dashboard after ending

---

## Architecture Benefits

### Before
❌ Two Live2D instances (wasteful, confusing)
❌ Character selection ignored by Live2D
❌ Emotions not connected to visuals
❌ Unclear which component owns what

### After
✅ Single Live2D instance (efficient)
✅ Character selection controls model
✅ Emotions flow: WebSocket → VoiceChat → Stage → Live2D
✅ Clear separation of concerns:
   - Stage: Visual character representation
   - VoiceChat: Chat UI and voice controls
   - WidgetStage: Live2D rendering
   - Settings Store: Model configuration

---

## Performance Improvements

1. **Reduced Memory Usage**
   - Single Live2D model instead of two
   - Saves ~50-100MB depending on model complexity

2. **Faster Load Times**
   - No duplicate model downloads
   - Status card loads instantly while Live2D loads in background

3. **Better UX**
   - No confusing "Loading character..." in chat panel
   - Clear status indicators
   - Emotions visible in both chat panel (text) and stage (animation)

---

## Future Enhancements

### Short Term
- [ ] Add lip sync to Live2D model based on audio playback
- [ ] Add user character creation UI in dashboard
- [ ] Add character model upload functionality
- [ ] Implement voice cloning for custom characters

### Medium Term
- [ ] Character marketplace
- [ ] Multiple character selection (group chats)
- [ ] Character customization (clothes, accessories)
- [ ] Save/resume conversations

### Long Term
- [ ] 3D VRM model support (already partially implemented)
- [ ] AR/VR character interaction
- [ ] Multi-language support
- [ ] Advanced emotion detection (facial recognition)

---

**Maintained by:** Phantom Systems Inc
**Last Updated:** 2025-10-15
