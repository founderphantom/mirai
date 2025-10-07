# Frontend & API Gateway Integration Guide

**Project:** Mirai MVP - AI Companion Platform
**Frontend:** apps/stage-web (Vue 3)
**API Gateway:** apps/workers/api-gateway (Cloudflare Workers + Hono)
**Voice Agent:** apps/workers/container/voice-agent-template (Inworld Runtime)
**Last Updated:** 2025-10-07

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Authentication Integration](#authentication-integration)
3. [Character Management](#character-management)
4. [Voice Session Flow](#voice-session-flow)
5. [WebSocket Voice Communication](#websocket-voice-communication)
6. [Frontend Refactoring Requirements](#frontend-refactoring-requirements)
7. [Error Handling](#error-handling)
8. [Environment Configuration](#environment-configuration)
9. [Testing Strategy](#testing-strategy)
10. [Code Examples](#code-examples)

---

## Architecture Overview

### System Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    Frontend (apps/stage-web)                     │
│                      Vue 3 + Vite + TypeScript                   │
├─────────────────────────────────────────────────────────────────┤
│  Components:                                                     │
│    • Character Selector (choose from user's characters)         │
│    • Voice Chat Interface (mic mute/unmute)                     │
│    • Live2D/VRM Renderer (character visualization)              │
│    • Chat History Display (conversation transcript)             │
│    • Audio Playback (TTS from Inworld)                          │
└────────────────────────┬────────────────────────────────────────┘
                         │ HTTPS REST API & WebSocket (wss://)
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│              API Gateway (apps/workers/api-gateway)              │
│                  Cloudflare Worker (Hono Framework)              │
├─────────────────────────────────────────────────────────────────┤
│  Endpoints:                                                      │
│    • POST /api/auth/sign-in                                     │
│    • POST /api/auth/sign-up                                     │
│    • GET  /api/characters (list user's characters)              │
│    • POST /api/characters (create character)                    │
│    • POST /api/voice/session/start (start voice session)        │
│    • GET  /api/voice/ws?sessionKey=xxx (WebSocket upgrade)      │
│    • POST /api/voice/session/:id/end (end voice session)        │
└────────────────────────┬────────────────────────────────────────┘
         │               │               │
         ↓               ↓               ↓
    ┌──────────┐   ┌──────────┐   ┌──────────────────────┐
    │ D1       │   │ KV Cache │   │ Voice Agent Container│
    │ Database │   │ (Sessions)│   │  (Inworld Runtime)   │
    └──────────┘   └──────────┘   └──────────────────────┘
                                            │
                                            ↓
                                   ┌─────────────────┐
                                   │ Inworld Platform│
                                   │  • STT (Chirp)  │
                                   │  • LLM (GPT-4o) │
                                   │  • TTS (Google) │
                                   └─────────────────┘
```

### Key Architectural Decisions

1. **No Direct AI Provider Access**: Frontend does NOT interact directly with OpenAI, Anthropic, etc. All AI interactions go through Inworld Runtime via API Gateway.

2. **Preset Characters Only**: Users choose from pre-configured characters (no custom AI model selection or API key input).

3. **Managed Voice Pipeline**: Inworld Runtime handles the complete voice pipeline:
   - Speech-to-Text (STT): Microphone audio → text transcription
   - Language Model (LLM): Character personality + context → response
   - Text-to-Speech (TTS): Response text → audio output

4. **Session-Based Authentication**: Better-Auth provides JWT-based sessions with cookie support.

---

## Authentication Integration

### 1. Install Better-Auth Client

```bash
# In apps/stage-web
pnpm add @better-auth/react
```

### 2. Create Auth Client

```typescript
// apps/stage-web/src/lib/auth.ts
import { createAuthClient } from '@better-auth/react'

export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8787',
  // Automatically includes credentials (cookies) in requests
  credentials: 'include',
})

// Export hooks and utilities
export * from '@better-auth/react'
```

### 3. Environment Variables

```env
# apps/stage-web/.env
VITE_API_URL=https://api.miraichat.app
VITE_WS_URL=wss://api.miraichat.app
```

### 4. Authentication Flow

#### Sign Up

```typescript
// apps/stage-web/src/pages/auth/SignUp.vue
<script setup lang="ts">
import { ref } from 'vue'
import { authClient } from '@/lib/auth'
import { useRouter } from 'vue-router'

const router = useRouter()
const email = ref('')
const password = ref('')
const name = ref('')
const error = ref<string | null>(null)
const loading = ref(false)

async function handleSignUp() {
  loading.value = true
  error.value = null

  try {
    const { data, error: signUpError } = await authClient.signUp.email({
      email: email.value,
      password: password.value,
      name: name.value,
      callbackURL: '/dashboard',
    })

    if (signUpError) {
      error.value = signUpError.message
      return
    }

    // Success - redirect to dashboard
    router.push('/dashboard')
  } catch (err) {
    error.value = 'An unexpected error occurred'
    console.error('Sign up error:', err)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <form @submit.prevent="handleSignUp">
    <input v-model="name" type="text" placeholder="Name" required />
    <input v-model="email" type="email" placeholder="Email" required />
    <input v-model="password" type="password" placeholder="Password" required />
    <button type="submit" :disabled="loading">
      {{ loading ? 'Creating account...' : 'Sign Up' }}
    </button>
    <p v-if="error" class="error">{{ error }}</p>
  </form>
</template>
```

#### Sign In

```typescript
// apps/stage-web/src/pages/auth/SignIn.vue
<script setup lang="ts">
import { ref } from 'vue'
import { authClient } from '@/lib/auth'
import { useRouter } from 'vue-router'

const router = useRouter()
const email = ref('')
const password = ref('')
const error = ref<string | null>(null)
const loading = ref(false)

async function handleSignIn() {
  loading.value = true
  error.value = null

  try {
    const { data, error: signInError } = await authClient.signIn.email({
      email: email.value,
      password: password.value,
      callbackURL: '/dashboard',
    })

    if (signInError) {
      error.value = signInError.message
      return
    }

    router.push('/dashboard')
  } catch (err) {
    error.value = 'An unexpected error occurred'
    console.error('Sign in error:', err)
  } finally {
    loading.value = false
  }
}

// Social sign-in (optional)
async function handleGoogleSignIn() {
  await authClient.signIn.social({
    provider: 'google',
    callbackURL: '/dashboard',
  })
}

async function handleDiscordSignIn() {
  await authClient.signIn.social({
    provider: 'discord',
    callbackURL: '/dashboard',
  })
}
</script>
```

#### Session Management

```typescript
// apps/stage-web/src/App.vue
<script setup lang="ts">
import { useSession } from '@/lib/auth'
import { computed, watch } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const { data: session, isPending, error } = useSession()

// Computed property for auth state
const isAuthenticated = computed(() => !!session.value?.user)
const user = computed(() => session.value?.user)

// Redirect to login if not authenticated
watch(
  () => [isPending.value, isAuthenticated.value, router.currentRoute.value.path],
  ([pending, authenticated, path]) => {
    if (pending) return

    // Public routes
    const publicRoutes = ['/auth/sign-in', '/auth/sign-up', '/']
    const isPublicRoute = publicRoutes.includes(path)

    if (!authenticated && !isPublicRoute) {
      router.push('/auth/sign-in')
    }
  },
  { immediate: true }
)
</script>

<template>
  <div v-if="isPending">
    <LoadingScreen />
  </div>
  <RouterView v-else-if="isAuthenticated" />
  <AuthLayout v-else />
</template>
```

#### Sign Out

```typescript
// apps/stage-web/src/components/UserMenu.vue
<script setup lang="ts">
import { authClient } from '@/lib/auth'
import { useRouter } from 'vue-router'

const router = useRouter()

async function handleSignOut() {
  await authClient.signOut()
  router.push('/auth/sign-in')
}
</script>
```

---

## Character Management

### API Endpoints

#### 1. List User's Characters

```typescript
// apps/stage-web/src/services/api/characters.ts
import { authClient } from '@/lib/auth'

export interface Character {
  id: string
  userId: string
  inworldCharacterId: string
  displayName: string
  live2dModelKey?: string
  avatarThumbnail?: string
  personalityConfig: {
    motivations: string[]
    flaws: string[]
    dialogueStyle: string
    adjectives: string[]
    voiceConfig?: {
      pitch?: number
      speed?: number
      emotionRange?: 'low' | 'medium' | 'high'
    }
  }
  isPublic: boolean
  totalConversations: number
  createdAt: string
  updatedAt: string
}

export interface CharactersResponse {
  characters: Character[]
}

export async function getCharacters(): Promise<CharactersResponse> {
  const session = await authClient.getSession()
  if (!session) {
    throw new Error('Not authenticated')
  }

  const response = await fetch(
    `${import.meta.env.VITE_API_URL}/api/characters`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include', // Include auth cookies
    }
  )

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.message || 'Failed to fetch characters')
  }

  return response.json()
}
```

#### 2. Get Single Character

```typescript
export async function getCharacter(characterId: string): Promise<Character> {
  const session = await authClient.getSession()
  if (!session) {
    throw new Error('Not authenticated')
  }

  const response = await fetch(
    `${import.meta.env.VITE_API_URL}/api/characters/${characterId}`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    }
  )

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Character not found')
    }
    const error = await response.json()
    throw new Error(error.message || 'Failed to fetch character')
  }

  return response.json()
}
```

#### 3. Create Character

```typescript
export interface CreateCharacterRequest {
  displayName: string
  personalityConfig: {
    motivations: string[]
    flaws: string[]
    dialogueStyle: string
    adjectives: string[]
    voiceConfig?: {
      pitch?: number
      speed?: number
      emotionRange?: 'low' | 'medium' | 'high'
    }
  }
  live2dModelKey?: string
}

export async function createCharacter(
  data: CreateCharacterRequest
): Promise<Character> {
  const session = await authClient.getSession()
  if (!session) {
    throw new Error('Not authenticated')
  }

  const response = await fetch(
    `${import.meta.env.VITE_API_URL}/api/characters`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(data),
    }
  )

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.message || 'Failed to create character')
  }

  return response.json()
}
```

### Character Selector Component

```typescript
// apps/stage-web/src/components/CharacterSelector.vue
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { getCharacters, type Character } from '@/services/api/characters'

const emit = defineEmits<{
  select: [character: Character]
}>()

const characters = ref<Character[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const selectedCharacter = ref<Character | null>(null)

onMounted(async () => {
  try {
    const response = await getCharacters()
    characters.value = response.characters
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load characters'
  } finally {
    loading.value = false
  }
})

function selectCharacter(character: Character) {
  selectedCharacter.value = character
  emit('select', character)
}
</script>

<template>
  <div class="character-selector">
    <h2>Choose Your Companion</h2>

    <div v-if="loading" class="loading">
      <p>Loading characters...</p>
    </div>

    <div v-else-if="error" class="error">
      <p>{{ error }}</p>
      <button @click="() => window.location.reload()">Retry</button>
    </div>

    <div v-else-if="characters.length === 0" class="empty">
      <p>You don't have any characters yet.</p>
      <RouterLink to="/characters/create">Create Your First Character</RouterLink>
    </div>

    <div v-else class="character-grid">
      <div
        v-for="character in characters"
        :key="character.id"
        class="character-card"
        :class="{ selected: selectedCharacter?.id === character.id }"
        @click="selectCharacter(character)"
      >
        <img
          :src="character.avatarThumbnail || '/default-avatar.png'"
          :alt="character.displayName"
        />
        <h3>{{ character.displayName }}</h3>
        <p class="personality">{{ character.personalityConfig.dialogueStyle }}</p>
        <div class="traits">
          <span
            v-for="adjective in character.personalityConfig.adjectives.slice(0, 3)"
            :key="adjective"
            class="trait"
          >
            {{ adjective }}
          </span>
        </div>
        <p class="conversations">
          {{ character.totalConversations }} conversations
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.character-selector {
  padding: 2rem;
}

.character-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 1.5rem;
  margin-top: 2rem;
}

.character-card {
  border: 2px solid #e0e0e0;
  border-radius: 12px;
  padding: 1rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.character-card:hover {
  border-color: #4a90e2;
  transform: translateY(-4px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.character-card.selected {
  border-color: #4a90e2;
  background-color: #f0f8ff;
}

.character-card img {
  width: 100%;
  height: 200px;
  object-fit: cover;
  border-radius: 8px;
}

.personality {
  color: #666;
  font-size: 0.9rem;
  margin: 0.5rem 0;
}

.traits {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin: 0.5rem 0;
}

.trait {
  background-color: #e8f4fd;
  color: #2c7db8;
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.8rem;
}

.conversations {
  color: #999;
  font-size: 0.85rem;
  margin-top: 0.5rem;
}
</style>
```

---

## Voice Session Flow

### Complete Voice Session Workflow

```typescript
// apps/stage-web/src/services/voice/VoiceSessionManager.ts
import { authClient } from '@/lib/auth'
import type { Character } from '@/services/api/characters'

export interface VoiceSession {
  sessionKey: string
  conversationId: string
  websocketUrl: string
  expiresAt: number
}

export interface VoiceSessionMetrics {
  durationSeconds: number
  audioSeconds: number
}

export class VoiceSessionManager {
  private apiUrl: string
  private wsUrl: string

  constructor() {
    this.apiUrl = import.meta.env.VITE_API_URL
    this.wsUrl = import.meta.env.VITE_WS_URL
  }

  /**
   * Start a new voice session
   */
  async startSession(character: Character): Promise<VoiceSession> {
    const session = await authClient.getSession()
    if (!session) {
      throw new Error('Not authenticated')
    }

    const response = await fetch(`${this.apiUrl}/api/voice/session/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        characterId: character.id,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Failed to start voice session')
    }

    return response.json()
  }

  /**
   * End an active voice session
   */
  async endSession(
    sessionKey: string,
    metrics: VoiceSessionMetrics
  ): Promise<void> {
    const session = await authClient.getSession()
    if (!session) {
      throw new Error('Not authenticated')
    }

    const response = await fetch(
      `${this.apiUrl}/api/voice/session/${sessionKey}/end`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(metrics),
      }
    )

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Failed to end voice session')
    }
  }

  /**
   * Get WebSocket URL for voice streaming
   */
  getWebSocketUrl(sessionKey: string): string {
    return `${this.wsUrl}/api/voice/ws?sessionKey=${sessionKey}`
  }
}
```

---

## WebSocket Voice Communication

### Audio Streaming Implementation

```typescript
// apps/stage-web/src/services/voice/VoiceStreamClient.ts
export interface TranscriptMessage {
  type: 'transcript'
  text: string
  speaker: 'USER' | 'CHARACTER'
  timestamp: number
}

export interface EmotionMessage {
  type: 'emotion'
  emotion: string
  intensity: number
  timestamp: number
}

export interface ErrorMessage {
  type: 'error'
  message: string
  code: string
  timestamp: number
}

export type VoiceMessage = TranscriptMessage | EmotionMessage | ErrorMessage

export interface VoiceStreamCallbacks {
  onTranscript?: (text: string, speaker: string) => void
  onEmotion?: (emotion: string, intensity: number) => void
  onAudio?: (audioData: ArrayBuffer) => void
  onError?: (error: string) => void
  onOpen?: () => void
  onClose?: () => void
}

export class VoiceStreamClient {
  private ws: WebSocket | null = null
  private audioContext: AudioContext | null = null
  private mediaStream: MediaStream | null = null
  private scriptProcessor: ScriptProcessorNode | null = null
  private isMuted = false
  private startTime: number = 0
  private audioPlayedSeconds = 0

  constructor(private callbacks: VoiceStreamCallbacks) {}

  /**
   * Connect to voice stream WebSocket
   */
  async connect(websocketUrl: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(websocketUrl)
        this.ws.binaryType = 'arraybuffer'

        this.ws.onopen = () => {
          console.log('[VoiceStream] Connected')
          this.startTime = Date.now()
          this.callbacks.onOpen?.()
          resolve()
        }

        this.ws.onerror = (error) => {
          console.error('[VoiceStream] WebSocket error:', error)
          const errorMsg = 'Failed to connect to voice service'
          this.callbacks.onError?.(errorMsg)
          reject(new Error(errorMsg))
        }

        this.ws.onclose = () => {
          console.log('[VoiceStream] Disconnected')
          this.callbacks.onClose?.()
          this.cleanup()
        }

        this.ws.onmessage = async (event) => {
          await this.handleMessage(event.data)
        }
      } catch (error) {
        reject(error)
      }
    })
  }

  /**
   * Start capturing microphone audio
   */
  async startAudioCapture(): Promise<void> {
    try {
      // Request microphone permission
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000,
          channelCount: 1,
        },
      })

      // Create audio context
      this.audioContext = new AudioContext({ sampleRate: 16000 })
      const source = this.audioContext.createMediaStreamSource(this.mediaStream)

      // Create audio processor
      this.scriptProcessor = this.audioContext.createScriptProcessor(4096, 1, 1)

      this.scriptProcessor.onaudioprocess = (e) => {
        if (this.isMuted || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
          return
        }

        const audioData = e.inputBuffer.getChannelData(0)
        const int16Array = this.float32ToInt16(audioData)
        this.ws.send(int16Array.buffer)
      }

      source.connect(this.scriptProcessor)
      this.scriptProcessor.connect(this.audioContext.destination)

      console.log('[VoiceStream] Audio capture started')
    } catch (error) {
      console.error('[VoiceStream] Failed to start audio capture:', error)
      throw new Error('Microphone access denied')
    }
  }

  /**
   * Stop capturing microphone audio
   */
  stopAudioCapture(): void {
    if (this.scriptProcessor) {
      this.scriptProcessor.disconnect()
      this.scriptProcessor = null
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop())
      this.mediaStream = null
    }

    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close()
      this.audioContext = null
    }

    console.log('[VoiceStream] Audio capture stopped')
  }

  /**
   * Mute/unmute microphone
   */
  setMuted(muted: boolean): void {
    this.isMuted = muted
    console.log(`[VoiceStream] Microphone ${muted ? 'muted' : 'unmuted'}`)
  }

  /**
   * Disconnect and cleanup
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    this.stopAudioCapture()
  }

  /**
   * Get session metrics
   */
  getMetrics(): { durationSeconds: number; audioSeconds: number } {
    const durationSeconds = Math.floor((Date.now() - this.startTime) / 1000)
    return {
      durationSeconds,
      audioSeconds: Math.floor(this.audioPlayedSeconds),
    }
  }

  /**
   * Handle incoming WebSocket messages
   */
  private async handleMessage(data: ArrayBuffer | string): Promise<void> {
    // Binary data = audio from TTS
    if (data instanceof ArrayBuffer) {
      await this.playAudio(data)
      return
    }

    // Text data = JSON message
    try {
      const message: VoiceMessage = JSON.parse(data)

      switch (message.type) {
        case 'transcript':
          this.callbacks.onTranscript?.(message.text, message.speaker)
          break

        case 'emotion':
          this.callbacks.onEmotion?.(message.emotion, message.intensity)
          break

        case 'error':
          this.callbacks.onError?.(message.message)
          break

        default:
          console.warn('[VoiceStream] Unknown message type:', message)
      }
    } catch (error) {
      console.error('[VoiceStream] Failed to parse message:', error)
    }
  }

  /**
   * Play audio received from TTS
   */
  private async playAudio(arrayBuffer: ArrayBuffer): Promise<void> {
    if (!this.audioContext) {
      this.audioContext = new AudioContext({ sampleRate: 24000 })
    }

    try {
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer)
      const source = this.audioContext.createBufferSource()
      source.buffer = audioBuffer
      source.connect(this.audioContext.destination)
      source.start(0)

      // Track audio duration for metrics
      this.audioPlayedSeconds += audioBuffer.duration

      this.callbacks.onAudio?.(arrayBuffer)
    } catch (error) {
      console.error('[VoiceStream] Failed to play audio:', error)
    }
  }

  /**
   * Convert Float32Array to Int16Array for WebSocket transmission
   */
  private float32ToInt16(buffer: Float32Array): Int16Array {
    const int16 = new Int16Array(buffer.length)
    for (let i = 0; i < buffer.length; i++) {
      const s = Math.max(-1, Math.min(1, buffer[i]))
      int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff
    }
    return int16
  }

  /**
   * Cleanup resources
   */
  private cleanup(): void {
    this.stopAudioCapture()
    this.ws = null
  }
}
```

### Voice Chat Component

```typescript
// apps/stage-web/src/components/VoiceChat.vue
<script setup lang="ts">
import { ref, onUnmounted, computed } from 'vue'
import { VoiceSessionManager } from '@/services/voice/VoiceSessionManager'
import { VoiceStreamClient } from '@/services/voice/VoiceStreamClient'
import type { Character } from '@/services/api/characters'

const props = defineProps<{
  character: Character
}>()

const emit = defineEmits<{
  close: []
}>()

// State
const sessionManager = new VoiceSessionManager()
const voiceClient = ref<VoiceStreamClient | null>(null)
const isConnected = ref(false)
const isConnecting = ref(false)
const isMuted = ref(false)
const error = ref<string | null>(null)
const sessionKey = ref<string | null>(null)
const conversationId = ref<string | null>(null)

// Chat history
const messages = ref<Array<{ speaker: string; text: string; timestamp: number }>>([])

// Current emotion for Live2D
const currentEmotion = ref<{ emotion: string; intensity: number } | null>(null)

/**
 * Start voice session
 */
async function startSession() {
  isConnecting.value = true
  error.value = null

  try {
    // 1. Start session via API
    const session = await sessionManager.startSession(props.character)
    sessionKey.value = session.sessionKey
    conversationId.value = session.conversationId

    // 2. Connect to WebSocket
    voiceClient.value = new VoiceStreamClient({
      onTranscript: (text, speaker) => {
        messages.value.push({
          speaker,
          text,
          timestamp: Date.now(),
        })
      },
      onEmotion: (emotion, intensity) => {
        currentEmotion.value = { emotion, intensity }
      },
      onError: (errorMsg) => {
        error.value = errorMsg
      },
      onOpen: () => {
        isConnected.value = true
        isConnecting.value = false
      },
      onClose: () => {
        isConnected.value = false
        cleanup()
      },
    })

    await voiceClient.value.connect(session.websocketUrl)

    // 3. Start audio capture
    await voiceClient.value.startAudioCapture()
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to start session'
    isConnecting.value = false
  }
}

/**
 * End voice session
 */
async function endSession() {
  if (!voiceClient.value || !sessionKey.value) return

  try {
    // Get metrics before cleanup
    const metrics = voiceClient.value.getMetrics()

    // Disconnect
    voiceClient.value.disconnect()
    voiceClient.value = null

    // End session via API
    await sessionManager.endSession(sessionKey.value, metrics)

    // Close component
    emit('close')
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to end session'
  }
}

/**
 * Toggle microphone mute
 */
function toggleMute() {
  if (!voiceClient.value) return

  isMuted.value = !isMuted.value
  voiceClient.value.setMuted(isMuted.value)
}

/**
 * Cleanup on unmount
 */
function cleanup() {
  if (voiceClient.value) {
    voiceClient.value.disconnect()
    voiceClient.value = null
  }
  isConnected.value = false
  sessionKey.value = null
  conversationId.value = null
}

onUnmounted(() => {
  cleanup()
})

// Computed
const connectionStatus = computed(() => {
  if (isConnecting.value) return 'Connecting...'
  if (isConnected.value) return 'Connected'
  return 'Disconnected'
})
</script>

<template>
  <div class="voice-chat">
    <!-- Header -->
    <div class="header">
      <div class="character-info">
        <img
          :src="character.avatarThumbnail || '/default-avatar.png'"
          :alt="character.displayName"
        />
        <div>
          <h3>{{ character.displayName }}</h3>
          <p class="status">{{ connectionStatus }}</p>
        </div>
      </div>
      <button @click="endSession" class="close-btn">✕</button>
    </div>

    <!-- Error Display -->
    <div v-if="error" class="error-banner">
      <p>{{ error }}</p>
      <button @click="error = null">Dismiss</button>
    </div>

    <!-- Live2D/VRM Renderer -->
    <div class="character-display">
      <!-- TODO: Integrate Live2D/VRM renderer here -->
      <!-- Emotion sync: currentEmotion.emotion -->
      <p>Character Visualization (Live2D/VRM)</p>
      <p v-if="currentEmotion">
        Emotion: {{ currentEmotion.emotion }} ({{ currentEmotion.intensity }})
      </p>
    </div>

    <!-- Chat History -->
    <div class="chat-history">
      <div
        v-for="(msg, index) in messages"
        :key="index"
        :class="['message', msg.speaker.toLowerCase()]"
      >
        <span class="speaker">{{ msg.speaker === 'USER' ? 'You' : character.displayName }}:</span>
        <span class="text">{{ msg.text }}</span>
      </div>
    </div>

    <!-- Controls -->
    <div class="controls">
      <button
        v-if="!isConnected"
        @click="startSession"
        :disabled="isConnecting"
        class="start-btn"
      >
        {{ isConnecting ? 'Connecting...' : 'Start Conversation' }}
      </button>

      <template v-else>
        <button @click="toggleMute" :class="['mute-btn', { muted: isMuted }]">
          {{ isMuted ? '🔇 Unmute' : '🎤 Mute' }}
        </button>
        <button @click="endSession" class="end-btn">End Conversation</button>
      </template>
    </div>
  </div>
</template>

<style scoped>
.voice-chat {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background-color: #f5f5f5;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  background-color: white;
  border-bottom: 1px solid #e0e0e0;
}

.character-info {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.character-info img {
  width: 50px;
  height: 50px;
  border-radius: 50%;
  object-fit: cover;
}

.status {
  color: #666;
  font-size: 0.9rem;
}

.close-btn {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: none;
  background-color: #f0f0f0;
  cursor: pointer;
  font-size: 1.5rem;
}

.close-btn:hover {
  background-color: #e0e0e0;
}

.error-banner {
  background-color: #ffebee;
  color: #c62828;
  padding: 1rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.character-display {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background-color: #fafafa;
  padding: 2rem;
}

.chat-history {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
  background-color: white;
}

.message {
  margin-bottom: 1rem;
  padding: 0.75rem;
  border-radius: 8px;
}

.message.user {
  background-color: #e3f2fd;
  text-align: right;
}

.message.character {
  background-color: #f3e5f5;
}

.speaker {
  font-weight: bold;
  margin-right: 0.5rem;
}

.controls {
  padding: 1rem;
  background-color: white;
  border-top: 1px solid #e0e0e0;
  display: flex;
  gap: 1rem;
  justify-content: center;
}

button {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.start-btn {
  background-color: #4caf50;
  color: white;
}

.start-btn:hover:not(:disabled) {
  background-color: #45a049;
}

.start-btn:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
}

.mute-btn {
  background-color: #2196f3;
  color: white;
}

.mute-btn.muted {
  background-color: #ff9800;
}

.mute-btn:hover {
  opacity: 0.9;
}

.end-btn {
  background-color: #f44336;
  color: white;
}

.end-btn:hover {
  background-color: #da190b;
}
</style>
```

---

## Frontend Refactoring Requirements

### Features to Remove

Based on the current forked open source project, the following features should be **removed** or **disabled**:

#### 1. AI Model Selection

**Remove:**
- Model provider selection UI (OpenAI, Anthropic, Google, etc.)
- Model dropdown menus (GPT-4, Claude, Gemini)
- API key input fields
- Model configuration settings

**Why:** All AI interactions are handled by Inworld Runtime through preset characters. Users don't need to configure models.

**Files to Modify:**
```
apps/stage-web/src/pages/settings/providers/*.vue
apps/stage-web/src/pages/settings/models/index.vue
```

#### 2. API Key Management

**Remove:**
- API key input forms
- API key storage in local storage/IndexedDB
- Provider authentication screens

**Why:** Authentication is handled by Better-Auth. No direct provider access.

#### 3. Custom System Prompts

**Remove:**
- System prompt editors
- Temperature/top-p sliders
- Advanced model parameters

**Why:** Character personalities are preset and managed via the character creation flow.

#### 4. STT/TTS Provider Selection

**Remove:**
- STT provider dropdowns
- TTS provider selection
- Voice customization settings (if not part of character)

**Why:** Inworld Runtime manages the entire voice pipeline with its own providers.

### Features to Keep/Modify

#### 1. Character Selection

**Keep and Modify:**
- Character grid/list display
- Character thumbnails
- Personality trait display

**Changes:**
- Characters come from API (`GET /api/characters`)
- No local character creation (must go through API)
- Display character's preset personality traits

#### 2. Microphone Controls

**Keep:**
- Microphone mute/unmute button
- Permission request flow
- Audio level indicator (optional)

**Changes:**
- Microphone always streams to WebSocket when unmuted
- No local audio processing/transcription

#### 3. Live2D/VRM Rendering

**Keep:**
- 3D character renderer
- Emotion-based animations
- Lip sync (if implemented)

**Changes:**
- Sync emotions from Inworld WebSocket messages
- Use character's `live2dModelKey` to fetch model from R2

#### 4. Chat History

**Keep:**
- Conversation transcript display
- Message bubbles

**Changes:**
- Populate from WebSocket transcript messages
- Store in local state (not IndexedDB unless implementing offline mode)

### New Features to Add

#### 1. Authentication UI

**Add:**
- Sign-in page
- Sign-up page
- Sign-out button
- Session management

#### 2. Character Management

**Add:**
- Character creation form (with personality presets)
- Character editing (update personality, avatar)
- Character deletion

#### 3. Subscription/Billing (Future)

**Add:**
- Subscription status display
- Usage metrics (voice minutes used)
- Upgrade prompts (if on free tier)
- Polar checkout integration

### Migration Steps

1. **Phase 1: Authentication**
   - Install Better-Auth client
   - Create auth pages (sign-in, sign-up)
   - Add session management to `App.vue`
   - Add protected route guards

2. **Phase 2: Character API Integration**
   - Replace local character storage with API calls
   - Update character selector to use API
   - Remove model/provider selection UI

3. **Phase 3: Voice Session Integration**
   - Implement `VoiceSessionManager`
   - Implement `VoiceStreamClient`
   - Update voice chat component
   - Connect WebSocket to API Gateway

4. **Phase 4: Cleanup**
   - Remove unused provider settings pages
   - Remove API key management
   - Remove model configuration UI
   - Clean up unused dependencies

---

## Error Handling

### Common Errors and Solutions

#### 1. Authentication Errors

```typescript
// apps/stage-web/src/utils/errorHandler.ts
export function handleAuthError(error: any) {
  if (error.status === 401) {
    // Session expired - redirect to login
    window.location.href = '/auth/sign-in'
    return
  }

  if (error.status === 403) {
    // Insufficient permissions
    alert('You do not have permission to perform this action')
    return
  }

  // Generic auth error
  alert('Authentication error. Please sign in again.')
  window.location.href = '/auth/sign-in'
}
```

#### 2. WebSocket Connection Errors

```typescript
export function handleWebSocketError(error: any, retryCallback?: () => void) {
  console.error('WebSocket error:', error)

  // Check for common errors
  if (error.message?.includes('session expired')) {
    alert('Your session has expired. Please start a new conversation.')
    return
  }

  if (error.message?.includes('microphone')) {
    alert('Microphone access denied. Please enable microphone permissions.')
    return
  }

  // Generic WebSocket error with retry option
  if (retryCallback) {
    const shouldRetry = confirm(
      'Connection error. Would you like to try reconnecting?'
    )
    if (shouldRetry) {
      retryCallback()
    }
  } else {
    alert('Connection error. Please try again.')
  }
}
```

#### 3. API Request Errors

```typescript
export function handleApiError(error: any) {
  if (error.status === 404) {
    alert('Resource not found')
    return
  }

  if (error.status === 429) {
    alert('Too many requests. Please wait a moment and try again.')
    return
  }

  if (error.status >= 500) {
    alert('Server error. Please try again later.')
    return
  }

  // Generic error
  alert(error.message || 'An unexpected error occurred')
}
```

### Error Handling Composable

```typescript
// apps/stage-web/src/composables/useErrorHandler.ts
import { ref } from 'vue'

export function useErrorHandler() {
  const error = ref<string | null>(null)
  const isError = ref(false)

  function setError(message: string) {
    error.value = message
    isError.value = true
  }

  function clearError() {
    error.value = null
    isError.value = false
  }

  function handleError(err: any) {
    const message = err instanceof Error ? err.message : 'An error occurred'
    setError(message)
    console.error('Error:', err)
  }

  return {
    error,
    isError,
    setError,
    clearError,
    handleError,
  }
}
```

---

## Environment Configuration

### Development Environment

```env
# apps/stage-web/.env.development
VITE_API_URL=http://localhost:8787
VITE_WS_URL=ws://localhost:8787
VITE_ENVIRONMENT=development
```

### Production Environment

```env
# apps/stage-web/.env.production
VITE_API_URL=https://api.miraichat.app
VITE_WS_URL=wss://api.miraichat.app
VITE_ENVIRONMENT=production
```

### TypeScript Environment Definitions

```typescript
// apps/stage-web/src/env.d.ts
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string
  readonly VITE_WS_URL: string
  readonly VITE_ENVIRONMENT: 'development' | 'production'
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
```

---

## Testing Strategy

### Unit Tests

```typescript
// apps/stage-web/src/services/voice/__tests__/VoiceSessionManager.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { VoiceSessionManager } from '../VoiceSessionManager'

describe('VoiceSessionManager', () => {
  let manager: VoiceSessionManager

  beforeEach(() => {
    manager = new VoiceSessionManager()
    // Mock authClient
    vi.mock('@/lib/auth', () => ({
      authClient: {
        getSession: vi.fn().mockResolvedValue({ user: { id: 'user-123' } }),
      },
    }))
  })

  it('should start a session successfully', async () => {
    // Mock fetch
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        sessionKey: 'session-abc',
        conversationId: 'conv-123',
        websocketUrl: 'ws://localhost/api/voice/ws?sessionKey=session-abc',
        expiresAt: Date.now() + 300000,
      }),
    })

    const character = {
      id: 'char-123',
      displayName: 'Test Character',
      // ... other fields
    }

    const session = await manager.startSession(character as any)

    expect(session.sessionKey).toBe('session-abc')
    expect(session.conversationId).toBe('conv-123')
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/voice/session/start'),
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
      })
    )
  })

  it('should throw error if not authenticated', async () => {
    vi.mock('@/lib/auth', () => ({
      authClient: {
        getSession: vi.fn().mockResolvedValue(null),
      },
    }))

    const character = { id: 'char-123' } as any

    await expect(manager.startSession(character)).rejects.toThrow(
      'Not authenticated'
    )
  })
})
```

### Integration Tests

```typescript
// apps/stage-web/src/__tests__/integration/voice-flow.test.ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import VoiceChat from '@/components/VoiceChat.vue'

describe('Voice Chat Integration', () => {
  it('should complete full voice session flow', async () => {
    const character = {
      id: 'char-123',
      displayName: 'Test Character',
      avatarThumbnail: '/avatar.png',
      personalityConfig: {
        motivations: ['Help users'],
        flaws: ['Too eager'],
        dialogueStyle: 'Friendly',
        adjectives: ['Helpful'],
      },
      // ... other fields
    }

    const wrapper = mount(VoiceChat, {
      props: { character },
    })

    // Start session
    await wrapper.find('.start-btn').trigger('click')
    await wrapper.vm.$nextTick()

    // Verify connection
    expect(wrapper.find('.status').text()).toContain('Connected')

    // Test mute functionality
    await wrapper.find('.mute-btn').trigger('click')
    expect(wrapper.find('.mute-btn').classes()).toContain('muted')

    // End session
    await wrapper.find('.end-btn').trigger('click')
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('close')).toBeTruthy()
  })
})
```

### E2E Tests (Playwright)

```typescript
// apps/stage-web/e2e/voice-session.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Voice Session Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto('/auth/sign-in')
    await page.fill('input[type="email"]', 'test@example.com')
    await page.fill('input[type="password"]', 'password123')
    await page.click('button[type="submit"]')
    await page.waitForURL('/dashboard')
  })

  test('should start and end voice session', async ({ page, context }) => {
    // Grant microphone permission
    await context.grantPermissions(['microphone'])

    // Navigate to character selector
    await page.goto('/characters')

    // Select first character
    await page.click('.character-card:first-child')

    // Start voice session
    await page.click('.start-btn')

    // Wait for connection
    await expect(page.locator('.status')).toContainText('Connected', {
      timeout: 10000,
    })

    // Test mute toggle
    await page.click('.mute-btn')
    await expect(page.locator('.mute-btn')).toHaveClass(/muted/)

    // Unmute
    await page.click('.mute-btn')
    await expect(page.locator('.mute-btn')).not.toHaveClass(/muted/)

    // End session
    await page.click('.end-btn')

    // Verify back to character selector
    await expect(page).toHaveURL('/characters')
  })

  test('should display conversation transcript', async ({ page, context }) => {
    await context.grantPermissions(['microphone'])

    // Start session
    await page.goto('/characters')
    await page.click('.character-card:first-child')
    await page.click('.start-btn')

    // Wait for connection
    await expect(page.locator('.status')).toContainText('Connected')

    // Wait for some transcript messages (mock or real)
    await page.waitForSelector('.message', { timeout: 15000 })

    // Verify transcript display
    const messages = page.locator('.message')
    await expect(messages).toHaveCount(expect.any(Number))

    // Check message structure
    const firstMessage = messages.first()
    await expect(firstMessage.locator('.speaker')).toBeVisible()
    await expect(firstMessage.locator('.text')).toBeVisible()
  })
})
```

---

## Code Examples

### Complete Page Example: Character Selection & Voice Chat

```typescript
// apps/stage-web/src/pages/Chat.vue
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useSession } from '@/lib/auth'
import CharacterSelector from '@/components/CharacterSelector.vue'
import VoiceChat from '@/components/VoiceChat.vue'
import type { Character } from '@/services/api/characters'

const { data: session } = useSession()
const selectedCharacter = ref<Character | null>(null)
const showVoiceChat = ref(false)

function handleCharacterSelect(character: Character) {
  selectedCharacter.value = character
  showVoiceChat.value = true
}

function handleChatClose() {
  showVoiceChat.value = false
  selectedCharacter.value = null
}
</script>

<template>
  <div class="chat-page">
    <CharacterSelector
      v-if="!showVoiceChat"
      @select="handleCharacterSelect"
    />

    <VoiceChat
      v-if="showVoiceChat && selectedCharacter"
      :character="selectedCharacter"
      @close="handleChatClose"
    />
  </div>
</template>

<style scoped>
.chat-page {
  height: 100vh;
  overflow: hidden;
}
</style>
```

### API Service Module

```typescript
// apps/stage-web/src/services/api/index.ts
export * from './characters'
export * from './voice'

// Common API utilities
export function getApiUrl(path: string): string {
  return `${import.meta.env.VITE_API_URL}${path}`
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(getApiUrl(path), {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    credentials: 'include', // Always include cookies
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({
      message: `HTTP ${response.status}: ${response.statusText}`,
    }))
    throw new Error(error.message || 'API request failed')
  }

  return response.json()
}
```

### Router Configuration

```typescript
// apps/stage-web/src/router/index.ts
import { createRouter, createWebHistory } from 'vue-router'
import { authClient } from '@/lib/auth'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'Home',
      component: () => import('@/pages/Home.vue'),
    },
    {
      path: '/auth/sign-in',
      name: 'SignIn',
      component: () => import('@/pages/auth/SignIn.vue'),
    },
    {
      path: '/auth/sign-up',
      name: 'SignUp',
      component: () => import('@/pages/auth/SignUp.vue'),
    },
    {
      path: '/dashboard',
      name: 'Dashboard',
      component: () => import('@/pages/Dashboard.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/characters',
      name: 'Characters',
      component: () => import('@/pages/Characters.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/chat',
      name: 'Chat',
      component: () => import('@/pages/Chat.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/settings',
      name: 'Settings',
      component: () => import('@/pages/Settings.vue'),
      meta: { requiresAuth: true },
    },
  ],
})

// Navigation guard for protected routes
router.beforeEach(async (to, from, next) => {
  if (to.meta.requiresAuth) {
    const session = await authClient.getSession()

    if (!session?.user) {
      next({ name: 'SignIn', query: { redirect: to.fullPath } })
      return
    }
  }

  next()
})

export default router
```

---

## Summary

### Integration Checklist

- [ ] Install Better-Auth client library
- [ ] Create auth pages (sign-in, sign-up)
- [ ] Add session management to App.vue
- [ ] Create API service modules (characters, voice)
- [ ] Implement character selector component
- [ ] Implement voice chat component with WebSocket
- [ ] Add microphone controls (mute/unmute)
- [ ] Integrate Live2D/VRM renderer with emotion sync
- [ ] Remove AI model selection UI
- [ ] Remove API key management
- [ ] Remove custom system prompts
- [ ] Add protected route guards
- [ ] Add error handling
- [ ] Add unit tests
- [ ] Add integration tests
- [ ] Add E2E tests
- [ ] Update environment variables
- [ ] Test full flow (auth → character select → voice session)

### Key Points to Remember

1. **All AI interactions go through API Gateway** - No direct provider access
2. **Users choose preset characters** - No custom model configuration
3. **Microphone mute/unmute is local** - Audio streaming controlled client-side
4. **TTS is always enabled** - Inworld Runtime always returns audio
5. **Session-based authentication** - Better-Auth manages JWT sessions
6. **WebSocket for real-time voice** - REST API for session management

### Next Steps

1. Set up authentication pages
2. Integrate character API
3. Implement voice session flow
4. Test end-to-end
5. Deploy to staging
6. User acceptance testing

---

**Questions or Issues?**

- API Gateway Code: `apps/workers/api-gateway/`
- Voice Agent Code: `apps/workers/container/voice-agent-template/`
- Architecture Docs: `product-documentation/mvp/`
- Better-Auth Docs: `product-documentation/mvp/better-auth.md`
- Inworld Integration: `apps/workers/container/voice-agent-template/INTEGRATIONS.md`

**Last Updated:** 2025-10-07
**Maintained by:** Phantom Systems Inc
