<script setup lang="ts">
import { ref, onUnmounted, onMounted, computed, watch } from 'vue'
import { VoiceSessionManager, type QuotaError } from '@/services/voice/VoiceSessionManager'
import { WorkersAIStreamClient } from '@/services/voice/WorkersAIStreamClient'
import type { Character } from '@/services/api/characters'
import { useErrorHandler } from '@/composables/useErrorHandler'
import UpgradePrompt from './UpgradePrompt.vue'

const props = defineProps<{
  character: Character
}>()

const emit = defineEmits<{
  close: []
  emotion: [emotion: string, intensity: number]
}>()

// State
const sessionManager = new VoiceSessionManager()
const voiceClient = ref<WorkersAIStreamClient | null>(null)
const isConnected = ref(false)
const isConnecting = ref(false)
const isMuted = ref(false)
const sessionKey = ref<string | null>(null)
const conversationId = ref<string | null>(null)
const isEndingSession = ref(false) // Prevent duplicate endSession calls

// Error handling with composable
const { handleWebSocketError, handleApiError, errorMessage, clearError } = useErrorHandler()

// Quota error state
const showUpgradePrompt = ref(false)
const quotaErrorData = ref<{
  message: string
  usage?: any
  upgradeUrl?: string
}>({
  message: '',
})

// Chat history
const messages = ref<Array<{ speaker: string; text: string; timestamp: number }>>([])

// Current emotion for Live2D
const currentEmotion = ref<{ emotion: string; intensity: number } | null>(null)

// Note: Live2D model is rendered in the main stage area (WidgetStage)
// This component focuses on the chat UI and voice controls

// Audio visualization
const audioLevel = ref(0)
const isListening = ref(false)
let animationFrameId: number | null = null

/**
 * Start voice session
 */
async function startSession() {
  isConnecting.value = true
  clearError()

  try {
    // 1. Start session via API
    const session = await sessionManager.startSession(props.character)
    sessionKey.value = session.sessionKey
    conversationId.value = session.conversationId

    // 2. Connect to WebSocket using Workers AI endpoint
    voiceClient.value = new WorkersAIStreamClient({
      onTranscript: (text: string, speaker: string) => {
        messages.value.push({
          speaker,
          text,
          timestamp: Date.now(),
        })
      },
      onEmotion: (emotion: string, intensity: number) => {
        currentEmotion.value = { emotion, intensity }
        // Emit to parent so the stage's Live2D model can react
        emit('emotion', emotion, intensity)
      },
      onError: (errorMsg: string) => {
        handleWebSocketError(errorMsg, () => startSession())
      },
      onOpen: () => {
        isConnected.value = true
        isConnecting.value = false
      },
      onClose: () => {
        isConnected.value = false
        cleanup()
      }
    })

    // Get all three WebSocket URLs (triple connection architecture)
    const audioStreamUrl = sessionManager.getWorkersAIWebSocketUrl(session.sessionKey)
    const fluxUrl = sessionManager.getFluxWebSocketUrl(session.sessionKey)
    const agentUrl = sessionManager.getWebSocketUrl(session.sessionKey)

    console.log('[VoiceChat] Connecting to Workers AI endpoints:', {
      audioStream: audioStreamUrl,
      flux: fluxUrl,
      agent: agentUrl,
    })

    // Connect to all three WebSockets simultaneously
    await voiceClient.value.connect(audioStreamUrl, fluxUrl, agentUrl)

    // 3. Start audio capture immediately (WebSocket onOpen confirms readiness)
    console.log('[VoiceChat] Starting audio capture...')
    await voiceClient.value.startAudioCapture()
    console.log('[VoiceChat] Audio capture started successfully')

    // 5. Start audio level monitoring
    startAudioMonitoring()
  }
  catch (err) {
    // Check if this is a quota error
    const error = err as QuotaError
    if (error.isQuotaError) {
      quotaErrorData.value = {
        message: error.message,
        usage: error.usage,
        upgradeUrl: error.upgradeUrl || 'https://miraichat.app/pricing',
      }
      showUpgradePrompt.value = true
      clearError() // Clear generic error since we're showing upgrade prompt
    } else {
      handleApiError(err, 'start session')
    }
    isConnecting.value = false
  }
}

function handleUpgradePromptClose() {
  showUpgradePrompt.value = false
  emit('close')
}

/**
 * End voice session
 * Tracks usage and cleans up resources
 */
async function endSession() {
  // Prevent duplicate calls
  if (!voiceClient.value || !sessionKey.value || isEndingSession.value) {
    return
  }

  isEndingSession.value = true

  try {
    // Get metrics before cleanup
    const metrics = voiceClient.value.getMetrics()

    console.log('[VoiceChat] Ending session with metrics:', metrics)

    // Disconnect WebSocket
    voiceClient.value.disconnect()
    voiceClient.value = null

    // End session via API (tracks usage)
    await sessionManager.endSession(sessionKey.value, metrics)

    console.log('[VoiceChat] Session ended successfully, usage tracked')

    // Close component
    emit('close')
  }
  catch (err) {
    console.error('[VoiceChat] Error ending session:', err)
    handleApiError(err, 'end session')
    // Still close the component even if API call fails
    emit('close')
  } finally {
    isEndingSession.value = false
  }
}

/**
 * Toggle microphone mute
 */
function toggleMute() {
  if (!voiceClient.value) return

  isMuted.value = !isMuted.value
  voiceClient.value.setMuted(isMuted.value)

  // Update visual feedback immediately
  if (isMuted.value) {
    isListening.value = false
    audioLevel.value = 0
  } else {
    isListening.value = true
  }
}

/**
 * Start monitoring audio levels for visualization
 */
function startAudioMonitoring() {
  if (!voiceClient.value) return

  const monitorAudioLevel = () => {
    if (!voiceClient.value || !isConnected.value) {
      stopAudioMonitoring()
      return
    }

    // Simulate audio level (in production, get from actual audio context analyser)
    // This creates a pulsing effect when not muted
    if (!isMuted.value) {
      isListening.value = true
      audioLevel.value = 0.3 + Math.random() * 0.7 // 30-100% range
    } else {
      isListening.value = false
      audioLevel.value = 0
    }

    animationFrameId = requestAnimationFrame(monitorAudioLevel)
  }

  monitorAudioLevel()
}

/**
 * Stop monitoring audio levels
 */
function stopAudioMonitoring() {
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId)
    animationFrameId = null
  }
  isListening.value = false
  audioLevel.value = 0
}

/**
 * Cleanup on unmount
 * This now calls endSession to ensure usage is tracked
 */
async function cleanup() {
  stopAudioMonitoring()

  // End the session properly to track usage
  if (voiceClient.value && sessionKey.value && !isEndingSession.value) {
    await endSession()
  } else {
    // If endSession was already called, just clean up resources
    if (voiceClient.value) {
      voiceClient.value.disconnect()
      voiceClient.value = null
    }
    isConnected.value = false
    sessionKey.value = null
    conversationId.value = null
  }
}

/**
 * Handle browser close/refresh
 * Uses fetch with keepalive flag for reliable tracking when page unloads
 * This approach supports authentication (cookies) better than sendBeacon
 */
function handleBeforeUnload(event: BeforeUnloadEvent) {
  // Track usage if session is active
  if (sessionKey.value && voiceClient.value && !isEndingSession.value) {
    const metrics = voiceClient.value.getMetrics()

    console.log('[VoiceChat] Browser closing, tracking usage with keepalive fetch:', metrics)

    // Use fetch with keepalive flag - supports credentials and completes after page unload
    const API_BASE_URL = import.meta.env.VITE_API_URL

    // Synchronous request that will complete even if page closes
    fetch(`${API_BASE_URL}/api/voice/session/${sessionKey.value}/end`, {
      method: 'POST',
      keepalive: true,  // Critical: Allows request to complete after page unload
      credentials: 'include',  // Include authentication cookies
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(metrics),
    }).catch((err) => {
      // Log error but don't block page unload
      console.error('[VoiceChat] Failed to track usage on unload:', err)
    })
  }
}

onMounted(() => {
  // Add beforeunload handler to track usage when browser closes
  window.addEventListener('beforeunload', handleBeforeUnload)
})

onUnmounted(() => {
  // Remove beforeunload handler
  window.removeEventListener('beforeunload', handleBeforeUnload)

  // Clean up session
  cleanup()
})

// Computed
const connectionStatus = computed(() => {
  if (isConnecting.value) return 'Connecting...'
  if (isConnected.value) return 'Connected'
  return 'Disconnected'
})

// Auto-scroll chat to bottom
const messagesContainer = ref<HTMLDivElement | null>(null)

function scrollToBottom() {
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
  }
}

// Watch messages and auto-scroll
watch(messages, () => {
  // Use nextTick to ensure DOM has updated
  import('vue').then(({ nextTick }) => {
    nextTick(() => scrollToBottom())
  })
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

    <!-- Error Display (shown via toast, keeping banner for critical errors) -->
    <div v-if="errorMessage" class="error-banner">
      <p>{{ errorMessage }}</p>
      <button @click="clearError">Dismiss</button>
    </div>

    <!-- Character Display Area - Simple Status Display -->
    <div class="character-display">
      <div class="status-card">
        <div class="avatar-circle">
          <img
            :src="character.avatarThumbnail || '/default-avatar.png'"
            :alt="character.displayName"
          />
        </div>
        <div class="status-info">
          <h4>{{ character.displayName }}</h4>
          <p class="connection-status" :class="{ connected: isConnected }">
            {{ isConnected ? '🎤 Voice Active' : '🔇 Not Connected' }}
          </p>
          <p v-if="currentEmotion && isConnected" class="emotion-display">
            Emotion: {{ currentEmotion.emotion }} ({{ (currentEmotion.intensity * 100).toFixed(0) }}%)
          </p>
        </div>
      </div>
    </div>

    <!-- Chat History -->
    <div class="chat-history">
      <div v-if="messages.length === 0" class="empty-state">
        <p>{{ isConnected ? 'Start talking to begin the conversation...' : 'Connect to start chatting' }}</p>
      </div>
      <div v-else ref="messagesContainer" class="messages-container">
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
        <div class="mic-controls">
          <button @click="toggleMute" :class="['mute-btn', { muted: isMuted }]">
            {{ isMuted ? '🔇 Unmute' : '🎤 Mute' }}
          </button>

          <!-- Visual Audio Indicator -->
          <div class="audio-visualizer">
            <div class="audio-bars">
              <div
                v-for="i in 5"
                :key="i"
                class="audio-bar"
                :class="{ active: isListening }"
                :style="{
                  height: isListening ? `${audioLevel * 100 * (0.5 + i * 0.1)}%` : '10%',
                  animationDelay: `${i * 0.1}s`
                }"
              ></div>
            </div>
            <span class="status-text">{{ isMuted ? 'Muted' : 'Listening' }}</span>
          </div>
        </div>

        <button @click="endSession" class="end-btn">End Conversation</button>
      </template>
    </div>

    <!-- Upgrade Prompt Modal -->
    <UpgradePrompt
      :show="showUpgradePrompt"
      :message="quotaErrorData.message"
      :usage="quotaErrorData.usage"
      :upgradeUrl="quotaErrorData.upgradeUrl"
      @close="handleUpgradePromptClose"
      @upgrade="handleUpgradePromptClose"
    />
  </div>
</template>

<style scoped>
.voice-chat {
  display: flex;
  flex-direction: column;
  height: 100vh;
  max-height: 100vh;
  background-color: #f5f5f5;
  overflow: hidden;
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
  flex: 0 0 auto;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 1.5rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.status-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  background-color: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  padding: 1rem;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.avatar-circle {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  overflow: hidden;
  border: 3px solid white;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  flex-shrink: 0;
}

.avatar-circle img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.status-info {
  flex: 1;
  color: white;
}

.status-info h4 {
  margin: 0 0 0.5rem 0;
  font-size: 1.125rem;
  font-weight: 600;
}

.connection-status {
  font-size: 0.875rem;
  margin: 0.25rem 0;
  opacity: 0.9;
}

.connection-status.connected {
  color: #10b981;
  font-weight: 600;
}

.emotion-display {
  font-size: 0.75rem;
  margin-top: 0.5rem;
  padding: 0.25rem 0.75rem;
  background-color: rgba(255, 255, 255, 0.2);
  border-radius: 12px;
  display: inline-block;
  font-weight: 500;
}

.chat-history {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  background-color: white;
  border-top: 1px solid #e0e0e0;
  display: flex;
  flex-direction: column;
}

.empty-state {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #9ca3af;
  font-size: 0.875rem;
  padding: 2rem;
  text-align: center;
}

.messages-container {
  padding: 1rem;
  overflow-y: auto;
  flex: 1;
  display: flex;
  flex-direction: column;
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
  flex: 0 0 auto;
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

/* Microphone Controls Layout */
.mic-controls {
  display: flex;
  align-items: center;
  gap: 1rem;
}

/* Audio Visualizer */
.audio-visualizer {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.audio-bars {
  display: flex;
  align-items: flex-end;
  gap: 3px;
  height: 40px;
  padding: 0 0.5rem;
}

.audio-bar {
  width: 4px;
  background: linear-gradient(180deg, #10b981 0%, #059669 100%);
  border-radius: 2px;
  transition: height 0.1s ease;
  opacity: 0.3;
}

.audio-bar.active {
  opacity: 1;
  animation: pulse 0.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% {
    transform: scaleY(1);
  }
  50% {
    transform: scaleY(1.1);
  }
}

.status-text {
  font-size: 0.75rem;
  color: #6b7280;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
</style>
