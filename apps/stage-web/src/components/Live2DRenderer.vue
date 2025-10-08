<script setup lang="ts">
/**
 * Simplified Live2D Renderer for VoiceChat
 *
 * Uses existing Live2D components from @proj-airi/stage-ui
 * and syncs with emotion data from WebSocket messages.
 */
import { Live2DCanvas, Live2DModel } from '@proj-airi/stage-ui/components/scenes'
import { useLive2d } from '@proj-airi/stage-ui/stores/live2d'
import { storeToRefs } from 'pinia'
import { computed, ref, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    modelUrl?: string // URL to Live2D model (from R2 using live2dModelKey)
    emotion?: string | null // Current emotion from WebSocket
    emotionIntensity?: number // Emotion intensity (0-1)
    isListening?: boolean // Whether microphone is active
  }>(),
  {
    emotion: null,
    emotionIntensity: 0.5,
    isListening: false,
  }
)

const emit = defineEmits<{
  loaded: []
  error: [message: string]
}>()

// State
const isLoading = ref(false)
const hasError = ref(false)
const errorMessage = ref<string | null>(null)
const modelState = ref<'pending' | 'loading' | 'mounted'>('pending')

// Live2D store for motion control
const live2dStore = useLive2d()
const { currentMotion } = storeToRefs(live2dStore)

// Container size (adjust as needed)
const containerWidth = ref(800)
const containerHeight = ref(600)

/**
 * Map WebSocket emotions to Live2D motions
 */
const emotionMotionMap: Record<string, string> = {
  JOY: 'Tap@Body',
  SADNESS: 'Idle',
  ANGER: 'Idle',
  FEAR: 'Idle',
  SURPRISE: 'Tap@Body',
  NEUTRAL: 'Idle',
}

/**
 * Handle model loaded event
 */
function handleModelLoaded() {
  isLoading.value = false
  hasError.value = false
  emit('loaded')
}

/**
 * Handle model error
 */
function handleModelError(err: any) {
  console.error('Failed to load Live2D model:', err)
  isLoading.value = false
  hasError.value = true
  errorMessage.value = err instanceof Error ? err.message : 'Failed to load model'
  emit('error', errorMessage.value)
}

/**
 * Play emotion motion via store
 */
function playEmotion(emotion: string, _intensity: number) {
  const motionName = emotionMotionMap[emotion.toUpperCase()] || 'Idle'

  // Update store to trigger motion
  currentMotion.value = {
    group: motionName,
    index: 0,
  }
}

// Watch for emotion changes
watch(
  () => [props.emotion, props.emotionIntensity] as const,
  ([emotion, intensity]) => {
    if (emotion) {
      playEmotion(emotion, intensity)
    }
  }
)

// Watch for model URL changes
watch(
  () => props.modelUrl,
  (newUrl) => {
    if (newUrl) {
      isLoading.value = true
      hasError.value = false
      errorMessage.value = null
      modelState.value = 'loading'
    }
  },
  { immediate: true }
)

// Resize container based on parent
const containerStyle = computed(() => ({
  width: '100%',
  height: '100%',
  position: 'relative' as const,
}))
</script>

<template>
  <div class="live2d-renderer" :style="containerStyle">
    <!-- Live2D Canvas and Model (using existing components) -->
    <template v-if="modelUrl && !hasError">
      <Live2DCanvas
        :width="containerWidth"
        :height="containerHeight"
      >
        <Live2DModel
          v-model:state="modelState"
          :model-src="modelUrl"
          :width="containerWidth"
          :height="containerHeight"
          :paused="false"
          :scale="1"
          x-offset="0%"
          y-offset="0%"
          @model-loaded="handleModelLoaded"
          @error="handleModelError"
        />
      </Live2DCanvas>
    </template>

    <!-- Loading State -->
    <div v-if="isLoading" class="live2d-overlay">
      <div class="loading-spinner" />
      <p class="loading-text">Loading character...</p>
    </div>

    <!-- Error State -->
    <div v-if="hasError" class="live2d-overlay error">
      <div class="error-icon">⚠️</div>
      <p class="error-text">{{ errorMessage }}</p>
    </div>

    <!-- No Model State -->
    <div v-if="!modelUrl && !isLoading && !hasError" class="live2d-overlay">
      <div class="placeholder-icon">🎭</div>
      <p class="placeholder-text">No character model available</p>
    </div>

    <!-- Debug Info (optional) -->
    <div v-if="emotion" class="debug-info">
      <span>{{ emotion }}</span>
      <span class="emotion-bar" :style="{ width: `${emotionIntensity * 100}%` }" />
    </div>
  </div>
</template>

<style scoped>
.live2d-renderer {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

/* Canvas styling is handled by Live2DCanvas component */

.live2d-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background-color: rgba(0, 0, 0, 0.1);
  backdrop-filter: blur(4px);
  z-index: 10;
}

.live2d-overlay.error {
  background-color: rgba(239, 68, 68, 0.1);
}

/* Loading State */
.loading-spinner {
  width: 48px;
  height: 48px;
  border: 4px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.loading-text {
  margin-top: 1rem;
  color: white;
  font-size: 0.875rem;
  font-weight: 500;
}

/* Error State */
.error-icon {
  font-size: 3rem;
  margin-bottom: 0.5rem;
}

.error-text {
  color: white;
  font-size: 0.875rem;
  margin-bottom: 1rem;
  text-align: center;
  max-width: 80%;
}

.retry-btn {
  padding: 0.5rem 1rem;
  background-color: white;
  color: #1f2937;
  border: none;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.2s;
}

.retry-btn:hover {
  background-color: #f3f4f6;
}

/* Placeholder State */
.placeholder-icon {
  font-size: 4rem;
  margin-bottom: 1rem;
  opacity: 0.7;
}

.placeholder-text {
  color: white;
  font-size: 1rem;
  opacity: 0.8;
}

/* Debug Info */
.debug-info {
  position: absolute;
  bottom: 1rem;
  left: 1rem;
  right: 1rem;
  background-color: rgba(0, 0, 0, 0.6);
  padding: 0.5rem;
  border-radius: 6px;
  color: white;
  font-size: 0.75rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.emotion-bar {
  height: 4px;
  background: linear-gradient(90deg, #10b981 0%, #059669 100%);
  border-radius: 2px;
  transition: width 0.3s ease;
}
</style>
