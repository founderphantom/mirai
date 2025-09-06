<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="isOpen" class="fixed inset-0 z-50 overflow-y-auto">
        <!-- Backdrop -->
        <div 
          class="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
          @click="close"
        ></div>
        
        <!-- Modal -->
        <div class="flex min-h-full items-center justify-center p-4">
          <div 
            class="relative bg-white dark:bg-neutral-800 rounded-xl shadow-xl max-w-md w-full p-6 transition-all"
            @click.stop
          >
            <!-- Header -->
            <div class="flex items-center justify-between mb-6">
              <h2 class="text-xl font-semibold text-neutral-900 dark:text-white">
                Edit Profile
              </h2>
              <button
                @click="close"
                class="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
              >
                <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <!-- Error Message -->
            <div 
              v-if="error"
              class="mb-4 p-3 bg-error-50 dark:bg-error-900/20 border border-error-200 dark:border-error-800 rounded-lg"
            >
              <p class="text-sm text-error-800 dark:text-error-200">{{ error }}</p>
            </div>
            
            <!-- Form -->
            <form @submit.prevent="handleSubmit" class="space-y-4">
              <!-- Display Name -->
              <div>
                <label class="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Display Name
                </label>
                <input
                  v-model="formData.display_name"
                  type="text"
                  class="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg 
                         bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white
                         focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                         placeholder-neutral-400 dark:placeholder-neutral-500"
                  placeholder="Your display name"
                />
              </div>
              
              <!-- Username -->
              <div>
                <label class="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Username
                </label>
                <div class="relative">
                  <input
                    v-model="formData.username"
                    type="text"
                    @blur="checkUsername"
                    class="w-full px-3 py-2 pl-8 border border-neutral-300 dark:border-neutral-600 rounded-lg 
                           bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white
                           focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                           placeholder-neutral-400 dark:placeholder-neutral-500"
                    placeholder="username"
                  />
                  <span class="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 dark:text-neutral-400">
                    @
                  </span>
                </div>
                <p v-if="usernameStatus" class="mt-1 text-xs" :class="usernameStatusClass">
                  {{ usernameStatus }}
                </p>
              </div>
              
              <!-- Bio -->
              <div>
                <label class="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Bio
                </label>
                <textarea
                  v-model="formData.bio"
                  rows="3"
                  class="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg 
                         bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white
                         focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                         placeholder-neutral-400 dark:placeholder-neutral-500 resize-none"
                  placeholder="Tell us about yourself..."
                  maxlength="200"
                />
                <p class="mt-1 text-xs text-neutral-500 dark:text-neutral-400 text-right">
                  {{ formData.bio?.length || 0 }}/200
                </p>
              </div>
              
              <!-- Avatar URL -->
              <div>
                <label class="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Avatar URL
                </label>
                <input
                  v-model="formData.avatar_url"
                  type="url"
                  class="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg 
                         bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white
                         focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                         placeholder-neutral-400 dark:placeholder-neutral-500"
                  placeholder="https://example.com/avatar.jpg"
                />
              </div>
              
              <!-- Buttons -->
              <div class="flex space-x-3 pt-4">
                <button
                  type="button"
                  @click="close"
                  class="flex-1 px-4 py-2 border border-neutral-300 dark:border-neutral-600 
                         text-neutral-700 dark:text-neutral-300 rounded-lg 
                         hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  :disabled="isLoading || !isFormValid"
                  class="flex-1 px-4 py-2 bg-primary-600 hover:bg-primary-700 
                         text-white rounded-lg transition-colors
                         disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span v-if="!isLoading">Save Changes</span>
                  <span v-else class="flex items-center justify-center">
                    <svg class="animate-spin h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24">
                      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Saving...
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue'
import { useAuth } from '@/composables/useAuth'
import type { UserProfile } from '@/lib/api'

// Props
const props = defineProps<{
  isOpen: boolean
}>()

// Emits
const emit = defineEmits<{
  close: []
  updated: [profile: UserProfile]
}>()

// Auth composable
const { userProfile, updateProfile, checkUsernameAvailability } = useAuth()

// Form state
const formData = reactive({
  display_name: '',
  username: '',
  bio: '',
  avatar_url: '',
})

const isLoading = ref(false)
const error = ref('')
const usernameStatus = ref('')
const usernameAvailable = ref(true)

// Initialize form data when modal opens
watch(() => props.isOpen, (isOpen) => {
  if (isOpen && userProfile.value) {
    formData.display_name = userProfile.value.display_name || ''
    formData.username = userProfile.value.username || ''
    formData.bio = userProfile.value.bio || ''
    formData.avatar_url = userProfile.value.avatar_url || ''
    error.value = ''
    usernameStatus.value = ''
  }
})

// Computed
const isFormValid = computed(() => {
  return formData.display_name && usernameAvailable.value
})

const usernameStatusClass = computed(() => {
  if (usernameStatus.value.includes('available')) {
    return 'text-success-600 dark:text-success-400'
  }
  if (usernameStatus.value.includes('taken')) {
    return 'text-error-600 dark:text-error-400'
  }
  return 'text-neutral-500 dark:text-neutral-400'
})

// Methods
const checkUsername = async () => {
  if (!formData.username) {
    usernameStatus.value = ''
    usernameAvailable.value = true
    return
  }
  
  // Don't check if it's the current username
  if (formData.username === userProfile.value?.username) {
    usernameStatus.value = ''
    usernameAvailable.value = true
    return
  }
  
  usernameStatus.value = 'Checking...'
  const available = await checkUsernameAvailability(formData.username)
  
  if (available) {
    usernameStatus.value = 'Username is available'
    usernameAvailable.value = true
  } else {
    usernameStatus.value = 'Username is taken'
    usernameAvailable.value = false
  }
}

const handleSubmit = async () => {
  if (!isFormValid.value) return
  
  isLoading.value = true
  error.value = ''
  
  try {
    const { data, error: updateError } = await updateProfile({
      display_name: formData.display_name,
      username: formData.username || undefined,
      bio: formData.bio || undefined,
      avatar_url: formData.avatar_url || undefined,
    })
    
    if (updateError) {
      error.value = updateError
      return
    }
    
    if (data) {
      emit('updated', data)
      close()
    }
  } catch (err) {
    error.value = 'Failed to update profile. Please try again.'
  } finally {
    isLoading.value = false
  }
}

const close = () => {
  emit('close')
}
</script>

<style scoped>
/* Modal transition */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-active .relative,
.modal-leave-active .relative {
  transition: transform 0.3s ease;
}

.modal-enter-from .relative {
  transform: scale(0.9);
}

.modal-leave-to .relative {
  transform: scale(0.9);
}
</style>