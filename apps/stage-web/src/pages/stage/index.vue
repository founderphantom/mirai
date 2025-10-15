<script setup lang="ts">
import { WidgetStage } from '@proj-airi/stage-ui/components/scenes'
import { useLive2d } from '@proj-airi/stage-ui/stores/live2d'
import { breakpointsTailwind, useBreakpoints, useDark, useMouse } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { onMounted, ref, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'

import Cross from '../../components/Backgrounds/Cross.vue'
import Header from '../../components/Layouts/Header.vue'
import MobileHeader from '../../components/Layouts/MobileHeader.vue'
import AnimatedWave from '../../components/Widgets/AnimatedWave.vue'
import VoiceChat from '../../components/VoiceChat.vue'

import { themeColorFromPropertyOf, useThemeColor } from '../../composables/theme-color'
import { getCharacter, getAllCharacters } from '../../services/api/characters'
import type { Character } from '../../services/api/characters'
import { useSettings } from '@proj-airi/stage-ui/stores/settings'

const router = useRouter()
const route = useRoute()
const dark = useDark()
const paused = ref(false)

// Voice chat integration
const character = ref<Character | null>(null)
const showVoiceChat = ref(true)
const loadingCharacter = ref(true)

// Live2D store for emotion control
const live2dStore = useLive2d()

// Handle emotion updates from voice chat
function handleEmotionUpdate(emotion: string, _intensity: number) {
  // Map emotions to Live2D motions
  const emotionMotionMap: Record<string, string> = {
    'JOY': 'Tap@Body',
    'SADNESS': 'Idle',
    'ANGER': 'Idle',
    'FEAR': 'Idle',
    'SURPRISE': 'Tap@Body',
    'NEUTRAL': 'Idle',
  }

  const motionName = emotionMotionMap[emotion.toUpperCase()] || 'Idle'

  // Update Live2D motion via store
  live2dStore.currentMotion = {
    group: motionName,
    index: 0,
  }
}

function handleChatClose() {
  showVoiceChat.value = false
  router.push('/dashboard')
}

const positionCursor = useMouse()
const { scale, position, positionInPercentageString } = storeToRefs(useLive2d())
const breakpoints = useBreakpoints(breakpointsTailwind)
const isMobile = breakpoints.smaller('md')

// Settings store for updating Live2D model URL
const settingsStore = useSettings()

const { updateThemeColor } = useThemeColor(themeColorFromPropertyOf('.widgets.top-widgets .colored-area', 'background-color'))
watch(dark, () => updateThemeColor(), { immediate: true })

// Load character on mount
onMounted(async () => {
  updateThemeColor()

  try {
    const characterId = route.query.character as string

    if (characterId) {
      // Fetch specific character by ID
      character.value = await getCharacter(characterId)
    } else {
      // Fallback: fetch all characters and use the first preset
      const response = await getAllCharacters()
      const presetCharacter = response.characters.find(c => c.isPreset)
      character.value = presetCharacter || response.characters[0] || null
    }

    // Update the Live2D model in the settings store based on loaded character
    if (character.value?.live2dModelKey) {
      const modelKey = character.value.live2dModelKey

      // Construct the full model URL based on where it's stored
      let modelUrl: string

      if (modelKey.startsWith('users/')) {
        // Private user asset - requires auth
        modelUrl = `/api/assets/${modelKey}`
      } else {
        // Public/preset model - served from frontend worker's R2 bucket
        modelUrl = `/assets/live2d/models/${modelKey}`
      }

      console.log('[Stage] Setting Live2D model URL:', modelUrl)
      settingsStore.stageModelSelectedUrl = modelUrl
      settingsStore.stageModelRenderer = 'live2d'
    }
  } catch (error) {
    console.error('Failed to load character:', error)
    // Redirect back to dashboard if character loading fails
    router.push('/dashboard')
  } finally {
    loadingCharacter.value = false
  }
})
</script>

<template>
  <Cross>
    <AnimatedWave
      class="widgets top-widgets"
      :fill-color="dark
        ? 'oklch(35% calc(var(--chromatic-chroma) * 0.6) var(--chromatic-hue))'
        : 'color-mix(in srgb, oklch(95% calc(var(--chromatic-chroma-50) * 0.5) var(--chromatic-hue)) 80%, oklch(100% 0 360))'"
    >
      <div relative flex="~ col" z-2 h-100dvh w-100vw of-hidden>
        <!-- header -->
        <div class="px-0 py-1 md:px-3 md:py-3" w-full gap-2>
          <Header class="hidden md:flex" />
          <MobileHeader class="flex md:hidden" />
        </div>
        <!-- page -->
        <div relative flex="~ 1 row gap-y-0 gap-x-2 <md:col">
          <WidgetStage
            flex-1 min-w="1/2"
            :paused="paused"
            :focus-at="{
              x: positionCursor.x.value,
              y: positionCursor.y.value,
            }"
            :x-offset="`${isMobile ? position.x : position.x - 10}%`"
            :y-offset="positionInPercentageString.y"
            :scale="scale"
          />
          <div v-if="showVoiceChat && character" h="85dvh" absolute right-4 flex flex-1 flex-col max-w="500px" min-w="30%">
            <VoiceChat
              :character="character"
              @close="handleChatClose"
              @emotion="handleEmotionUpdate"
            />
          </div>
        </div>
      </div>
    </AnimatedWave>
  </Cross>
</template>

<route lang="yaml">
name: StageScenePage
meta:
  layout: stage
  stageTransition:
    name: bubble-wave-out
</route>
