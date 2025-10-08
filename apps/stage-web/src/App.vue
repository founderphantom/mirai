<script setup lang="ts">
import { OnboardingDialog, ToasterRoot } from '@proj-airi/stage-ui/components'
import { useConfiguratorForAiriSdk } from '@proj-airi/stage-ui/stores/configurator'
import { useDisplayModelsStore } from '@proj-airi/stage-ui/stores/display-models'
import { useOnboardingStore } from '@proj-airi/stage-ui/stores/onboarding'
import { useSettings } from '@proj-airi/stage-ui/stores/settings'
import { StageTransitionGroup } from '@proj-airi/ui-transitions'
import { useDark } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { computed, onMounted, onUnmounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterView, useRouter } from 'vue-router'
import { toast, Toaster } from 'vue-sonner'

import { useSession } from './lib/auth'
import { usePWAStore } from './stores/pwa'

import 'vue-sonner/style.css'

usePWAStore()
const i18n = useI18n()
const router = useRouter()
const displayModelsStore = useDisplayModelsStore()
const settingsStore = useSettings()
const settings = storeToRefs(settingsStore)
const onboardingStore = useOnboardingStore()
const { shouldShowSetup } = storeToRefs(onboardingStore)
const isDark = useDark()
const { dispose } = useConfiguratorForAiriSdk()

// Better-Auth session management
const sessionData = useSession()
const session = computed(() => sessionData.value.data)
const isSessionPending = computed(() => sessionData.value.isPending)
const isAuthenticated = computed(() => !!session.value?.user)

const primaryColor = computed(() => {
  return isDark.value
    ? `color-mix(in srgb, oklch(95% var(--chromatic-chroma-900) calc(var(--chromatic-hue) + ${0})) 70%, oklch(50% 0 360))`
    : `color-mix(in srgb, oklch(95% var(--chromatic-chroma-900) calc(var(--chromatic-hue) + ${0})) 90%, oklch(90% 0 360))`
})

const secondaryColor = computed(() => {
  return isDark.value
    ? `color-mix(in srgb, oklch(95% var(--chromatic-chroma-900) calc(var(--chromatic-hue) + ${180})) 70%, oklch(50% 0 360))`
    : `color-mix(in srgb, oklch(95% var(--chromatic-chroma-900) calc(var(--chromatic-hue) + ${180})) 90%, oklch(90% 0 360))`
})

const tertiaryColor = computed(() => {
  return isDark.value
    ? `color-mix(in srgb, oklch(95% var(--chromatic-chroma-900) calc(var(--chromatic-hue) + ${60})) 70%, oklch(50% 0 360))`
    : `color-mix(in srgb, oklch(95% var(--chromatic-chroma-900) calc(var(--chromatic-hue) + ${60})) 90%, oklch(90% 0 360))`
})

const colors = computed(() => {
  return [primaryColor.value, secondaryColor.value, tertiaryColor.value, isDark.value ? '#121212' : '#FFFFFF']
})

watch(settings.language, () => {
  i18n.locale.value = settings.language.value
})

watch(settings.themeColorsHue, () => {
  document.documentElement.style.setProperty('--chromatic-hue', settings.themeColorsHue.value.toString())
}, { immediate: true })

watch(settings.themeColorsHueDynamic, () => {
  document.documentElement.classList.toggle('dynamic-hue', settings.themeColorsHueDynamic.value)
}, { immediate: true })

// Watch authentication state and handle redirects
watch(
  () => [isSessionPending.value, isAuthenticated.value, router.currentRoute.value.path] as const,
  ([pending, authenticated, path]) => {
    // Wait for session check to complete
    if (pending)
      return

    // Ensure path is a string
    const currentPath = typeof path === 'string' ? path : '/'

    // Define routes that don't require authentication
    const publicRoutes = ['/auth/sign-in', '/auth/sign-up', '/']
    const isPublicRoute = publicRoutes.includes(currentPath)

    // Redirect to sign-in if not authenticated and trying to access protected route
    if (!authenticated && !isPublicRoute) {
      router.push({
        path: '/auth/sign-in',
        query: { redirect: currentPath },
      })
    }

    // Redirect to home if authenticated and on auth page
    if (authenticated && (currentPath === '/auth/sign-in' || currentPath === '/auth/sign-up')) {
      const redirect = router.currentRoute.value.query.redirect as string
      router.push(redirect || '/')
    }
  },
  { immediate: true },
)

// Initialize first-time setup check when app mounts
onMounted(async () => {
  onboardingStore.initializeSetupCheck()

  await displayModelsStore.loadDisplayModelsFromIndexedDB()
  await settingsStore.initializeStageModel()
})

onUnmounted(() => {
  dispose()
})

// Handle first-time setup events
function handleSetupConfigured() {
  onboardingStore.markSetupCompleted()
}

function handleSetupSkipped() {
  onboardingStore.markSetupSkipped()
}
</script>

<template>
  <!-- Loading state while checking authentication -->
  <div v-if="isSessionPending" class="flex h-screen w-screen items-center justify-center">
    <div class="text-center">
      <div class="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
      <p class="text-muted-foreground">Loading...</p>
    </div>
  </div>

  <!-- Main app content after authentication check -->
  <template v-else>
    <StageTransitionGroup
      :primary-color="primaryColor"
      :secondary-color="secondaryColor"
      :tertiary-color="tertiaryColor"
      :colors="colors"
      :z-index="100"
      :disable-transitions="settings.disableTransitions.value"
      :use-page-specific-transitions="settings.usePageSpecificTransitions.value"
    >
      <RouterView v-slot="{ Component }">
        <KeepAlive :include="['IndexScenePage', 'StageScenePage']">
          <component :is="Component" />
        </KeepAlive>
      </RouterView>
    </StageTransitionGroup>

    <ToasterRoot @close="id => toast.dismiss(id)">
      <Toaster />
    </ToasterRoot>

    <!-- First Time Setup Dialog -->
    <OnboardingDialog
      v-model="shouldShowSetup"
      @configured="handleSetupConfigured"
      @skipped="handleSetupSkipped"
    />
  </template>
</template>

<style>
/* We need this to properly animate the CSS variable */
@property --chromatic-hue {
  syntax: '<number>';
  initial-value: 0;
  inherits: true;
}

@keyframes hue-anim {
  from {
    --chromatic-hue: 0;
  }
  to {
    --chromatic-hue: 360;
  }
}

.dynamic-hue {
  animation: hue-anim 10s linear infinite;
}
</style>
