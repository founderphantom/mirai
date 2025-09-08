import type { Router } from 'vue-router'
import { useAuth } from '@/composables/useAuth'

export function setupRouteGuards(router: Router) {
  router.beforeEach(async (to, from, next) => {
    const { isAuthenticated, loading, initializeAuth } = useAuth()
    
    // Initialize auth if not already done
    await initializeAuth()
    
    // Wait for auth to be initialized (max 3 seconds)
    let waitTime = 0
    while (loading.value && waitTime < 3000) {
      await new Promise(resolve => setTimeout(resolve, 50))
      waitTime += 50
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