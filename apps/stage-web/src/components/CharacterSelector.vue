<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { getCharacters, type Character } from '@/services/api/characters'

const emit = defineEmits<{
  select: [character: Character]
}>()

const characters = ref<Character[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const selectedCharacter = ref<Character | null>(null)

onMounted(async () => {
  try {
    const response = await getCharacters()
    characters.value = response.characters
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load characters'
  } finally {
    loading.value = false
  }
})

function selectCharacter(character: Character) {
  selectedCharacter.value = character
  emit('select', character)
}
</script>

<template>
  <div class="character-selector">
    <h2>Choose Your Companion</h2>

    <div v-if="loading" class="loading">
      <div class="spinner" />
      <p>Loading characters...</p>
    </div>

    <div v-else-if="error" class="error">
      <p>{{ error }}</p>
      <button @click="() => window.location.reload()">Retry</button>
    </div>

    <div v-else-if="characters.length === 0" class="empty">
      <p>You don't have any characters yet.</p>
      <RouterLink to="/characters/create">Create Your First Character</RouterLink>
    </div>

    <div v-else class="character-grid">
      <div
        v-for="character in characters"
        :key="character.id"
        class="character-card"
        :class="{ selected: selectedCharacter?.id === character.id }"
        @click="selectCharacter(character)"
      >
        <img
          :src="character.avatarThumbnail || '/default-avatar.png'"
          :alt="character.displayName"
        />
        <h3>{{ character.displayName }}</h3>
        <p class="personality">{{ character.personalityConfig.dialogueStyle }}</p>
        <div class="traits">
          <span
            v-for="adjective in character.personalityConfig.adjectives.slice(0, 3)"
            :key="adjective"
            class="trait"
          >
            {{ adjective }}
          </span>
        </div>
        <p class="conversations">
          {{ character.totalConversations }} conversations
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.character-selector {
  padding: 2rem;
  max-width: 1200px;
  margin: 0 auto;
}

.character-selector h2 {
  text-align: center;
  font-size: 2rem;
  font-weight: 700;
  margin-bottom: 2rem;
  color: #1a202c;
}

.loading {
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

.loading p {
  color: #6b7280;
  font-size: 1rem;
}

.error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 2rem;
  text-align: center;
}

.error p {
  color: #ef4444;
  font-size: 1rem;
  margin-bottom: 1rem;
}

.error button {
  padding: 0.75rem 1.5rem;
  background-color: #667eea;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.2s;
}

.error button:hover {
  background-color: #5568d3;
}

.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 2rem;
  text-align: center;
}

.empty p {
  color: #6b7280;
  font-size: 1.125rem;
  margin-bottom: 1.5rem;
}

.empty a {
  padding: 0.75rem 1.5rem;
  background-color: #667eea;
  color: white;
  text-decoration: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  transition: background-color 0.2s;
}

.empty a:hover {
  background-color: #5568d3;
}

.character-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 1.5rem;
  margin-top: 2rem;
}

.character-card {
  border: 2px solid #e0e0e0;
  border-radius: 12px;
  padding: 1rem;
  cursor: pointer;
  transition: all 0.2s ease;
  background: white;
}

.character-card:hover {
  border-color: #667eea;
  transform: translateY(-4px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.2);
}

.character-card.selected {
  border-color: #667eea;
  background-color: #f0f8ff;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}

.character-card img {
  width: 100%;
  height: 200px;
  object-fit: cover;
  border-radius: 8px;
  margin-bottom: 1rem;
}

.character-card h3 {
  font-size: 1.25rem;
  font-weight: 600;
  color: #1a202c;
  margin-bottom: 0.5rem;
}

.personality {
  color: #6b7280;
  font-size: 0.9rem;
  margin-bottom: 0.75rem;
}

.traits {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-bottom: 0.75rem;
}

.trait {
  background-color: #e8f4fd;
  color: #2c7db8;
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.8rem;
  font-weight: 500;
}

.conversations {
  color: #9ca3af;
  font-size: 0.85rem;
  margin-top: 0.5rem;
}
</style>
