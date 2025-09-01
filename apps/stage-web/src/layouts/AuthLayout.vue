<template>
  <div class="min-h-screen flex bg-neutral-50 dark:bg-neutral-900 transition-colors">
    <!-- Left Panel - Branding (Desktop only) -->
    <div 
      class="hidden lg:flex lg:w-1/2 xl:w-2/5 p-12 flex-col justify-between relative overflow-hidden"
      :class="gradientClass"
    >
      <!-- Background Pattern -->
      <div class="absolute inset-0 opacity-10">
        <div class="absolute -top-24 -left-24 w-96 h-96 bg-white/20 rounded-full blur-3xl"></div>
        <div class="absolute -bottom-24 -right-24 w-96 h-96 bg-white/20 rounded-full blur-3xl"></div>
      </div>
      
      <!-- Content -->
      <div class="relative z-10">
        <!-- Logo -->
        <div class="mb-12 flex items-center space-x-3">
          <div class="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
            <span class="text-2xl">🤖</span>
          </div>
          <span class="text-2xl font-bold text-white">AIRI</span>
        </div>
        
        <!-- Heading -->
        <h1 class="text-4xl xl:text-5xl font-bold text-white mb-6 leading-tight">
          Your AI Companion Awaits
        </h1>
        <p class="text-xl text-white/90 mb-12 leading-relaxed">
          Experience the future of AI interaction with personalized companions, 
          voice chat, and gaming integration.
        </p>
        
        <!-- Features -->
        <div class="space-y-5">
          <div class="flex space-x-4">
            <div class="flex-shrink-0 w-12 h-12 bg-white/10 backdrop-blur-sm rounded-xl flex items-center justify-center">
              <span class="text-2xl">💬</span>
            </div>
            <div class="flex-1">
              <h3 class="text-white font-semibold mb-1">Natural Conversations</h3>
              <p class="text-white/80 text-sm leading-relaxed">Chat naturally with AI companions that understand context and emotion</p>
            </div>
          </div>
          
          <div class="flex space-x-4">
            <div class="flex-shrink-0 w-12 h-12 bg-white/10 backdrop-blur-sm rounded-xl flex items-center justify-center">
              <span class="text-2xl">🎮</span>
            </div>
            <div class="flex-1">
              <h3 class="text-white font-semibold mb-1">Gaming Integration</h3>
              <p class="text-white/80 text-sm leading-relaxed">Play Minecraft and other games together with your AI companion</p>
            </div>
          </div>
          
          <div class="flex space-x-4">
            <div class="flex-shrink-0 w-12 h-12 bg-white/10 backdrop-blur-sm rounded-xl flex items-center justify-center">
              <span class="text-2xl">🎙️</span>
            </div>
            <div class="flex-1">
              <h3 class="text-white font-semibold mb-1">Voice Interactions</h3>
              <p class="text-white/80 text-sm leading-relaxed">Speak naturally with voice recognition and emotional responses</p>
            </div>
          </div>
          
          <div class="flex space-x-4">
            <div class="flex-shrink-0 w-12 h-12 bg-white/10 backdrop-blur-sm rounded-xl flex items-center justify-center">
              <span class="text-2xl">👤</span>
            </div>
            <div class="flex-1">
              <h3 class="text-white font-semibold mb-1">Customizable Avatars</h3>
              <p class="text-white/80 text-sm leading-relaxed">Create and customize your perfect AI companion's appearance</p>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Testimonial -->
      <div class="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
        <div class="flex items-start space-x-1 mb-3">
          <svg class="w-5 h-5 text-yellow-400 fill-current" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
          <svg class="w-5 h-5 text-yellow-400 fill-current" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
          <svg class="w-5 h-5 text-yellow-400 fill-current" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
          <svg class="w-5 h-5 text-yellow-400 fill-current" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
          <svg class="w-5 h-5 text-yellow-400 fill-current" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        </div>
        <p class="text-white/90 italic mb-4 leading-relaxed">
          "AIRI transformed how I interact with AI. It feels like having a real companion 
          who understands me and can even join me in games!"
        </p>
        <div class="flex items-center space-x-3">
          <div class="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
            <span class="text-sm">SC</span>
          </div>
          <div>
            <p class="text-white font-medium">Sarah Chen</p>
            <p class="text-white/70 text-sm">Early Adopter</p>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Right Panel - Auth Forms -->
    <div class="flex-1 flex items-center justify-center p-8 relative">
      <!-- Mobile Logo -->
      <div class="lg:hidden absolute top-8 left-8 flex items-center space-x-2">
        <div class="w-10 h-10 bg-primary-600 rounded-xl flex items-center justify-center">
          <span class="text-xl">🤖</span>
        </div>
        <span class="text-xl font-bold text-neutral-900 dark:text-white">AIRI</span>
      </div>
      
      <!-- Form Container -->
      <div class="w-full max-w-md mt-16 lg:mt-0">
        <transition
          name="fade-slide"
          mode="out-in"
        >
          <slot />
        </transition>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()

// Dynamic gradient based on current auth page
const gradientClass = computed(() => {
  const path = route.path
  if (path.includes('signup')) {
    return 'bg-gradient-to-br from-secondary-600 to-accent-600'
  } else if (path.includes('reset')) {
    return 'bg-gradient-to-br from-primary-600 to-primary-800'
  }
  return 'bg-gradient-to-br from-primary-600 to-secondary-600'
})
</script>

<style scoped>
/* Fade and slide transition */
.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: all 0.3s ease;
}

.fade-slide-enter-from {
  opacity: 0;
  transform: translateY(10px);
}

.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
</style>