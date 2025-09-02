<template>
  <div class="min-h-screen bg-neutral-50 dark:bg-neutral-900 relative">
    <!-- Header -->
    <header class="bg-white dark:bg-neutral-800 shadow-sm">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between items-center h-16">
          <!-- Logo -->
          <div class="flex items-center space-x-3">
            <div class="w-10 h-10 bg-primary-600 rounded-xl flex items-center justify-center">
              <span class="text-xl">🤖</span>
            </div>
            <span class="text-xl font-bold text-neutral-900 dark:text-white">AIRI Dashboard</span>
          </div>
          
          <!-- User Menu -->
          <div class="flex items-center space-x-4">
            <span class="text-sm text-neutral-600 dark:text-neutral-400">
              {{ userEmail }}
            </span>
            <button
              @click="handleSignOut"
              class="px-4 py-2 text-sm font-medium text-neutral-700 dark:text-neutral-300 
                     hover:text-neutral-900 dark:hover:text-white 
                     bg-neutral-100 dark:bg-neutral-700 
                     hover:bg-neutral-200 dark:hover:bg-neutral-600 
                     rounded-lg transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </header>
    
    <!-- Main Content -->
    <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 pb-32 sm:pb-12">
      <div class="bg-white dark:bg-neutral-800 rounded-xl shadow-lg p-8">
        <h1 class="text-3xl font-bold text-neutral-900 dark:text-white mb-4">
          Welcome to AIRI! 
        </h1>
        <p class="text-lg text-neutral-600 dark:text-neutral-400 mb-8">
          You have successfully authenticated. This is your dashboard.
        </p>
        
        <!-- Empty State with Primary CTA -->
        <div v-if="chatCount === 0" class="flex flex-col items-center justify-center py-12">
          <!-- Illustration -->
          <div class="w-48 h-48 mb-8 rounded-full bg-gradient-to-br from-primary-100 to-primary-200 dark:from-primary-900/20 dark:to-primary-800/20 flex items-center justify-center">
            <span class="text-6xl">💬</span>
          </div>
          
          <!-- Empty State Text -->
          <h2 class="text-2xl font-bold text-neutral-900 dark:text-white mb-3">
            {{ t('dashboard.empty_state.title') }}
          </h2>
          <p class="text-neutral-600 dark:text-neutral-400 text-center max-w-md mb-8">
            {{ t('dashboard.empty_state.description') }}
          </p>
          
          <!-- Primary CTA Button -->
          <button
            @click="handleStartNewChat"
            class="start-chat-button group relative px-8 py-4 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white font-semibold text-lg rounded-full shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200 flex items-center gap-3"
          >
            <div class="i-solar:chat-round-dots-bold-duotone text-xl group-hover:rotate-12 transition-transform duration-300" />
            <span>{{ t('dashboard.start_new_chat') }}</span>
            
            <!-- Pulse animation -->
            <span class="absolute inset-0 rounded-full bg-gradient-to-r from-primary-500 to-primary-600 opacity-30 animate-ping" />
          </button>
        </div>
        
        <!-- Chat List with Top Button (when chats exist) -->
        <div v-else>
          <!-- New Chat Button at Top -->
          <div class="flex justify-between items-center mb-6">
            <h2 class="text-xl font-semibold text-neutral-900 dark:text-white">
              {{ t('dashboard.your_chats') }}
            </h2>
            <button
              @click="handleStartNewChat"
              class="hidden sm:flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white font-semibold rounded-full shadow-md hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-200"
            >
              <div class="i-solar:chat-round-dots-bold-duotone text-lg" />
              <span>{{ t('dashboard.start_new_chat') }}</span>
            </button>
          </div>
          
          <!-- TODO: Chat list component will go here -->
          <div class="bg-neutral-100 dark:bg-neutral-800 rounded-lg p-8 text-center text-neutral-600 dark:text-neutral-400">
            Chat list component coming soon...
          </div>
        </div>
        
        <!-- Quick Stats -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 mt-8">
          <div class="bg-primary-50 dark:bg-primary-900/20 rounded-lg p-6">
            <div class="flex items-center space-x-3 mb-2">
              <span class="text-2xl">💬</span>
              <h3 class="text-lg font-semibold text-primary-900 dark:text-primary-100">
                Conversations
              </h3>
            </div>
            <p class="text-3xl font-bold text-primary-600 dark:text-primary-400">{{ chatCount }}</p>
            <p class="text-sm text-primary-600 dark:text-primary-300">Start chatting with AIRI</p>
          </div>
          
          <div class="bg-secondary-50 dark:bg-secondary-900/20 rounded-lg p-6">
            <div class="flex items-center space-x-3 mb-2">
              <span class="text-2xl">🎮</span>
              <h3 class="text-lg font-semibold text-secondary-900 dark:text-secondary-100">
                Gaming Sessions
              </h3>
            </div>
            <p class="text-3xl font-bold text-secondary-600 dark:text-secondary-400">0</p>
            <p class="text-sm text-secondary-600 dark:text-secondary-300">Play games together</p>
          </div>
          
          <div class="bg-accent-50 dark:bg-accent-900/20 rounded-lg p-6">
            <div class="flex items-center space-x-3 mb-2">
              <span class="text-2xl">👤</span>
              <h3 class="text-lg font-semibold text-accent-900 dark:text-accent-100">
                Companions
              </h3>
            </div>
            <p class="text-3xl font-bold text-accent-600 dark:text-accent-400">1</p>
            <p class="text-sm text-accent-600 dark:text-accent-300">Customize your AI companion</p>
          </div>
        </div>
        
        <!-- Authentication Info -->
        <div class="bg-neutral-50 dark:bg-neutral-900 rounded-lg p-6">
          <h2 class="text-lg font-semibold text-neutral-900 dark:text-white mb-4">
            Authentication Details
          </h2>
          <dl class="space-y-2">
            <div class="flex justify-between">
              <dt class="text-sm text-neutral-600 dark:text-neutral-400">User ID:</dt>
              <dd class="text-sm font-mono text-neutral-900 dark:text-white">{{ userId || 'N/A' }}</dd>
            </div>
            <div class="flex justify-between">
              <dt class="text-sm text-neutral-600 dark:text-neutral-400">Email:</dt>
              <dd class="text-sm font-mono text-neutral-900 dark:text-white">{{ userEmail || 'N/A' }}</dd>
            </div>
            <div class="flex justify-between">
              <dt class="text-sm text-neutral-600 dark:text-neutral-400">Session Active:</dt>
              <dd class="text-sm font-mono text-neutral-900 dark:text-white">{{ isAuthenticated ? 'Yes' : 'No' }}</dd>
            </div>
          </dl>
        </div>
      </div>
    </main>
    
    <!-- Mobile Floating Action Button (FAB) -->
    <button
      v-if="chatCount > 0"
      @click="handleStartNewChat"
      class="sm:hidden fixed bottom-6 right-6 z-50 w-16 h-16 bg-gradient-to-br from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white rounded-full shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-95 transition-all duration-200 flex items-center justify-center group"
      :aria-label="t('dashboard.start_new_chat')"
    >
      <div class="i-solar:chat-round-dots-bold-duotone text-2xl group-hover:rotate-12 transition-transform duration-300" />
      
      <!-- Pulse ring effect on mobile -->
      <span class="absolute inset-0 rounded-full bg-gradient-to-br from-primary-500 to-primary-600 opacity-30 animate-ping" />
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useAuth, useAuthGuard } from '@/composables/useAuth'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'

// Authentication
const { user, userEmail, isAuthenticated, signOut } = useAuth()
const { requireAuth } = useAuthGuard()
const router = useRouter()
const { t } = useI18n()

// State
const chatCount = ref(0) // TODO: Replace with actual chat count from store/API

// Computed
const userId = computed(() => user.value?.id)

// Lifecycle
onMounted(async () => {
  // Ensure user is authenticated
  const canAccess = await requireAuth()
  if (!canAccess) {
    return
  }
})

// Methods
const handleStartNewChat = () => {
  // TODO: Navigate to chat page or open new chat modal
  router.push('/chat/new')
  toast.success(t('dashboard.new_chat_started'))
}

const handleSignOut = async () => {
  const { error } = await signOut()
  if (error) {
    toast.error('Failed to sign out')
  } else {
    toast.success(t('settings.auth.sign_out_success'))
  }
}
</script>

<route lang="yaml">
meta:
  requiresAuth: true
  title: Dashboard - AIRI
</route>