import type { Plugin } from 'vue'
import type { Router } from 'vue-router'

import Tres from '@tresjs/core'
import NProgress from 'nprogress'

import { autoAnimatePlugin } from '@formkit/auto-animate/vue'
import { MotionPlugin } from '@vueuse/motion'
import { createPinia } from 'pinia'
import { setupLayouts } from 'virtual:generated-layouts'
import { createApp } from 'vue'
import { createRouter, createWebHashHistory, createWebHistory } from 'vue-router'
import { routes } from 'vue-router/auto-routes'

import App from './App.vue'
import { authClient } from './lib/auth'

import { i18n } from './modules/i18n'

import '@proj-airi/font-cjkfonts-allseto/index.css'
import '@proj-airi/font-xiaolai/index.css'
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

// Public routes that don't require authentication
const publicRoutes = [
  '/auth/sign-in',
  '/auth/sign-up',
  '/',
]

router.beforeEach(async (to, from) => {
  // Show progress bar
  if (to.path !== from.path)
    NProgress.start()

  // Check if route requires authentication
  const isPublicRoute = publicRoutes.includes(to.path)

  if (!isPublicRoute) {
    // Check authentication status
    const session = await authClient.getSession()

    if (!session?.user) {
      // Not authenticated - redirect to sign in
      NProgress.done()
      return { path: '/auth/sign-in', query: { redirect: to.fullPath } }
    }
  }

  // Allow navigation
  return true
})

router.afterEach(() => {
  NProgress.done()
})

createApp(App)
  .use(MotionPlugin)
  // TODO: Fix autoAnimatePlugin type error
  .use(autoAnimatePlugin as unknown as Plugin)
  .use(router)
  .use(pinia)
  .use(i18n)
  .use(Tres)
  .mount('#app')
