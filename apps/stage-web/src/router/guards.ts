import type { Router } from 'vue-router'
import { useAuth } from '@/composables/useAuth'

export function setupRouteGuards(router: Router) {
  router.beforeEach(async (to, from, next) => {
    const { isAuthenticated, loading, initializeAuth } = useAuth()
    
    // Initialize auth if not already done
    if (loading.value) {
      await initializeAuth()
    }
    
    // Wait for auth to be initialized
    while (loading.value) {
      await new Promise(resolve => setTimeout(resolve, 50))
    }
    
    // Check if route requires authentication
    const requiresAuth = to.matched.some(record => record.meta.requiresAuth !== false)
    const isAuthRoute = to.path.startsWith('/auth/')
    
    // If route requires auth and user is not authenticated
    if (requiresAuth && !isAuthRoute && !isAuthenticated.value) {
      // Redirect to login with return URL
      next({
        path: '/auth/login',
        query: { redirect: to.fullPath }
      })
      return
    }
    
    // If user is authenticated and trying to access auth pages
    if (isAuthenticated.value && isAuthRoute && !to.path.includes('callback')) {
      // Redirect to dashboard
      next('/dashboard')
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