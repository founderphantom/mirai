# Voice Client Code Review & Fix Plan

**Date:** 2025-10-14
**Reviewed:** Frontend voice client implementation
**Status:** ❌ Issues Found - Requires Refactoring

---

## 🔍 Issues Identified

### Issue #1: Chat Message Attribution (All Messages Show as Character)

**Symptom:** User messages appear as character messages in the chat interface.

**Root Cause:** Frontend correctly displays based on `speaker` field, but the backend is not properly differentiating between USER and CHARACTER messages.

**Location:**
- Frontend: `apps/stage-web/src/components/VoiceChat.vue:310-312`
- Client: `apps/stage-web/src/services/voice/VoiceStreamClient.ts:76-80, 259-261`

**Current Code:**
```vue
<!-- VoiceChat.vue -->
<span class="speaker">
  {{ msg.speaker === 'USER' ? 'You' : character.displayName }}:
</span>
```

```typescript
// VoiceStreamClient.ts
case 'transcript':
  this.callbacks.onTranscript?.(message.text, message.speaker)
  break
```

**Problem:** The backend is sending `speaker: 'CHARACTER'` for all transcript messages, including user input.

---

### Issue #2: Voice Input Flow - Inefficient and Buggy

**Symptom:**
1. Empty messages sent to character (character replies to nothing)
2. Messages cut off mid-speech
3. Second half of message sent after character finishes replying

**Root Cause:** Continuous audio streaming vs interval-based chunking mismatch with Inworld Runtime.

#### Our Implementation (BROKEN):
```typescript
// VoiceStreamClient.ts:140-169
this.scriptProcessor.onaudioprocess = (e) => {
  if (this.isMuted || !this.ws || this.ws.readyState !== WebSocket.OPEN || this.isCharacterSpeaking) {
    return
  }

  const audioData = e.inputBuffer.getChannelData(0)
  const int16Array = this.float32ToInt16(audioData)

  // Convert Int16Array to regular array for JSON serialization
  const audioArray = Array.from(int16Array)

  const message = JSON.stringify({
    type: 'audio',  // lowercase
    audio: [audioArray],  // Wrap in array
    sampleRate: 16000
  })

  this.ws.send(message)  // ❌ Sends EVERY audio frame immediately (60+ times/sec)
}
```

**Problems:**
- Sends ~60 messages per second (one per ScriptProcessor frame)
- No buffering or batching
- Wraps single array in another array `[audioArray]` - wrong format
- Sends as Int16Array converted to regular array - inefficient
- No `audioSessionEnd` signal

#### Inworld Template (CORRECT):
```typescript
// voice_agent/client/src/app/chat/Chat.tsx:108-147
const startRecording = async () => {
  let leftChannel: Float32Array[] = []

  scriptNode.onaudioprocess = (audioProcessingEvent) => {
    const samples = audioProcessingEvent.inputBuffer.getChannelData(0)
    leftChannel.push(new Float32Array(samples))  // ✅ Buffer chunks
  }

  source.connect(scriptNode)
  scriptNode.connect(audioCtx.destination)

  interval = setInterval(() => {
    connection.send(
      JSON.stringify({
        type: 'audio',
        audio: leftChannel  // ✅ Send array of Float32Array chunks
      }),
    )
    leftChannel = []  // ✅ Clear buffer
  }, 100)  // ✅ Send every 100ms (10 times/sec)
}

const stopRecording = () => {
  clearInterval(interval)
  stream.getTracks().forEach((track) => track.stop())
  connection.send(JSON.stringify({ type: 'audioSessionEnd' }))  // ✅ Signal end
}
```

**Key Differences:**

| Aspect | Our Implementation ❌ | Inworld Template ✅ |
|--------|----------------------|---------------------|
| Send frequency | ~60/sec (every frame) | ~10/sec (every 100ms) |
| Buffering | None | Buffers chunks |
| Data format | `[Array<number>]` | `Array<Float32Array>` |
| End signal | None | `audioSessionEnd` |
| Efficiency | Low (JSON serializes every frame) | High (batched sends) |

---

### Issue #3: Audio Playback - No Gapless Playback

**Symptom:** Potential audio clicks/pops between TTS chunks.

**Root Cause:** Our implementation doesn't schedule audio seamlessly.

#### Our Implementation:
```typescript
// VoiceStreamClient.ts:372-401
private async playAudioChunk(arrayBuffer: ArrayBuffer): Promise<void> {
  const audioBuffer = await this.audioContext!.decodeAudioData(arrayBuffer)
  const source = this.audioContext!.createBufferSource()
  source.buffer = audioBuffer
  source.connect(this.audioContext!.destination)

  source.onended = () => {
    resolve()  // Wait for chunk to finish
  }

  source.start(0)  // ❌ Start immediately, no scheduling
}
```

**Problem:** No timing coordination between chunks - potential gaps/clicks.

#### Inworld Template:
```typescript
// voice_agent/client/src/app/sound/Player.ts:87-138
private async playAudioChunk(base64Chunk: string): Promise<void> {
  const audioBuffer = await this.audioContext.decodeAudioData(bytes.buffer)
  const source = this.audioContext.createBufferSource()
  source.buffer = audioBuffer

  // Apply short fade-in to eliminate clicks
  const fadeGain = this.audioContext.createGain()
  fadeGain.connect(this.gainNode)
  source.connect(fadeGain)

  // ✅ Calculate timing for gapless playback
  const currentTime = this.audioContext.currentTime
  const startTime = Math.max(currentTime, this.nextStartTime)

  // ✅ Apply crossfade
  fadeGain.gain.setValueAtTime(0, startTime)
  fadeGain.gain.linearRampToValueAtTime(1, startTime + this.fadeTime)

  const endTime = startTime + audioBuffer.duration
  fadeGain.gain.setValueAtTime(1, endTime - this.fadeTime)
  fadeGain.gain.linearRampToValueAtTime(0, endTime)

  // ✅ Schedule playback
  source.start(startTime)
  source.stop(endTime)

  // ✅ Update next start time for seamless chaining
  this.nextStartTime = endTime
}
```

**Benefits:**
- Gapless playback using `nextStartTime`
- 5ms crossfade to eliminate clicks
- Precise timing coordination

---

## 🛠️ Fix Plan

### Fix #1: Message Attribution (Backend Change Required)

**Location:** Backend voice agent needs to track and send correct speaker field.

**Expected Message Format:**
```json
{
  "type": "transcript",
  "text": "Hello, how are you?",
  "speaker": "USER",  // or "CHARACTER"
  "timestamp": 1234567890
}
```

**Action:** Review backend message handling in:
- `apps/workers/container/voice-agent-template/voice_agent/server/`

---

### Fix #2: Refactor Voice Input (Frontend)

**File:** `apps/stage-web/src/services/voice/VoiceStreamClient.ts`

**Changes:**

1. **Add interval-based batching:**
```typescript
export class VoiceStreamClient {
  private audioBuffer: Float32Array[] = []
  private sendInterval: NodeJS.Timeout | null = null

  async startAudioCapture(): Promise<void> {
    // ... existing setup ...

    this.scriptProcessor.onaudioprocess = (e) => {
      if (this.isMuted || this.isCharacterSpeaking) return

      const audioData = e.inputBuffer.getChannelData(0)
      this.audioBuffer.push(new Float32Array(audioData))  // Buffer chunks
    }

    // Send batched audio every 100ms
    this.sendInterval = setInterval(() => {
      if (this.audioBuffer.length > 0 && this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({
          type: 'audio',
          audio: this.audioBuffer  // Send array of Float32Array
        }))
        this.audioBuffer = []  // Clear buffer
      }
    }, 100)
  }

  stopAudioCapture(): void {
    if (this.sendInterval) {
      clearInterval(this.sendInterval)
      this.sendInterval = null
    }

    // Send end signal
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'audioSessionEnd' }))
    }

    // ... existing cleanup ...
  }
}
```

2. **Fix data format:**
   - Remove `[audioArray]` wrapping
   - Send `Float32Array` chunks directly
   - Remove unnecessary Int16 conversion (keep Float32)

---

### Fix #3: Improve Audio Playback

**File:** `apps/stage-web/src/services/voice/VoiceStreamClient.ts`

**Changes:**

1. **Add gapless playback:**
```typescript
export class VoiceStreamClient {
  private nextStartTime = 0
  private fadeTime = 0.005 // 5ms crossfade
  private gainNode: GainNode | null = null

  private async playAudioChunk(arrayBuffer: ArrayBuffer): Promise<void> {
    if (!this.audioContext) {
      this.audioContext = new AudioContext({ sampleRate: 24000 })
      this.gainNode = this.audioContext.createGain()
      this.gainNode.connect(this.audioContext.destination)
    }

    return new Promise(async (resolve, reject) => {
      try {
        const audioBuffer = await this.audioContext!.decodeAudioData(arrayBuffer)
        const source = this.audioContext!.createBufferSource()
        source.buffer = audioBuffer

        // Create fade gain node
        const fadeGain = this.audioContext!.createGain()
        fadeGain.connect(this.gainNode!)
        source.connect(fadeGain)

        // Calculate timing for gapless playback
        const currentTime = this.audioContext!.currentTime
        const startTime = Math.max(currentTime, this.nextStartTime)

        // Apply crossfade
        fadeGain.gain.setValueAtTime(0, startTime)
        fadeGain.gain.linearRampToValueAtTime(1, startTime + this.fadeTime)

        const endTime = startTime + audioBuffer.duration
        fadeGain.gain.setValueAtTime(1, endTime - this.fadeTime)
        fadeGain.gain.linearRampToValueAtTime(0, endTime)

        // Schedule playback
        source.start(startTime)
        source.stop(endTime)

        source.onended = () => resolve()

        // Update next start time
        this.nextStartTime = endTime

        this.audioPlayedSeconds += audioBuffer.duration
        this.callbacks.onAudio?.(arrayBuffer)
      } catch (error) {
        console.error('[VoiceStream] Failed to decode/play audio:', error)
        reject(error)
      }
    })
  }
}
```

---

## 📊 Comparison Summary

| Feature | Current Implementation | After Fix | Inworld Template |
|---------|----------------------|-----------|------------------|
| Audio send rate | 60/sec ❌ | 10/sec ✅ | 10/sec ✅ |
| Buffering | None ❌ | Yes ✅ | Yes ✅ |
| Data format | `[Array<number>]` ❌ | `Array<Float32Array>` ✅ | `Array<Float32Array>` ✅ |
| End signal | None ❌ | `audioSessionEnd` ✅ | `audioSessionEnd` ✅ |
| Gapless playback | No ❌ | Yes ✅ | Yes ✅ |
| Crossfade | No ❌ | 5ms ✅ | 5ms ✅ |
| Message attribution | Broken ❌ | Fixed ✅ | N/A (different system) |

---

## 🎯 Testing Checklist

After implementing fixes, test:

1. **Message Attribution**
   - [ ] User messages show as "You:"
   - [ ] Character messages show as character name
   - [ ] No duplicate messages

2. **Voice Input**
   - [ ] No empty messages sent
   - [ ] Full user speech captured
   - [ ] Character doesn't interrupt mid-sentence
   - [ ] Proper end-of-speech detection

3. **Audio Playback**
   - [ ] No clicks/pops between chunks
   - [ ] Smooth continuous audio
   - [ ] Proper queueing of responses
   - [ ] Interruption works correctly

4. **Overall Experience**
   - [ ] Natural conversation flow
   - [ ] Low latency
   - [ ] Stable WebSocket connection
   - [ ] Proper cleanup on disconnect

---

## 📁 Files to Modify

### Frontend (High Priority)
1. `apps/stage-web/src/services/voice/VoiceStreamClient.ts` - Main fixes
2. `apps/stage-web/src/components/VoiceChat.vue` - Verify message display

### Backend (Medium Priority - for message attribution)
3. Review message handling in voice agent server

---

## 🚀 Implementation Order

1. **Phase 1: Voice Input Refactoring** (Critical)
   - Add interval-based batching
   - Fix data format
   - Add `audioSessionEnd` signal
   - **Estimated Time:** 1-2 hours

2. **Phase 2: Audio Playback Improvements** (Important)
   - Add gapless playback
   - Implement crossfade
   - **Estimated Time:** 1 hour

3. **Phase 3: Backend Message Attribution** (Important)
   - Fix speaker field in backend
   - **Estimated Time:** 30 minutes - 1 hour

4. **Phase 4: Testing & Refinement** (Critical)
   - End-to-end testing
   - Bug fixes
   - **Estimated Time:** 2-3 hours

**Total Estimated Time:** 4.5 - 7 hours

---

## 💡 Key Insights from Inworld Template

1. **Batch Audio Sends:** Send every 100ms instead of every frame
2. **Use Float32Array:** More efficient than converting to regular arrays
3. **Signal Session End:** Properly close audio sessions
4. **Gapless Playback:** Use `nextStartTime` for seamless audio
5. **Crossfade:** Eliminate clicks with short fades

---

**Ready to implement fixes? Start with Phase 1 (Voice Input Refactoring) as it's the most critical issue.**
