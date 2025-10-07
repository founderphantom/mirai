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
          <p class="status" :class="{ connected: isConnected }">{{ connectionStatus }}</p>
        </div>
      </div>
      <button @click="endSession" class="close-btn">✕</button>
    </div>

    <!-- Error Display -->
    <div v-if="error" class="error-banner">
      <p>{{ error }}</p>
      <button @click="error = null">Dismiss</button>
    </div>

    <!-- Character Display Area -->
    <div class="character-display">
      <!-- TODO: Integrate Live2D/VRM renderer here -->
      <div class="placeholder">
        <div class="avatar-circle">
          <img
            :src="character.avatarThumbnail || '/default-avatar.png'"
            :alt="character.displayName"
          />
        </div>
        <p class="placeholder-text">Character Visualization</p>
        <p v-if="currentEmotion" class="emotion-display">
          {{ currentEmotion.emotion }} ({{ currentEmotion.intensity }})
        </p>
      </div>
    </div>

    <!-- Chat History -->
    <div class="chat-history">
      <div class="messages-container">
        <div
          v-for="(msg, index) in messages"
          :key="index"
          :class="['message', msg.speaker.toLowerCase()]"
        >
          <span class="speaker">{{ msg.speaker === 'USER' ? 'You' : character.displayName }}:</span>
          <span class="text">{{ msg.text }}</span>
        </div>
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

.character-info h3 {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: #1a202c;
}

.status {
  color: #9ca3af;
  font-size: 0.875rem;
  margin: 0.25rem 0 0 0;
}

.status.connected {
  color: #10b981;
}

.close-btn {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: none;
  background-color: #f0f0f0;
  cursor: pointer;
  font-size: 1.5rem;
  transition: background-color 0.2s;
}

.close-btn:hover {
  background-color: #e0e0e0;
}

.error-banner {
  background-color: #fee2e2;
  color: #991b1b;
  padding: 1rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #fecaca;
}

.error-banner p {
  margin: 0;
  font-size: 0.875rem;
}

.error-banner button {
  padding: 0.5rem 1rem;
  background-color: #991b1b;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 0.875rem;
  cursor: pointer;
}

.character-display {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 2rem;
}

.placeholder {
  text-align: center;
  color: white;
}

.avatar-circle {
  width: 200px;
  height: 200px;
  border-radius: 50%;
  overflow: hidden;
  margin: 0 auto 1rem;
  border: 4px solid white;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
}

.avatar-circle img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.placeholder-text {
  font-size: 1.125rem;
  font-weight: 500;
  margin-bottom: 0.5rem;
  opacity: 0.9;
}

.emotion-display {
  font-size: 1rem;
  font-weight: 600;
  margin-top: 1rem;
  padding: 0.5rem 1rem;
  background-color: rgba(255, 255, 255, 0.2);
  border-radius: 20px;
  display: inline-block;
}

.chat-history {
  flex: 1;
  overflow-y: auto;
  background-color: white;
  border-top: 1px solid #e0e0e0;
}

.messages-container {
  padding: 1rem;
}

.message {
  margin-bottom: 1rem;
  padding: 0.75rem;
  border-radius: 8px;
  max-width: 80%;
}

.message.user {
  background-color: #dbeafe;
  margin-left: auto;
  text-align: right;
}

.message.character {
  background-color: #f3e8ff;
  margin-right: auto;
}

.speaker {
  font-weight: 600;
  margin-right: 0.5rem;
  color: #374151;
}

.text {
  color: #1f2937;
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
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.start-btn {
  background-color: #10b981;
  color: white;
}

.start-btn:hover:not(:disabled) {
  background-color: #059669;
}

.start-btn:disabled {
  background-color: #d1d5db;
  cursor: not-allowed;
}

.mute-btn {
  background-color: #3b82f6;
  color: white;
}

.mute-btn.muted {
  background-color: #f59e0b;
}

.mute-btn:hover {
  opacity: 0.9;
}

.end-btn {
  background-color: #ef4444;
  color: white;
}

.end-btn:hover {
  background-color: #dc2626;
}
</style>
