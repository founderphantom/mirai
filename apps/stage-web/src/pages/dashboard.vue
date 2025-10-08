<script setup lang="ts">
import { computed } from 'vue'
import { useSession } from '@/lib/auth'
import { authClient } from '@/lib/auth'
import { useRouter } from 'vue-router'

const router = useRouter()
const sessionData = useSession()
const session = computed(() => sessionData.value.data)
const user = computed(() => session.value?.user)
const isLoading = computed(() => sessionData.value.isPending)
const error = computed(() => sessionData.value.error)

async function handleSignOut() {
  await authClient.signOut()
  router.push('/auth/sign-in')
}

function navigateToChat() {
  router.push('/chat')
}
</script>

<template>
  <div class="dashboard">
    <div class="dashboard-container">
      <!-- Loading State -->
      <div v-if="isLoading" class="loading-container">
        <div class="loading-spinner"></div>
        <p class="loading-text">Loading your dashboard...</p>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="error-container">
        <div class="error-icon">⚠️</div>
        <h2 class="error-title">Failed to load session</h2>
        <p class="error-message">{{ error.message }}</p>
        <button @click="router.push('/auth/sign-in')" class="retry-btn">
          Return to Sign In
        </button>
      </div>

      <!-- Main Content (when loaded) -->
      <template v-else-if="user">
        <!-- Header -->
        <div class="dashboard-header">
          <div class="header-content">
            <h1>Welcome to Mirai</h1>
            <p v-if="user" class="user-name">Hello, {{ user.name }}!</p>
          </div>
          <button @click="handleSignOut" class="sign-out-btn">Sign Out</button>
        </div>

        <!-- Main Content -->
        <div class="dashboard-content">
        <div class="hero">
          <div class="hero-text">
            <h2>Your AI Companion Platform</h2>
            <p>Connect with your favorite characters through voice conversations powered by advanced AI.</p>
          </div>
          <button @click="navigateToChat" class="start-chat-btn">
            Start Chatting
          </button>
        </div>

        <!-- Feature Cards -->
        <div class="features">
          <div class="feature-card">
            <div class="feature-icon">🎭</div>
            <h3>Multiple Characters</h3>
            <p>Choose from a variety of unique AI personalities</p>
          </div>
          <div class="feature-card">
            <div class="feature-icon">🎤</div>
            <h3>Voice Conversations</h3>
            <p>Natural voice interactions with real-time responses</p>
          </div>
          <div class="feature-card">
            <div class="feature-icon">💫</div>
            <h3>Live2D Avatars</h3>
            <p>Expressive animated characters that react to emotions</p>
          </div>
        </div>

        <!-- Quick Actions -->
        <div class="quick-actions">
          <RouterLink to="/chat" class="action-card">
            <span class="action-icon">💬</span>
            <span class="action-text">Start Conversation</span>
          </RouterLink>
          <RouterLink to="/characters/create" class="action-card">
            <span class="action-icon">✨</span>
            <span class="action-text">Create Character</span>
          </RouterLink>
          <RouterLink to="/settings" class="action-card">
            <span class="action-icon">⚙️</span>
            <span class="action-text">Settings</span>
          </RouterLink>
        </div>
      </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.dashboard {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.dashboard-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 3rem;
  padding: 1.5rem;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border-radius: 12px;
}

.header-content h1 {
  color: white;
  font-size: 2rem;
  font-weight: 700;
  margin: 0 0 0.5rem 0;
}

.user-name {
  color: rgba(255, 255, 255, 0.9);
  font-size: 1.125rem;
  margin: 0;
}

.sign-out-btn {
  padding: 0.75rem 1.5rem;
  background-color: rgba(255, 255, 255, 0.2);
  color: white;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.sign-out-btn:hover {
  background-color: rgba(255, 255, 255, 0.3);
}

.dashboard-content {
  background: white;
  border-radius: 16px;
  padding: 3rem;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

.hero {
  text-align: center;
  margin-bottom: 3rem;
}

.hero-text h2 {
  font-size: 2.5rem;
  font-weight: 700;
  color: #1a202c;
  margin-bottom: 1rem;
}

.hero-text p {
  font-size: 1.25rem;
  color: #6b7280;
  margin-bottom: 2rem;
  max-width: 600px;
  margin-left: auto;
  margin-right: auto;
}

.start-chat-btn {
  padding: 1rem 2.5rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 12px;
  font-size: 1.125rem;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
}

.start-chat-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(102, 126, 234, 0.4);
}

.features {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 2rem;
  margin-bottom: 3rem;
}

.feature-card {
  text-align: center;
  padding: 2rem;
  background: #f9fafb;
  border-radius: 12px;
  transition: transform 0.2s;
}

.feature-card:hover {
  transform: translateY(-4px);
}

.feature-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.feature-card h3 {
  font-size: 1.25rem;
  font-weight: 600;
  color: #1a202c;
  margin-bottom: 0.5rem;
}

.feature-card p {
  color: #6b7280;
  font-size: 0.95rem;
}

.quick-actions {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1.5rem;
}

.action-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  text-decoration: none;
  border-radius: 12px;
  transition: transform 0.2s, box-shadow 0.2s;
}

.action-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 20px rgba(102, 126, 234, 0.4);
}

.action-icon {
  font-size: 2.5rem;
  margin-bottom: 0.75rem;
}

.action-text {
  font-size: 1.125rem;
  font-weight: 600;
}

/* Loading State */
.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  text-align: center;
}

.loading-spinner {
  width: 60px;
  height: 60px;
  border: 4px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.loading-text {
  margin-top: 1.5rem;
  color: white;
  font-size: 1.25rem;
  font-weight: 500;
}

/* Error State */
.error-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  text-align: center;
  background: white;
  border-radius: 16px;
  padding: 3rem;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

.error-icon {
  font-size: 4rem;
  margin-bottom: 1rem;
}

.error-title {
  font-size: 2rem;
  font-weight: 700;
  color: #1a202c;
  margin-bottom: 1rem;
}

.error-message {
  font-size: 1.125rem;
  color: #6b7280;
  margin-bottom: 2rem;
  max-width: 500px;
}

.retry-btn {
  padding: 0.75rem 2rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.retry-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}
</style>
