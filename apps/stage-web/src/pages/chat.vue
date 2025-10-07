<script setup lang="ts">
import { ref } from 'vue'
import CharacterSelector from '@/components/CharacterSelector.vue'
import VoiceChat from '@/components/VoiceChat.vue'
import type { Character } from '@/services/api/characters'

const selectedCharacter = ref<Character | null>(null)
const showVoiceChat = ref(false)

function handleCharacterSelect(character: Character) {
  selectedCharacter.value = character
  showVoiceChat.value = true
}

function handleChatClose() {
  showVoiceChat.value = false
  selectedCharacter.value = null
}
</script>

<template>
  <div class="chat-page">
    <CharacterSelector
      v-if="!showVoiceChat"
      @select="handleCharacterSelect"
    />

    <VoiceChat
      v-if="showVoiceChat && selectedCharacter"
      :character="selectedCharacter"
      @close="handleChatClose"
    />
  </div>
</template>

<style scoped>
.chat-page {
  min-height: 100vh;
  overflow: hidden;
}
</style>
