<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useSession } from '@/lib/auth'
import { authClient } from '@/lib/auth'
import { useRouter } from 'vue-router'
import { getMVPCharacters, type Character } from '@/services/api/characters'

const router = useRouter()
const sessionData = useSession()
const session = computed(() => sessionData.value.data)
const user = computed(() => session.value?.user)
const isLoading = computed(() => sessionData.value.isPending)
const error = computed(() => sessionData.value.error)

// Character selection state
const characters = ref<Character[]>([])
const selectedCharacter = ref<Character | null>(null)
const loadingCharacters = ref(true)

async function handleSignOut() {
  await authClient.signOut()
  router.push('/')
}

function startConversation() {
  if (!selectedCharacter.value) {
    return
  }

  // Navigate to the main stage/chat interface with the selected character
  router.push({
    path: '/stage',
    query: { character: selectedCharacter.value.id },
  })
}

// Load characters on mount
onMounted(async () => {
  try {
    // For MVP: Use mock function to get Hiyori character
    const response = getMVPCharacters()
    characters.value = response.characters

    // Auto-select the first (and only) character for MVP
    if (characters.value.length > 0) {
      selectedCharacter.value = characters.value[0]
    }
  }
  catch (err) {
    console.error('Failed to load characters:', err)
  }
  finally {
    loadingCharacters.value = false
  }
})

function selectCharacter(character: Character) {
  selectedCharacter.value = character
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
        <button @click="router.push('/')" class="retry-btn">
          Return to Home
        </button>
      </div>

      <!-- Main Content (when loaded) -->
      <template v-else-if="user">
        <!-- Header -->
        <div class="dashboard-header">
          <div class="header-content">
            <div>
              <h1>Welcome to Mirai</h1>
              <p v-if="user" class="user-name">Hello, {{ user.name }}!</p>
            </div>
          </div>
          <div class="header-actions">
            <button @click="router.push('/account')" class="account-btn">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
              Account
            </button>
            <button @click="handleSignOut" class="sign-out-btn">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
              Sign Out
            </button>
          </div>
        </div>

        <!-- Main Content -->
        <div class="dashboard-content">
          <!-- Character Selection Section -->
          <div class="character-section">
            <div class="section-header">
              <h2>Select Your Companion</h2>
              <p>Choose a character to start your conversation</p>
            </div>

            <!-- Loading Characters -->
            <div v-if="loadingCharacters" class="characters-loading">
              <div class="spinner" />
              <p>Loading characters...</p>
            </div>

            <!-- Character Cards -->
            <div v-else class="characters-grid">
              <div
                v-for="character in characters"
                :key="character.id"
                class="character-card"
                :class="{ selected: selectedCharacter?.id === character.id }"
                @click="selectCharacter(character)"
              >
                <div class="character-visual">
                  <img
                    v-if="character.avatarThumbnail"
                    :src="character.avatarThumbnail"
                    :alt="character.displayName"
                    class="character-avatar"
                  />
                  <div v-else class="character-placeholder">
                    {{ character.displayName.charAt(0) }}
                  </div>
                  <div v-if="selectedCharacter?.id === character.id" class="selected-badge">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="white" stroke="white" stroke-width="2">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  </div>
                </div>
                <div class="character-info">
                  <h3>{{ character.displayName }}</h3>
                  <p class="dialogue-style">{{ character.personalityConfig.dialogueStyle }}</p>
                  <div class="traits">
                    <span
                      v-for="adjective in character.personalityConfig.adjectives"
                      :key="adjective"
                      class="trait-tag"
                    >
                      {{ adjective }}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Start Conversation Button -->
            <div class="action-section">
              <button
                @click="startConversation"
                :disabled="!selectedCharacter"
                class="start-conversation-btn"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
                Start Conversation with {{ selectedCharacter?.displayName || 'Character' }}
              </button>
            </div>
          </div>

          <!-- Quick Info Section -->
          <div class="info-section">
            <div class="info-card">
              <div class="info-icon">💬</div>
              <div class="info-content">
                <h4>Real-Time Voice Chat</h4>
                <p>Experience natural conversations with ultra-low latency</p>
              </div>
            </div>
            <div class="info-card">
              <div class="info-icon">💫</div>
              <div class="info-content">
                <h4>Live2D Avatars</h4>
                <p>Expressive animations that react to emotions</p>
              </div>
            </div>
            <div class="info-card">
              <div class="info-icon">🧠</div>
              <div class="info-content">
                <h4>Contextual Memory</h4>
                <p>Characters remember your conversations</p>
              </div>
            </div>
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
  max-width: 1400px;
  margin: 0 auto;
  padding: 2rem;
}

/* Header */
.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 3rem;
  padding: 1.5rem 2rem;
  background: rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(10px);
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.2);
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

.header-actions {
  display: flex;
  gap: 1rem;
  align-items: center;
}

.account-btn,
.sign-out-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  background-color: rgba(255, 255, 255, 0.2);
  color: white;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 12px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.account-btn:hover,
.sign-out-btn:hover {
  background-color: rgba(255, 255, 255, 0.3);
  transform: translateY(-2px);
}

/* Main Content */
.dashboard-content {
  background: white;
  border-radius: 20px;
  padding: 3rem;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

/* Character Section */
.character-section {
  margin-bottom: 3rem;
}

.section-header {
  text-align: center;
  margin-bottom: 2.5rem;
}

.section-header h2 {
  font-size: 2.5rem;
  font-weight: 800;
  color: #1a202c;
  margin-bottom: 0.5rem;
}

.section-header p {
  font-size: 1.125rem;
  color: #6b7280;
}

.characters-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 2rem;
}

.spinner {
  width: 50px;
  height: 50px;
  border: 4px solid #e5e7eb;
  border-top-color: #667eea;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 1rem;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.characters-loading p {
  color: #6b7280;
  font-size: 1rem;
}

.characters-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 2rem;
  margin-bottom: 2.5rem;
}

.character-card {
  background: #f9fafb;
  border-radius: 16px;
  padding: 2rem;
  cursor: pointer;
  transition: all 0.3s ease;
  border: 3px solid transparent;
  position: relative;
}

.character-card:hover {
  transform: translateY(-8px);
  box-shadow: 0 12px 40px rgba(102, 126, 234, 0.15);
}

.character-card.selected {
  border-color: #667eea;
  background: linear-gradient(135deg, #f0f4ff 0%, #e8efff 100%);
  box-shadow: 0 8px 30px rgba(102, 126, 234, 0.25);
}

.character-visual {
  position: relative;
  margin-bottom: 1.5rem;
}

.character-avatar {
  width: 100%;
  height: 200px;
  object-fit: cover;
  border-radius: 12px;
}

.character-placeholder {
  width: 100%;
  height: 200px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 5rem;
  font-weight: 800;
  color: white;
}

.selected-badge {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 40px;
  height: 40px;
  background: #667eea;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
  animation: badge-appear 0.3s ease;
}

@keyframes badge-appear {
  from {
    transform: scale(0);
  }
  to {
    transform: scale(1);
  }
}

.character-info h3 {
  font-size: 1.75rem;
  font-weight: 700;
  color: #1a202c;
  margin-bottom: 0.5rem;
}

.dialogue-style {
  color: #6b7280;
  font-size: 1rem;
  margin-bottom: 1rem;
}

.traits {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.trait-tag {
  background-color: #e8f4fd;
  color: #2c7db8;
  padding: 0.4rem 1rem;
  border-radius: 20px;
  font-size: 0.875rem;
  font-weight: 600;
}

/* Action Section */
.action-section {
  text-align: center;
}

.start-conversation-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1.25rem 3rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 16px;
  font-size: 1.25rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 8px 30px rgba(102, 126, 234, 0.3);
}

.start-conversation-btn:hover:not(:disabled) {
  transform: translateY(-4px);
  box-shadow: 0 12px 40px rgba(102, 126, 234, 0.4);
}

.start-conversation-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

/* Info Section */
.info-section {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1.5rem;
  padding-top: 2rem;
  border-top: 2px solid #e5e7eb;
}

.info-card {
  display: flex;
  gap: 1rem;
  padding: 1.5rem;
  background: #f9fafb;
  border-radius: 12px;
  transition: transform 0.2s;
}

.info-card:hover {
  transform: translateY(-4px);
}

.info-icon {
  font-size: 2.5rem;
  flex-shrink: 0;
}

.info-content h4 {
  font-size: 1.125rem;
  font-weight: 700;
  color: #1a202c;
  margin-bottom: 0.25rem;
}

.info-content p {
  font-size: 0.95rem;
  color: #6b7280;
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
  border-radius: 20px;
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
  border-radius: 12px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.retry-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

@media (max-width: 768px) {
  .dashboard-header {
    flex-direction: column;
    gap: 1rem;
  }

  .section-header h2 {
    font-size: 2rem;
  }

  .characters-grid {
    grid-template-columns: 1fr;
  }
}
</style>
