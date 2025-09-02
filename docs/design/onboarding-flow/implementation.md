# Implementation Guide

## Vue.js Component Implementation

### Sign Out Button Component

```vue
<!-- SignOutButton.vue -->
<template>
  <div class="sign-out-container">
    <button
      class="sign-out-button"
      :disabled="isLoading"
      @click="handleSignOut"
      aria-label="Sign out of your account"
      aria-describedby="signout-description"
    >
      <svg
        v-if="!isLoading"
        class="sign-out-icon"
        width="20"
        height="20"
        aria-hidden="true"
      >
        <use href="#icon-logout" />
      </svg>
      <span v-if="isLoading" class="loading-spinner" />
      <span>{{ isLoading ? 'Signing out...' : 'Sign Out' }}</span>
    </button>
    
    <span id="signout-description" class="sr-only">
      This will end your session and return you to the login page
    </span>
    
    <!-- Confirmation Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div
          v-if="showConfirmation"
          class="modal-backdrop"
          @click.self="closeModal"
        >
          <div
            class="modal-content"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
          >
            <h2 id="modal-title" class="modal-title">
              Confirm Sign Out
            </h2>
            <p class="modal-description">
              Are you sure you want to sign out? Any unsaved changes will be lost.
            </p>
            <div class="modal-actions">
              <button
                class="btn-secondary"
                @click="closeModal"
                :disabled="isLoading"
              >
                Cancel
              </button>
              <button
                class="btn-primary btn-danger"
                @click="confirmSignOut"
                :disabled="isLoading"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const authStore = useAuthStore()

const isLoading = ref(false)
const showConfirmation = ref(false)

const handleSignOut = () => {
  showConfirmation.value = true
}

const closeModal = () => {
  if (!isLoading.value) {
    showConfirmation.value = false
  }
}

const confirmSignOut = async () => {
  isLoading.value = true
  
  try {
    await authStore.signOut()
    
    // Clear local storage
    localStorage.clear()
    sessionStorage.clear()
    
    // Redirect to landing page
    await router.push('/auth')
    
    // Announce to screen readers
    announceToScreenReader('You have been signed out successfully')
  } catch (error) {
    console.error('Sign out failed:', error)
    // Handle error
    announceToScreenReader('Sign out failed. Please try again.')
  } finally {
    isLoading.value = false
    showConfirmation.value = false
  }
}

const announceToScreenReader = (message: string) => {
  const announcement = document.createElement('div')
  announcement.setAttribute('role', 'status')
  announcement.setAttribute('aria-live', 'polite')
  announcement.className = 'sr-only'
  announcement.textContent = message
  document.body.appendChild(announcement)
  
  setTimeout(() => {
    document.body.removeChild(announcement)
  }, 1000)
}
</script>

<style scoped>
.sign-out-container {
  margin-top: var(--space-8);
  padding-top: var(--space-6);
  border-top: 1px solid var(--neutral-200);
}

.sign-out-button {
  width: 100%;
  max-width: 320px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  
  background: transparent;
  border: 2px solid var(--error-500);
  border-radius: var(--radius-xl);
  
  font-size: var(--text-base);
  font-weight: var(--font-semibold);
  color: var(--error-500);
  
  padding: var(--space-3) var(--space-6);
  cursor: pointer;
  transition: all var(--duration-200) var(--ease-out);
}

.sign-out-button:hover:not(:disabled) {
  background: var(--error-500);
  color: white;
  transform: translateY(-1px);
  box-shadow: var(--shadow-lg);
}

.sign-out-button:active:not(:disabled) {
  transform: translateY(0);
  box-shadow: var(--shadow-md);
}

.sign-out-button:focus-visible {
  outline: 2px solid var(--error-500);
  outline-offset: 2px;
}

.sign-out-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.loading-spinner {
  width: 20px;
  height: 20px;
  border: 2px solid currentColor;
  border-right-color: transparent;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Modal styles */
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: var(--z-modal-backdrop);
}

.modal-content {
  background: var(--bg-secondary);
  border-radius: var(--radius-2xl);
  padding: var(--space-6);
  max-width: 400px;
  width: 90%;
  box-shadow: var(--shadow-2xl);
}

.modal-title {
  font-size: var(--text-xl);
  font-weight: var(--font-bold);
  margin-bottom: var(--space-3);
  text-align: center;
}

.modal-description {
  font-size: var(--text-base);
  color: var(--neutral-600);
  margin-bottom: var(--space-6);
  text-align: center;
}

.modal-actions {
  display: flex;
  gap: var(--space-3);
  justify-content: center;
}

/* Transitions */
.modal-enter-active,
.modal-leave-active {
  transition: opacity var(--duration-300) var(--ease-out);
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-active .modal-content {
  animation: modal-in var(--duration-300) var(--ease-out);
}

.modal-leave-active .modal-content {
  animation: modal-out var(--duration-200) var(--ease-in);
}

@keyframes modal-in {
  from {
    transform: scale(0.9) translateY(20px);
    opacity: 0;
  }
  to {
    transform: scale(1) translateY(0);
    opacity: 1;
  }
}

@keyframes modal-out {
  from {
    transform: scale(1) translateY(0);
    opacity: 1;
  }
  to {
    transform: scale(0.9) translateY(20px);
    opacity: 0;
  }
}
</style>
```

### Start New Chat Button Component

```vue
<!-- StartChatButton.vue -->
<template>
  <div class="start-chat-wrapper">
    <!-- Desktop/Tablet Version -->
    <button
      v-if="!isMobile"
      class="start-chat-button"
      @click="startNewChat"
      :disabled="isCreating"
      aria-label="Start a new chat conversation"
      aria-describedby="newchat-description"
    >
      <svg
        v-if="!isCreating"
        class="start-chat-icon"
        width="24"
        height="24"
        aria-hidden="true"
      >
        <use href="#icon-chat-round-dots" />
      </svg>
      <span v-if="isCreating" class="loading-spinner" />
      <span>{{ isCreating ? 'Creating...' : 'Start New Chat' }}</span>
    </button>
    
    <!-- Mobile Floating Action Button -->
    <button
      v-else
      class="start-chat-fab"
      @click="startNewChat"
      :disabled="isCreating"
      aria-label="Start a new chat conversation"
    >
      <svg
        v-if="!isCreating"
        width="28"
        height="28"
        aria-hidden="true"
      >
        <use href="#icon-chat-round-dots" />
      </svg>
      <span v-if="isCreating" class="loading-spinner" />
    </button>
    
    <span id="newchat-description" class="sr-only">
      Create a new chat session to begin a conversation
    </span>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useChatStore } from '@/stores/chat'

const router = useRouter()
const chatStore = useChatStore()

const isCreating = ref(false)
const windowWidth = ref(window.innerWidth)

const isMobile = computed(() => windowWidth.value < 640)

const handleResize = () => {
  windowWidth.value = window.innerWidth
}

const startNewChat = async () => {
  isCreating.value = true
  
  try {
    // Create new chat session
    const chatId = await chatStore.createNewChat()
    
    // Navigate to new chat
    await router.push(`/dashboard/chat/${chatId}`)
    
    // Announce to screen readers
    announceToScreenReader('New chat created successfully')
  } catch (error) {
    console.error('Failed to create chat:', error)
    announceToScreenReader('Failed to create new chat. Please try again.')
  } finally {
    isCreating.value = false
  }
}

const announceToScreenReader = (message: string) => {
  const announcement = document.createElement('div')
  announcement.setAttribute('role', 'status')
  announcement.setAttribute('aria-live', 'polite')
  announcement.className = 'sr-only'
  announcement.textContent = message
  document.body.appendChild(announcement)
  
  setTimeout(() => {
    document.body.removeChild(announcement)
  }, 1000)
}

onMounted(() => {
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
})
</script>

<style scoped>
/* Desktop Button */
.start-chat-button {
  height: 56px;
  min-width: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  
  background: linear-gradient(135deg, var(--primary-500), var(--primary-600));
  border: none;
  border-radius: var(--radius-full);
  
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  color: white;
  
  padding: var(--space-4) var(--space-8);
  cursor: pointer;
  
  box-shadow: 0 4px 14px 0 rgba(14, 165, 233, 0.4);
  transition: all var(--duration-300) var(--ease-out);
  position: relative;
  overflow: hidden;
}

.start-chat-button::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: inherit;
  animation: pulse-ring 2s infinite;
  pointer-events: none;
}

@keyframes pulse-ring {
  0% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.2);
    opacity: 0.5;
  }
  100% {
    transform: scale(1.4);
    opacity: 0;
  }
}

.start-chat-button:hover:not(:disabled) {
  background: linear-gradient(135deg, var(--primary-600), var(--primary-700));
  transform: translateY(-2px);
  box-shadow: 0 6px 20px 0 rgba(14, 165, 233, 0.5);
}

.start-chat-button:active:not(:disabled) {
  transform: translateY(0);
  box-shadow: 0 2px 8px 0 rgba(14, 165, 233, 0.3);
}

.start-chat-button:focus-visible {
  outline: 3px solid var(--primary-300);
  outline-offset: 3px;
}

.start-chat-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.start-chat-icon {
  transition: transform var(--duration-300) var(--ease-out);
}

.start-chat-button:hover:not(:disabled) .start-chat-icon {
  transform: rotate(15deg) scale(1.1);
}

/* Mobile Floating Action Button */
.start-chat-fab {
  position: fixed;
  bottom: var(--space-6);
  right: var(--space-6);
  z-index: var(--z-fixed);
  
  width: 64px;
  height: 64px;
  border-radius: 50%;
  
  background: linear-gradient(135deg, var(--primary-500), var(--primary-600));
  border: none;
  color: white;
  
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  
  box-shadow: 0 4px 14px 0 rgba(14, 165, 233, 0.5);
  transition: all var(--duration-300) var(--ease-out);
}

.start-chat-fab:hover:not(:disabled) {
  transform: scale(1.1);
  box-shadow: 0 6px 20px 0 rgba(14, 165, 233, 0.6);
}

.start-chat-fab:active:not(:disabled) {
  transform: scale(0.95);
}

.start-chat-fab:focus-visible {
  outline: 3px solid var(--primary-300);
  outline-offset: 3px;
}

.loading-spinner {
  width: 24px;
  height: 24px;
  border: 3px solid currentColor;
  border-right-color: transparent;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
```

### Settings Page Integration

```vue
<!-- pages/settings/index.vue -->
<template>
  <div class="settings-page">
    <!-- Existing settings content -->
    <div class="settings-sections">
      <!-- ... other settings sections ... -->
    </div>
    
    <!-- Sign Out Button at bottom -->
    <SignOutButton />
  </div>
</template>

<script setup lang="ts">
import SignOutButton from '@/components/SignOutButton.vue'
// ... rest of imports
</script>
```

### Dashboard Page Integration

```vue
<!-- pages/dashboard/index.vue -->
<template>
  <div class="dashboard-page">
    <!-- Header with navigation -->
    <header class="dashboard-header">
      <h1>Dashboard</h1>
      <nav class="dashboard-nav">
        <router-link to="/settings" aria-label="Go to settings">
          <svg width="24" height="24">
            <use href="#icon-settings" />
          </svg>
        </router-link>
      </nav>
    </header>
    
    <!-- Main content area -->
    <main class="dashboard-main">
      <!-- Empty state -->
      <div v-if="!hasChats" class="empty-state">
        <img
          src="/assets/empty-chat-illustration.svg"
          alt=""
          class="empty-state-illustration"
        >
        <h2 class="empty-state-title">No conversations yet</h2>
        <p class="empty-state-description">
          Start your first chat to begin exploring
        </p>
        <StartChatButton />
      </div>
      
      <!-- Chat list -->
      <div v-else class="chat-list">
        <div class="chat-list-header">
          <h2>Recent Chats</h2>
          <StartChatButton />
        </div>
        <!-- ... chat items ... -->
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import StartChatButton from '@/components/StartChatButton.vue'
import { useChatStore } from '@/stores/chat'

const chatStore = useChatStore()
const hasChats = computed(() => chatStore.chats.length > 0)
</script>
```

## Router Configuration

```typescript
// router/index.ts
import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const routes = [
  {
    path: '/',
    redirect: '/auth'
  },
  {
    path: '/auth',
    component: () => import('@/pages/auth/index.vue'),
    children: [
      {
        path: '',
        redirect: '/auth/signin'
      },
      {
        path: 'signin',
        component: () => import('@/pages/auth/signin.vue'),
        meta: { requiresGuest: true }
      },
      {
        path: 'signup',
        component: () => import('@/pages/auth/signup.vue'),
        meta: { requiresGuest: true }
      }
    ]
  },
  {
    path: '/dashboard',
    component: () => import('@/pages/dashboard/index.vue'),
    meta: { requiresAuth: true },
    children: [
      {
        path: 'chat/:id',
        component: () => import('@/pages/dashboard/chat.vue')
      }
    ]
  },
  {
    path: '/settings',
    component: () => import('@/pages/settings/index.vue'),
    meta: { requiresAuth: true }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// Navigation guards
router.beforeEach(async (to, from, next) => {
  const authStore = useAuthStore()
  
  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    next('/auth/signin')
  } else if (to.meta.requiresGuest && authStore.isAuthenticated) {
    next('/dashboard')
  } else {
    next()
  }
})

export default router
```

## Store Implementation

```typescript
// stores/auth.ts
import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useAuthStore = defineStore('auth', () => {
  const user = ref(null)
  const isAuthenticated = ref(false)
  const isLoading = ref(false)
  
  const signIn = async (credentials: SignInCredentials) => {
    isLoading.value = true
    try {
      const response = await api.signIn(credentials)
      user.value = response.user
      isAuthenticated.value = true
      localStorage.setItem('token', response.token)
      return response
    } finally {
      isLoading.value = false
    }
  }
  
  const signOut = async () => {
    isLoading.value = true
    try {
      await api.signOut()
      user.value = null
      isAuthenticated.value = false
      localStorage.removeItem('token')
    } finally {
      isLoading.value = false
    }
  }
  
  const checkAuth = async () => {
    const token = localStorage.getItem('token')
    if (token) {
      try {
        const response = await api.validateToken(token)
        user.value = response.user
        isAuthenticated.value = true
      } catch {
        localStorage.removeItem('token')
      }
    }
  }
  
  return {
    user,
    isAuthenticated,
    isLoading,
    signIn,
    signOut,
    checkAuth
  }
})
```

## Testing Implementation

```typescript
// tests/components/SignOutButton.spec.ts
import { mount } from '@vue/test-utils'
import { describe, it, expect, vi } from 'vitest'
import SignOutButton from '@/components/SignOutButton.vue'

describe('SignOutButton', () => {
  it('renders correctly', () => {
    const wrapper = mount(SignOutButton)
    expect(wrapper.text()).toContain('Sign Out')
  })
  
  it('shows confirmation modal on click', async () => {
    const wrapper = mount(SignOutButton)
    await wrapper.find('.sign-out-button').trigger('click')
    expect(wrapper.find('.modal-backdrop').exists()).toBe(true)
  })
  
  it('handles sign out process', async () => {
    const mockSignOut = vi.fn()
    const wrapper = mount(SignOutButton, {
      global: {
        mocks: {
          $store: {
            dispatch: mockSignOut
          }
        }
      }
    })
    
    await wrapper.find('.sign-out-button').trigger('click')
    await wrapper.find('.btn-danger').trigger('click')
    expect(mockSignOut).toHaveBeenCalled()
  })
  
  it('is keyboard accessible', async () => {
    const wrapper = mount(SignOutButton)
    const button = wrapper.find('.sign-out-button')
    
    expect(button.attributes('aria-label')).toBe('Sign out of your account')
    expect(button.attributes('aria-describedby')).toBe('signout-description')
  })
})
```