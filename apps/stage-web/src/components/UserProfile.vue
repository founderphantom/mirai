<template>
  <div class="user-profile p-4 rounded-lg bg-neutral-100 dark:bg-neutral-800">
    <!-- Loading State -->
    <div v-if="loading" class="flex items-center justify-center py-8">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
    </div>
    
    <!-- Profile Display -->
    <div v-else-if="userProfile" class="space-y-4">
      <!-- Avatar and Basic Info -->
      <div class="flex items-center space-x-4">
        <div class="relative">
          <img 
            v-if="userAvatar"
            :src="userAvatar"
            :alt="userName"
            class="w-16 h-16 rounded-full object-cover"
          />
          <div 
            v-else
            class="w-16 h-16 rounded-full bg-primary-500 flex items-center justify-center text-white text-xl font-semibold"
          >
            {{ userName.charAt(0).toUpperCase() }}
          </div>
          
          <!-- Subscription Badge -->
          <span 
            v-if="subscriptionTier !== 'free'"
            class="absolute -bottom-1 -right-1 px-2 py-0.5 text-xs font-semibold rounded-full"
            :class="{
              'bg-purple-500 text-white': subscriptionTier === 'premium',
              'bg-blue-500 text-white': subscriptionTier === 'pro'
            }"
          >
            {{ subscriptionTier.toUpperCase() }}
          </span>
        </div>
        
        <div class="flex-1">
          <h3 class="text-lg font-semibold text-neutral-900 dark:text-white">
            {{ userName }}
          </h3>
          <p class="text-sm text-neutral-600 dark:text-neutral-400">
            {{ userEmail }}
          </p>
          <p v-if="userProfile.username" class="text-sm text-neutral-500 dark:text-neutral-500">
            @{{ userProfile.username }}
          </p>
        </div>
      </div>
      
      <!-- Bio Section -->
      <div v-if="userProfile.bio" class="pt-3 border-t border-neutral-200 dark:border-neutral-700">
        <p class="text-sm text-neutral-700 dark:text-neutral-300">
          {{ userProfile.bio }}
        </p>
      </div>
      
      <!-- Profile Stats -->
      <div class="pt-3 border-t border-neutral-200 dark:border-neutral-700 grid grid-cols-2 gap-4 text-sm">
        <div>
          <span class="text-neutral-500 dark:text-neutral-400">Member since:</span>
          <p class="font-medium text-neutral-900 dark:text-white">
            {{ formatDate(userProfile.created_at) }}
          </p>
        </div>
        <div v-if="userProfile.last_seen_at">
          <span class="text-neutral-500 dark:text-neutral-400">Last active:</span>
          <p class="font-medium text-neutral-900 dark:text-white">
            {{ formatRelativeTime(userProfile.last_seen_at) }}
          </p>
        </div>
      </div>
      
      <!-- Edit Profile Button -->
      <button
        @click="$emit('edit-profile')"
        class="w-full mt-4 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors text-sm font-medium"
      >
        Edit Profile
      </button>
    </div>
    
    <!-- No Profile State -->
    <div v-else class="text-center py-8">
      <p class="text-neutral-600 dark:text-neutral-400 mb-4">
        No profile information available
      </p>
      <button
        @click="refreshProfile"
        class="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors text-sm font-medium"
      >
        Refresh Profile
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useAuth } from '@/composables/useAuth'

// Define emits
defineEmits<{
  'edit-profile': []
}>()

// Use auth composable
const { 
  userProfile, 
  userName, 
  userEmail, 
  userAvatar, 
  subscriptionTier,
  loading,
  refreshProfile 
} = useAuth()

// Format date helper
const formatDate = (dateString: string) => {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric', 
    year: 'numeric' 
  })
}

// Format relative time helper
const formatRelativeTime = (dateString: string) => {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  
  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`
  
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
  
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 30) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
  
  return formatDate(dateString)
}
</script>

<style scoped>
/* Additional styles if needed */
</style>