/**
 * Device optimization composable for adaptive performance
 * Detects device capabilities and network conditions to optimize feature loading
 */

import { computed, onMounted, onUnmounted, ref, watchEffect } from 'vue'
import { useMediaQuery, useNetwork, usePreferredReducedMotion } from '@vueuse/core'

export interface DeviceCapabilities {
  isMobile: boolean
  isTablet: boolean
  isDesktop: boolean
  isLowEndDevice: boolean
  hasGoodNetwork: boolean
  hasWebGL: boolean
  hasWebGPU: boolean
  deviceMemory: number
  hardwareConcurrency: number
  connectionType: string
  saveData: boolean
  reducedMotion: boolean
}

export interface OptimizationFeatures {
  shouldLoad3D: boolean
  shouldLoadML: boolean
  shouldLoadHeavyAnimations: boolean
  shouldPreloadAssets: boolean
  shouldUseWebWorkers: boolean
  maxImageQuality: 'low' | 'medium' | 'high'
  chunkLoadingStrategy: 'eager' | 'lazy' | 'idle'
}

/**
 * Priority levels for deferred operations
 */
export type DeferPriority = 'high' | 'medium' | 'low'

/**
 * Device optimization composable
 */
export function useDeviceOptimization() {
  // Device detection
  const isMobile = useMediaQuery('(max-width: 768px)')
  const isTablet = useMediaQuery('(min-width: 769px) and (max-width: 1024px)')
  const isDesktop = useMediaQuery('(min-width: 1025px)')
  
  // Network detection
  const network = useNetwork()
  const reducedMotion = usePreferredReducedMotion()
  
  // Device capabilities
  const capabilities = ref<DeviceCapabilities>({
    isMobile: false,
    isTablet: false,
    isDesktop: false,
    isLowEndDevice: false,
    hasGoodNetwork: true,
    hasWebGL: false,
    hasWebGPU: false,
    deviceMemory: 4,
    hardwareConcurrency: 4,
    connectionType: 'unknown',
    saveData: false,
    reducedMotion: false,
  })
  
  // Deferred operations queue
  const deferredQueue = new Map<DeferPriority, Set<() => void>>()
  const rafHandle = ref<number | null>(null)
  const idleHandle = ref<number | null>(null)
  
  /**
   * Detect device capabilities
   */
  const detectCapabilities = () => {
    const nav = navigator as any
    
    // Device type
    capabilities.value.isMobile = isMobile.value
    capabilities.value.isTablet = isTablet.value
    capabilities.value.isDesktop = isDesktop.value
    
    // Hardware capabilities
    capabilities.value.deviceMemory = nav.deviceMemory || 4
    capabilities.value.hardwareConcurrency = nav.hardwareConcurrency || 4
    
    // Network conditions
    const connection = nav.connection || nav.mozConnection || nav.webkitConnection
    if (connection) {
      capabilities.value.connectionType = connection.effectiveType || 'unknown'
      capabilities.value.saveData = connection.saveData || false
      
      // Determine if network is good (4g or better)
      capabilities.value.hasGoodNetwork = 
        ['4g', '5g'].includes(connection.effectiveType) &&
        !connection.saveData
    } else {
      // Fallback to network composable
      capabilities.value.hasGoodNetwork = 
        network.isOnline.value && 
        (network.downlink.value === undefined || network.downlink.value > 1.5)
    }
    
    // WebGL/WebGPU support
    try {
      const canvas = document.createElement('canvas')
      capabilities.value.hasWebGL = !!(
        canvas.getContext('webgl') || 
        canvas.getContext('experimental-webgl')
      )
      capabilities.value.hasWebGPU = 'gpu' in navigator
    } catch {
      capabilities.value.hasWebGL = false
      capabilities.value.hasWebGPU = false
    }
    
    // Reduced motion preference
    capabilities.value.reducedMotion = reducedMotion.value === 'reduce'
    
    // Determine if device is low-end
    capabilities.value.isLowEndDevice = 
      capabilities.value.deviceMemory <= 2 ||
      capabilities.value.hardwareConcurrency <= 2 ||
      (capabilities.value.isMobile && !capabilities.value.hasGoodNetwork) ||
      capabilities.value.saveData
  }
  
  /**
   * Get optimization features based on capabilities
   */
  const features = computed<OptimizationFeatures>(() => {
    const cap = capabilities.value
    
    return {
      // 3D features only on capable devices
      shouldLoad3D: 
        !cap.isLowEndDevice && 
        cap.hasWebGL && 
        (cap.isDesktop || (cap.isTablet && cap.hasGoodNetwork)),
      
      // ML features require good hardware
      shouldLoadML: 
        !cap.isLowEndDevice &&
        cap.deviceMemory >= 4 &&
        cap.hardwareConcurrency >= 4 &&
        cap.hasGoodNetwork,
      
      // Heavy animations
      shouldLoadHeavyAnimations: 
        !cap.isLowEndDevice && 
        !cap.reducedMotion &&
        (cap.isDesktop || cap.hasGoodNetwork),
      
      // Asset preloading
      shouldPreloadAssets: 
        cap.hasGoodNetwork && 
        !cap.saveData &&
        cap.deviceMemory >= 4,
      
      // Web Workers
      shouldUseWebWorkers: 
        cap.hardwareConcurrency >= 4,
      
      // Image quality
      maxImageQuality: cap.isLowEndDevice || cap.saveData
        ? 'low'
        : cap.isMobile || !cap.hasGoodNetwork
        ? 'medium'
        : 'high',
      
      // Chunk loading strategy
      chunkLoadingStrategy: cap.isLowEndDevice || !cap.hasGoodNetwork
        ? 'lazy'
        : cap.isDesktop && cap.hasGoodNetwork
        ? 'eager'
        : 'idle',
    }
  })
  
  /**
   * Defer operation execution based on priority
   */
  const defer = (operation: () => void, priority: DeferPriority = 'medium') => {
    if (!deferredQueue.has(priority)) {
      deferredQueue.set(priority, new Set())
    }
    
    deferredQueue.get(priority)!.add(operation)
    
    // Schedule execution based on priority
    switch (priority) {
      case 'high':
        // Execute in next frame
        if (!rafHandle.value) {
          rafHandle.value = requestAnimationFrame(() => {
            executeDeferredOperations('high')
            rafHandle.value = null
          })
        }
        break
        
      case 'medium':
        // Execute when idle
        if ('requestIdleCallback' in window) {
          if (!idleHandle.value) {
            idleHandle.value = (window as any).requestIdleCallback(
              () => {
                executeDeferredOperations('medium')
                idleHandle.value = null
              },
              { timeout: 2000 }
            )
          }
        } else {
          // Fallback to setTimeout
          setTimeout(() => executeDeferredOperations('medium'), 100)
        }
        break
        
      case 'low':
        // Execute when truly idle or after delay
        if ('requestIdleCallback' in window) {
          (window as any).requestIdleCallback(
            () => executeDeferredOperations('low'),
            { timeout: 5000 }
          )
        } else {
          setTimeout(() => executeDeferredOperations('low'), 1000)
        }
        break
    }
  }
  
  /**
   * Execute deferred operations for a priority level
   */
  const executeDeferredOperations = (priority: DeferPriority) => {
    const operations = deferredQueue.get(priority)
    if (operations && operations.size > 0) {
      operations.forEach(op => {
        try {
          op()
        } catch (error) {
          console.error(`Error executing deferred operation:`, error)
        }
      })
      operations.clear()
    }
  }
  
  /**
   * Load a heavy module conditionally
   */
  const conditionalImport = async <T>(
    importFn: () => Promise<T>,
    condition: boolean,
    fallback?: T
  ): Promise<T | undefined> => {
    if (condition) {
      try {
        return await importFn()
      } catch (error) {
        console.error('Failed to load module:', error)
        return fallback
      }
    }
    return fallback
  }
  
  /**
   * Get responsive image source based on device
   */
  const getResponsiveImageSrc = (
    baseSrc: string,
    sizes: { low: string; medium: string; high: string }
  ): string => {
    const quality = features.value.maxImageQuality
    return sizes[quality] || baseSrc
  }
  
  /**
   * Check if a feature should be loaded
   */
  const shouldLoadFeature = (feature: keyof OptimizationFeatures): boolean => {
    return features.value[feature] as boolean
  }
  
  /**
   * Create an intersection observer for lazy loading
   */
  const createLazyLoader = (
    callback: (entry: IntersectionObserverEntry) => void,
    options?: IntersectionObserverInit
  ): IntersectionObserver => {
    const defaultOptions: IntersectionObserverInit = {
      rootMargin: capabilities.value.isMobile ? '50px' : '200px',
      threshold: 0.01,
      ...options,
    }
    
    return new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          callback(entry)
        }
      })
    }, defaultOptions)
  }
  
  /**
   * Prefetch a resource if conditions are met
   */
  const prefetch = (url: string, as?: 'script' | 'style' | 'image' | 'font') => {
    if (features.value.shouldPreloadAssets) {
      const link = document.createElement('link')
      link.rel = 'prefetch'
      link.href = url
      if (as) link.as = as
      document.head.appendChild(link)
    }
  }
  
  /**
   * Preload a critical resource
   */
  const preload = (url: string, as: 'script' | 'style' | 'image' | 'font') => {
    const link = document.createElement('link')
    link.rel = 'preload'
    link.href = url
    link.as = as
    document.head.appendChild(link)
  }
  
  // Initialize and update capabilities
  onMounted(() => {
    detectCapabilities()
    
    // Listen for network changes
    const connection = (navigator as any).connection
    if (connection) {
      const handleConnectionChange = () => detectCapabilities()
      connection.addEventListener('change', handleConnectionChange)
      
      onUnmounted(() => {
        connection.removeEventListener('change', handleConnectionChange)
      })
    }
  })
  
  // Update when screen size changes
  watchEffect(() => {
    capabilities.value.isMobile = isMobile.value
    capabilities.value.isTablet = isTablet.value
    capabilities.value.isDesktop = isDesktop.value
  })
  
  // Cleanup
  onUnmounted(() => {
    if (rafHandle.value) {
      cancelAnimationFrame(rafHandle.value)
    }
    if (idleHandle.value && 'cancelIdleCallback' in window) {
      (window as any).cancelIdleCallback(idleHandle.value)
    }
    deferredQueue.clear()
  })
  
  return {
    // State
    capabilities: computed(() => capabilities.value),
    features: computed(() => features.value),
    
    // Device type shortcuts
    isMobile,
    isTablet,
    isDesktop,
    isLowEnd: computed(() => capabilities.value.isLowEndDevice),
    
    // Feature flags shortcuts
    shouldLoad3D: computed(() => features.value.shouldLoad3D),
    shouldLoadML: computed(() => features.value.shouldLoadML),
    shouldLoadHeavyAnimations: computed(() => features.value.shouldLoadHeavyAnimations),
    
    // Methods
    defer,
    conditionalImport,
    getResponsiveImageSrc,
    shouldLoadFeature,
    createLazyLoader,
    prefetch,
    preload,
    detectCapabilities,
  }
}

/**
 * Global device optimization instance
 */
let globalInstance: ReturnType<typeof useDeviceOptimization> | null = null

/**
 * Get or create global device optimization instance
 */
export function getDeviceOptimization() {
  if (!globalInstance) {
    globalInstance = useDeviceOptimization()
  }
  return globalInstance
}