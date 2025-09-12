import type { Plugin } from 'vue'
import type { Router } from 'vue-router'

import NProgress from 'nprogress'
import { createPinia } from 'pinia'
import { setupLayouts } from 'virtual:generated-layouts'
import { createApp } from 'vue'
import { createRouter, createWebHashHistory, createWebHistory } from 'vue-router'
import { routes } from 'vue-router/auto-routes'

import App from './App.vue'
import { i18n } from './modules/i18n'
import { setupRouteGuards } from './router/guards'
import { getPerformanceMonitor } from './utils/performance'

// Critical styles only
import '@unocss/reset/tailwind.css'
import './styles/main.css'
import 'uno.css'

const pinia = createPinia()
const routeRecords = setupLayouts(routes)

let router: Router
if (import.meta.env.VITE_APP_TARGET_HUGGINGFACE_SPACE)
  router = createRouter({ routes: routeRecords, history: createWebHashHistory() })
else
  router = createRouter({ routes: routeRecords, history: createWebHistory() })

// Setup authentication route guards
setupRouteGuards(router)

// NProgress for route transitions
router.beforeEach((to, from) => {
  if (to.path !== from.path)
    NProgress.start()
})

router.afterEach(() => {
  NProgress.done()
})

router.isReady()
  .then(async () => {
    if (import.meta.env.SSR) {
      return
    }
    if (import.meta.env.VITE_APP_TARGET_HUGGINGFACE_SPACE) {
      return
    }

    const { registerSW } = await import('./modules/pwa')
    registerSW({ immediate: true })
  })
  .catch(() => {})

// Initialize performance monitoring
const monitor = getPerformanceMonitor()
monitor.mark('app-init-start')

// Create and mount app with critical plugins only
const app = createApp(App)
  .use(router)
  .use(pinia)
  .use(i18n)

// Mount immediately for faster initial render
app.mount('#app')

monitor.mark('app-mounted')
monitor.measure('app-mount-time', 'app-init-start', 'app-mounted')

// Defer loading of non-critical plugins and assets
if ('requestIdleCallback' in window) {
  requestIdleCallback(() => loadDeferredAssets(), { timeout: 2000 })
} else {
  setTimeout(() => loadDeferredAssets(), 100)
}

/**
 * Load deferred assets and plugins after initial render
 */
async function loadDeferredAssets() {
  monitor.mark('deferred-load-start')
  
  try {
    // Load fonts after initial render
    await Promise.all([
      import('@proj-airi/font-cjkfonts-allseto/index.css'),
      import('@proj-airi/font-xiaolai/index.css'),
    ])
    
    // Load animation plugins for devices that can handle them
    const isMobile = window.matchMedia('(max-width: 768px)').matches
    const isLowEnd = navigator.hardwareConcurrency <= 2 || (navigator as any).deviceMemory <= 2
    
    if (!isMobile && !isLowEnd) {
      // Load animation plugins only for capable devices
      const [{ MotionPlugin }, { autoAnimatePlugin }] = await Promise.all([
        import('@vueuse/motion'),
        import('@formkit/auto-animate/vue'),
      ])
      
      app.use(MotionPlugin)
      app.use(autoAnimatePlugin as unknown as Plugin)
    }
    
    // Load 3D libraries only if needed and device is capable
    const needs3D = router.currentRoute.value.path.includes('stage') || 
                   router.currentRoute.value.path.includes('3d')
    
    if (needs3D && !isMobile && !isLowEnd) {
      const { default: Tres } = await import('@tresjs/core')
      app.use(Tres)
    }
    
    monitor.mark('deferred-load-end')
    monitor.measure('deferred-load-time', 'deferred-load-start', 'deferred-load-end')
    
    // Log performance summary in development
    if (!import.meta.env.PROD) {
      monitor.logSummary()
    }
  } catch (error) {
    console.error('Failed to load deferred assets:', error)
  }
}

// Progressive 3D loading on route change
router.beforeResolve(async (to) => {
  const needs3D = to.path.includes('stage') || to.path.includes('3d')
  
  if (needs3D && !(app as any)._context?.provides?.TresContext) {
    // Check device capability before loading
    const isMobile = window.matchMedia('(max-width: 768px)').matches
    const isLowEnd = navigator.hardwareConcurrency <= 2
    
    if (!isMobile && !isLowEnd) {
      try {
        const { default: Tres } = await import('@tresjs/core')
        app.use(Tres)
      } catch (error) {
        console.warn('Failed to load 3D libraries:', error)
      }
    }
  }
})
