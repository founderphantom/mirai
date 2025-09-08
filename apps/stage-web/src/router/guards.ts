import type { Router } from 'vue-router'
import { useAuth } from '@/composables/useAuth'

// Optimized route guards with better performance
export function setupRouteGuards(router: Router) {
  router.beforeEach(async (to, from, next) => {
    const { isAuthenticated, loading, initializeAuth } = useAuth()
    
    // Initialize auth if not already done
    await initializeAuth()
    
    // More efficient waiting mechanism with exponential backoff
    const maxWaitTime = 2000 // Reduced from 3000ms
    const startTime = Date.now()
    let backoff = 10
    
    while (loading.value && (Date.now() - startTime) < maxWaitTime) {
      await new Promise(resolve => setTimeout(resolve, backoff))
      backoff = Math.min(backoff * 1.5, 100) // Exponential backoff with cap
    }
    
    // Check if route requires authentication
    const requiresAuth = to.matched.some(record => record.meta.requiresAuth !== false)
    const isAuthRoute = to.path.startsWith('/auth/')
    
    // Allow callback route to always proceed
    if (to.path === '/auth/callback') {
      next()
      return
    }
    
    // If route requires auth and user is not authenticated
    if (requiresAuth && !isAuthRoute && !isAuthenticated.value) {
      // Redirect to login with return URL
      next({
        path: '/auth/login',
        query: { redirect: to.fullPath }
      })
      return
    }
    
    // If user is authenticated and trying to access auth pages (except callback)
    if (isAuthenticated.value && isAuthRoute && to.path !== '/auth/callback') {
      // Redirect to home page or the redirect query param
      const redirect = to.query.redirect as string || '/'
      next(redirect)
      return
    }
    
    // Proceed with navigation
    next()
  })
  
  // Update page title
  router.afterEach((to) => {
    const title = to.meta.title as string
    if (title) {
      document.title = title
    } else {
      document.title = 'AIRI - Your AI Companion'
    }
  })
}