<script setup lang="ts">
import { ref, onUnmounted, computed, watch } from 'vue'
import { VoiceSessionManager } from '@/services/voice/VoiceSessionManager'
import { VoiceStreamClient } from '@/services/voice/VoiceStreamClient'
import type { Character } from '@/services/api/characters'
import { useErrorHandler } from '@/composables/useErrorHandler'

const props = defineProps<{
  character: Character
}>()

const emit = defineEmits<{
  close: []
  emotion: [emotion: string, intensity: number]
}>()

// State
const sessionManager = new VoiceSessionManager()
const voiceClient = ref<VoiceStreamClient | null>(null)
const isConnected = ref(false)
const isConnecting = ref(false)
const isMuted = ref(false)
const sessionKey = ref<string | null>(null)
const conversationId = ref<string | null>(null)

// Calibration state
const isCalibrating = ref(false)
const calibrationProgress = ref(0)
const calibrationMessage = ref('')

// Error handling with composable
const { handleWebSocketError, handleApiError, errorMessage, clearError } = useErrorHandler()

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

    // 2. Connect to WebSocket
    voiceClient.value = new VoiceStreamClient({
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
      },
      onCalibrationStart: () => {
        console.log('[VoiceChat] VAD calibration started')
        isCalibrating.value = true
        calibrationProgress.value = 0
        calibrationMessage.value = 'Adjusting microphone...'
      },
      onCalibrationProgress: (progress: number, message: string) => {
        console.log('[VoiceChat] VAD calibration progress:', progress, message)
        calibrationProgress.value = progress
        calibrationMessage.value = message
      },
      onCalibrationComplete: (result: any) => {
        console.log('[VoiceChat] VAD calibration complete:', result)
        isCalibrating.value = false
        calibrationProgress.value = 100
        calibrationMessage.value = 'Microphone calibrated successfully'

        // Clear calibration message after 2 seconds
        setTimeout(() => {
          calibrationMessage.value = ''
        }, 2000)
      }
    })

    await voiceClient.value.connect(session.websocketUrl)

    // 3. Wait for WebSocket to be fully established
    console.log('[VoiceChat] WebSocket connected, waiting 500ms before starting audio...')
    await new Promise(resolve => setTimeout(resolve, 500))

    // 4. Start audio capture
    console.log('[VoiceChat] Starting audio capture...')
    await voiceClient.value.startAudioCapture()
    console.log('[VoiceChat] Audio capture started successfully')

    // 5. Start audio level monitoring
    startAudioMonitoring()
  }
  catch (err) {
    handleApiError(err, 'start session')
    isConnecting.value = false
  }
}

/**
 * End voice session
 */
async function endSession() {
  if (!voiceClient.value || !sessionKey.value)
    return

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
  }
  catch (err) {
    handleApiError(err, 'end session')
    // Still close the component even if API call fails
    emit('close')
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
 */
function cleanup() {
  stopAudioMonitoring()
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

    <!-- Calibration Overlay -->
    <div v-if="isCalibrating" class="calibration-overlay">
      <div class="calibration-card">
        <div class="calibration-icon">🎤</div>
        <h3>{{ calibrationMessage }}</h3>
        <div class="calibration-progress-bar">
          <div
            class="calibration-progress-fill"
            :style="{ width: `${calibrationProgress}%` }"
          ></div>
        </div>
        <p class="calibration-hint">Please speak naturally or stay quiet for a few seconds...</p>
      </div>
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
  position: relative; /* Required for calibration overlay positioning */
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

/* Calibration Overlay */
.calibration-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: fadeIn 0.3s ease-in-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.calibration-card {
  background-color: white;
  border-radius: 16px;
  padding: 2rem;
  max-width: 400px;
  width: 90%;
  text-align: center;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  animation: slideUp 0.3s ease-out;
}

@keyframes slideUp {
  from {
    transform: translateY(20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.calibration-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
  animation: pulse-icon 1.5s ease-in-out infinite;
}

@keyframes pulse-icon {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.1);
  }
}

.calibration-card h3 {
  margin: 0 0 1.5rem 0;
  color: #1a202c;
  font-size: 1.25rem;
  font-weight: 600;
}

.calibration-progress-bar {
  width: 100%;
  height: 8px;
  background-color: #e5e7eb;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 1rem;
}

.calibration-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #10b981 0%, #059669 100%);
  border-radius: 4px;
  transition: width 0.3s ease;
  animation: shimmer 1.5s ease-in-out infinite;
}

@keyframes shimmer {
  0% {
    background-position: -100% 0;
  }
  100% {
    background-position: 200% 0;
  }
}

.calibration-hint {
  margin: 0;
  color: #6b7280;
  font-size: 0.875rem;
  line-height: 1.5;
}
</style>
