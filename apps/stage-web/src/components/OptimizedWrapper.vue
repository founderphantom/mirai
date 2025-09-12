<template>
  <div class="optimized-wrapper" :class="wrapperClasses">
    <!-- Loading state -->
    <div v-if="isLoading" class="loading-container">
      <slot name="loading">
        <div class="default-loader">
          <div class="spinner" />
          <p v-if="loadingText" class="loading-text">{{ loadingText }}</p>
        </div>
      </slot>
    </div>
    
    <!-- Error state -->
    <div v-else-if="error" class="error-container">
      <slot name="error" :error="error" :retry="retry">
        <div class="default-error">
          <p class="error-message">{{ errorMessage || error.message }}</p>
          <button @click="retry" class="retry-button">
            Retry
          </button>
        </div>
      </slot>
    </div>
    
    <!-- Fallback for unsupported devices -->
    <div v-else-if="!isSupported" class="fallback-container">
      <slot name="fallback">
        <div class="default-fallback">
          <p class="fallback-message">
            {{ fallbackMessage || 'This feature is not available on your device' }}
          </p>
        </div>
      </slot>
    </div>
    
    <!-- Main content -->
    <div v-else ref="contentRef" class="content-container" :style="contentStyles">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useIntersectionObserver } from '@vueuse/core'
import { useDeviceOptimization } from '@/composables/useDeviceOptimization'
import { getPerformanceMonitor } from '@/utils/performance'

interface Props {
  // Component loading
  component?: () => Promise<any>
  componentName?: string
  
  // Loading behavior
  eager?: boolean
  threshold?: number
  rootMargin?: string
  
  // Device requirements
  require3D?: boolean
  requireML?: boolean
  requireHighPerformance?: boolean
  minMemory?: number
  minCores?: number
  
  // UI options
  loadingText?: string
  errorMessage?: string
  fallbackMessage?: string
  
  // Performance
  measurePerformance?: boolean
  maxLoadTime?: number
  
  // Styling
  minHeight?: string
  aspectRatio?: string
}

const props = withDefaults(defineProps<Props>(), {
  eager: false,
  threshold: 0.1,
  rootMargin: '100px',
  require3D: false,
  requireML: false,
  requireHighPerformance: false,
  minMemory: 2,
  minCores: 2,
  measurePerformance: true,
  maxLoadTime: 10000,
})

const emit = defineEmits<{
  loaded: [component: any]
  error: [error: Error]
  retry: []
  unsupported: []
}>()

// State
const isLoading = ref(false)
const error = ref<Error | null>(null)
const componentInstance = ref<any>(null)
const contentRef = ref<HTMLElement>()
const hasIntersected = ref(false)

// Device optimization
const device = useDeviceOptimization()
const monitor = getPerformanceMonitor()

// Check if device supports requirements
const isSupported = computed(() => {
  const cap = device.capabilities.value
  const feat = device.features.value
  
  if (props.require3D && !feat.shouldLoad3D) return false
  if (props.requireML && !feat.shouldLoadML) return false
  if (props.requireHighPerformance && cap.isLowEndDevice) return false
  if (cap.deviceMemory < props.minMemory) return false
  if (cap.hardwareConcurrency < props.minCores) return false
  
  return true
})

// Wrapper classes
const wrapperClasses = computed(() => ({
  'is-loading': isLoading.value,
  'has-error': !!error.value,
  'not-supported': !isSupported.value,
  'is-mobile': device.isMobile.value,
  'is-low-end': device.isLowEnd.value,
}))

// Content styles
const contentStyles = computed(() => {
  const styles: Record<string, string> = {}
  
  if (props.minHeight) {
    styles.minHeight = props.minHeight
  }
  
  if (props.aspectRatio) {
    styles.aspectRatio = props.aspectRatio
  }
  
  return styles
})

/**
 * Load the component
 */
async function loadComponent() {
  if (!props.component || isLoading.value || componentInstance.value) return
  
  isLoading.value = true
  error.value = null
  
  const loadStart = performance.now()
  const measureName = `load-${props.componentName || 'component'}`
  
  if (props.measurePerformance) {
    monitor.mark(`${measureName}-start`)
  }
  
  try {
    // Set a timeout for loading
    const timeoutId = setTimeout(() => {
      if (isLoading.value) {
        throw new Error(`Component loading timeout (${props.maxLoadTime}ms)`)
      }
    }, props.maxLoadTime)
    
    // Load the component
    const module = await props.component()
    clearTimeout(timeoutId)
    
    componentInstance.value = module.default || module
    
    const loadTime = performance.now() - loadStart
    
    if (props.measurePerformance) {
      monitor.mark(`${measureName}-end`)
      monitor.measure(measureName, `${measureName}-start`, `${measureName}-end`)
      monitor.track(`component-load-${props.componentName}`, loadTime)
    }
    
    emit('loaded', componentInstance.value)
  } catch (err) {
    error.value = err as Error
    console.error('Failed to load component:', err)
    emit('error', err as Error)
  } finally {
    isLoading.value = false
  }
}

/**
 * Retry loading
 */
function retry() {
  error.value = null
  componentInstance.value = null
  emit('retry')
  loadComponent()
}

// Set up intersection observer for lazy loading
if (!props.eager && props.component) {
  const { stop } = useIntersectionObserver(
    contentRef,
    ([{ isIntersecting }]) => {
      if (isIntersecting && !hasIntersected.value) {
        hasIntersected.value = true
        
        // Defer loading based on device
        if (device.isLowEnd.value) {
          device.defer(() => loadComponent(), 'low')
        } else if (device.isMobile.value) {
          device.defer(() => loadComponent(), 'medium')
        } else {
          loadComponent()
        }
        
        stop()
      }
    },
    {
      threshold: props.threshold,
      rootMargin: props.rootMargin,
    }
  )
  
  onUnmounted(() => {
    stop()
  })
}

// Watch for device capability changes
watch(isSupported, (supported) => {
  if (!supported) {
    emit('unsupported')
  }
})

// Eager loading
onMounted(() => {
  if (props.eager && props.component && isSupported.value) {
    loadComponent()
  }
})
</script>

<style scoped>
.optimized-wrapper {
  position: relative;
  width: 100%;
  contain: layout style paint;
}

/* Loading state */
.loading-container {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 200px;
  padding: 2rem;
}

.default-loader {
  text-align: center;
}

.spinner {
  width: 40px;
  height: 40px;
  margin: 0 auto;
  border: 3px solid rgba(0, 0, 0, 0.1);
  border-top-color: currentColor;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.loading-text {
  margin-top: 1rem;
  color: var(--text-secondary, #666);
  font-size: 0.875rem;
}

/* Error state */
.error-container {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 200px;
  padding: 2rem;
}

.default-error {
  text-align: center;
  max-width: 400px;
}

.error-message {
  color: var(--error-color, #dc2626);
  margin-bottom: 1rem;
}

.retry-button {
  padding: 0.5rem 1rem;
  background: var(--primary-color, #3b82f6);
  color: white;
  border: none;
  border-radius: 0.375rem;
  cursor: pointer;
  font-size: 0.875rem;
  transition: opacity 0.2s;
}

.retry-button:hover {
  opacity: 0.9;
}

/* Fallback state */
.fallback-container {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 200px;
  padding: 2rem;
}

.default-fallback {
  text-align: center;
  max-width: 400px;
}

.fallback-message {
  color: var(--text-secondary, #666);
}

/* Content container */
.content-container {
  width: 100%;
  will-change: contents;
}

/* Mobile optimizations */
.is-mobile .content-container {
  /* Use GPU acceleration sparingly on mobile */
  transform: translateZ(0);
}

.is-low-end .spinner {
  /* Simpler animation for low-end devices */
  animation: none;
  opacity: 0.7;
}

/* Reduce motion preference */
@media (prefers-reduced-motion: reduce) {
  .spinner {
    animation: none;
    opacity: 0.7;
  }
  
  .retry-button {
    transition: none;
  }
}
</style>