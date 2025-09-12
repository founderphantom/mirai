/**
 * Image optimization composable for performance
 * Handles lazy loading, responsive images, and format optimization
 */

import { onMounted, onUnmounted, ref, Ref } from 'vue'
import { useIntersectionObserver } from '@vueuse/core'
import { useDeviceOptimization } from './useDeviceOptimization'

export interface ImageOptimizationOptions {
  loading?: 'lazy' | 'eager'
  sizes?: string
  srcset?: string | string[]
  placeholder?: string
  aspectRatio?: number
  objectFit?: 'contain' | 'cover' | 'fill' | 'none' | 'scale-down'
  fadeIn?: boolean
  observerOptions?: IntersectionObserverInit
}

export interface OptimizedImage {
  src: Ref<string>
  srcset: Ref<string>
  sizes: Ref<string>
  isLoaded: Ref<boolean>
  isInView: Ref<boolean>
  error: Ref<Error | null>
  retry: () => void
}

/**
 * Generate srcset string from multiple sources
 */
function generateSrcset(sources: string[] | string): string {
  if (typeof sources === 'string') return sources
  
  return sources
    .map((src, index) => {
      const width = [320, 640, 960, 1280, 1920][index] || (index + 1) * 320
      return `${src} ${width}w`
    })
    .join(', ')
}

/**
 * Generate sizes attribute based on device
 */
function generateSizes(customSizes?: string): string {
  if (customSizes) return customSizes
  
  return `
    (max-width: 320px) 280px,
    (max-width: 640px) 600px,
    (max-width: 960px) 920px,
    (max-width: 1280px) 1200px,
    100vw
  `.trim()
}

/**
 * Get optimized image format
 */
function getOptimizedFormat(originalSrc: string): string {
  // Check for WebP support
  const supportsWebP = document.createElement('canvas').toDataURL('image/webp').indexOf('data:image/webp') === 0
  
  if (supportsWebP && !originalSrc.includes('.webp')) {
    // Try to use WebP version if available
    const webpSrc = originalSrc.replace(/\.(jpg|jpeg|png)$/i, '.webp')
    return webpSrc
  }
  
  return originalSrc
}

/**
 * Image optimization composable
 */
export function useImageOptimization(
  imageSrc: string | Ref<string>,
  options: ImageOptimizationOptions = {}
) {
  const {
    loading = 'lazy',
    sizes,
    srcset,
    placeholder = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"%3E%3Crect width="1" height="1" fill="%23f0f0f0"/%3E%3C/svg%3E',
    aspectRatio,
    objectFit = 'cover',
    fadeIn = true,
    observerOptions = {
      rootMargin: '50px',
      threshold: 0.01,
    },
  } = options
  
  const device = useDeviceOptimization()
  
  // Reactive state
  const src = ref(placeholder)
  const optimizedSrcset = ref('')
  const optimizedSizes = ref(generateSizes(sizes))
  const isLoaded = ref(false)
  const isInView = ref(false)
  const error = ref<Error | null>(null)
  const imageEl = ref<HTMLImageElement | null>(null)
  
  // Get the actual image source
  const actualSrc = typeof imageSrc === 'string' ? imageSrc : imageSrc.value
  
  /**
   * Load the image
   */
  const loadImage = () => {
    if (isLoaded.value) return
    
    const img = new Image()
    
    // Set up event handlers
    img.onload = () => {
      src.value = img.src
      isLoaded.value = true
      error.value = null
      
      // Apply fade-in effect
      if (fadeIn && imageEl.value) {
        imageEl.value.style.opacity = '0'
        imageEl.value.style.transition = 'opacity 0.3s ease-in-out'
        requestAnimationFrame(() => {
          if (imageEl.value) {
            imageEl.value.style.opacity = '1'
          }
        })
      }
    }
    
    img.onerror = (e) => {
      error.value = new Error(`Failed to load image: ${actualSrc}`)
      console.error('Image load error:', e)
      
      // Fallback to original source if optimization failed
      if (img.src !== actualSrc) {
        img.src = actualSrc
      }
    }
    
    // Optimize based on device capabilities
    const quality = device.features.value.maxImageQuality
    
    // Set srcset if provided
    if (srcset) {
      optimizedSrcset.value = generateSrcset(srcset)
      img.srcset = optimizedSrcset.value
    }
    
    // Set sizes
    img.sizes = optimizedSizes.value
    
    // Load optimized format if possible
    const optimizedSrc = quality === 'high' 
      ? getOptimizedFormat(actualSrc)
      : actualSrc
    
    img.src = optimizedSrc
  }
  
  /**
   * Retry loading the image
   */
  const retry = () => {
    error.value = null
    isLoaded.value = false
    loadImage()
  }
  
  /**
   * Set up intersection observer for lazy loading
   */
  if (loading === 'lazy') {
    const { stop } = useIntersectionObserver(
      imageEl,
      ([{ isIntersecting }]) => {
        if (isIntersecting) {
          isInView.value = true
          loadImage()
          stop() // Stop observing once loaded
        }
      },
      observerOptions
    )
    
    onUnmounted(() => {
      stop()
    })
  } else {
    // Eager loading
    onMounted(() => {
      loadImage()
    })
  }
  
  return {
    src,
    srcset: optimizedSrcset,
    sizes: optimizedSizes,
    isLoaded,
    isInView,
    error,
    retry,
    imageEl,
    aspectRatio,
    objectFit,
  }
}

/**
 * Vue directive for image lazy loading
 */
export const vLazyImage = {
  mounted(el: HTMLImageElement, binding: { value: string | ImageOptimizationOptions }) {
    const options = typeof binding.value === 'string' 
      ? { src: binding.value }
      : binding.value
    
    const src = options.src || el.dataset.src || el.src
    
    if (!src) return
    
    // Store original src
    el.dataset.src = src
    
    // Set placeholder
    el.src = options.placeholder || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"%3E%3Crect width="1" height="1" fill="%23f0f0f0"/%3E%3C/svg%3E'
    
    // Create intersection observer
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const img = entry.target as HTMLImageElement
            const actualSrc = img.dataset.src
            
            if (actualSrc) {
              // Load the image
              const tempImg = new Image()
              
              tempImg.onload = () => {
                img.src = actualSrc
                img.classList.add('lazy-loaded')
                
                // Fade in effect
                if (options.fadeIn !== false) {
                  img.style.opacity = '0'
                  img.style.transition = 'opacity 0.3s ease-in-out'
                  requestAnimationFrame(() => {
                    img.style.opacity = '1'
                  })
                }
              }
              
              tempImg.src = actualSrc
              
              // Clean up
              observer.unobserve(img)
            }
          }
        })
      },
      {
        rootMargin: options.rootMargin || '50px',
        threshold: options.threshold || 0.01,
      }
    )
    
    observer.observe(el)
    
    // Store observer for cleanup
    ;(el as any)._lazyImageObserver = observer
  },
  
  unmounted(el: HTMLImageElement) {
    const observer = (el as any)._lazyImageObserver
    if (observer) {
      observer.disconnect()
      delete (el as any)._lazyImageObserver
    }
  },
}

/**
 * Preload critical images
 */
export function preloadImages(urls: string[]): Promise<void[]> {
  return Promise.all(
    urls.map(
      (url) =>
        new Promise<void>((resolve, reject) => {
          const img = new Image()
          img.onload = () => resolve()
          img.onerror = () => reject(new Error(`Failed to preload: ${url}`))
          img.src = url
        })
    )
  )
}

/**
 * Generate responsive image props
 */
export function getResponsiveImageProps(
  baseSrc: string,
  options: {
    widths?: number[]
    formats?: string[]
    quality?: number
  } = {}
): {
  src: string
  srcset: string
  sizes: string
  loading: 'lazy' | 'eager'
} {
  const { widths = [320, 640, 960, 1280, 1920], formats = ['webp', 'jpg'], quality = 85 } = options
  
  // Generate srcset
  const srcsetEntries: string[] = []
  
  widths.forEach((width) => {
    formats.forEach((format) => {
      const url = baseSrc
        .replace('{width}', width.toString())
        .replace('{format}', format)
        .replace('{quality}', quality.toString())
      
      srcsetEntries.push(`${url} ${width}w`)
    })
  })
  
  return {
    src: baseSrc.replace('{width}', '960').replace('{format}', 'jpg').replace('{quality}', '85'),
    srcset: srcsetEntries.join(', '),
    sizes: generateSizes(),
    loading: 'lazy',
  }
}