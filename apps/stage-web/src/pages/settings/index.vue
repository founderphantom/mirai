<script setup lang="ts">
import { IconItem } from '@proj-airi/stage-ui/components'
import { useSettings } from '@proj-airi/stage-ui/stores/settings'
import { computed, nextTick, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'

import SignOutDialog from '../../components/auth/SignOutDialog.vue'
import IconAnimation from '../../components/IconAnimation.vue'
import { useAuth } from '@/composables/useAuth'

const router = useRouter()
const iconAnimationStarted = ref(false)
const iconAnimation = ref<InstanceType<typeof IconAnimation>>()
const resolveAnimation = ref<() => void>()
const { t } = useI18n()
const { signOut, isAuthenticated } = useAuth()

const animationIcon = ref('')
const animationPosition = ref('')
const showAnimationComponent = ref(false)
const settingsStore = useSettings()
const showSignOutDialog = ref(false)

function handleAnimationEnded() {
  resolveAnimation.value?.()
}

async function handleIconItemClick(event: MouseEvent, setting: typeof settings.value[0]) {
  const target = event.currentTarget as HTMLElement
  const iconElement = target.querySelector('.menu-icon-item-icon') as HTMLElement
  if (!iconElement)
    return

  // get the position of the icon element
  const rect = iconElement.getBoundingClientRect()
  const position = `${rect.left}px, ${rect.top}px`

  // set the icon and position
  animationIcon.value = setting.icon
  animationPosition.value = position

  // show the animation component
  showAnimationComponent.value = true

  // wait for the DOM to update
  await nextTick()

  // start the animation
  iconAnimationStarted.value = true
}

const removeBeforeEach = router.beforeEach(async (_, __, next) => {
  if (!settingsStore.usePageSpecificTransitions || settingsStore.disableTransitions) {
    next()
    return
  }

  await new Promise<void>((resolve) => {
    resolveAnimation.value = resolve
  })
  removeBeforeEach()
  next()
})

const settings = computed(() => [
  {
    title: t('settings.pages.card.title'),
    description: t('settings.pages.card.description'),
    icon: 'i-solar:emoji-funny-square-bold-duotone',
    to: '/settings/airi-card',
  },
  {
    title: t('settings.pages.modules.title'),
    description: t('settings.pages.modules.description'),
    icon: 'i-solar:layers-bold-duotone',
    to: '/settings/modules',
  },
  {
    title: t('settings.pages.scene.title'),
    description: t('settings.pages.scene.description'),
    icon: 'i-solar:armchair-2-bold-duotone',
    to: '/settings/scene',
  },
  {
    title: t('settings.pages.models.title'),
    description: t('settings.pages.models.description'),
    icon: 'i-solar:people-nearby-bold-duotone',
    to: '/settings/models',
  },
  {
    title: t('settings.pages.memory.title'),
    description: t('settings.pages.memory.description'),
    icon: 'i-solar:leaf-bold-duotone',
    to: '/settings/memory',
  },
  {
    title: t('settings.pages.providers.title'),
    description: t('settings.pages.providers.description'),
    icon: 'i-solar:box-minimalistic-bold-duotone',
    to: '/settings/providers',
  },
  {
    title: t('settings.pages.system.title'),
    description: t('settings.pages.system.description'),
    icon: 'i-solar:filters-bold-duotone',
    to: '/settings/system',
  },
])

async function handleSignOut() {
  const { error } = await signOut()
  if (error) {
    toast.error(t('settings.auth.sign_out_error'))
  } else {
    toast.success(t('settings.auth.sign_out_success'))
  }
  showSignOutDialog.value = false
}
</script>

<template>
  <div flex="~ col gap-4" font-normal>
    <div />
    <div flex="~ col gap-4" pb-12>
      <IconItem
        v-for="(setting, index) in settings"
        :key="setting.to"
        v-motion
        :initial="{ opacity: 0, y: 10 }"
        :enter="{ opacity: 1, y: 0 }"
        :duration="250"
        :style="{
          transitionDelay: `${index * 50}ms`, // delay between each item, unocss doesn't support dynamic generation of classes now
        }"
        :title="setting.title"
        :description="setting.description"
        :icon="setting.icon"
        :to="setting.to"
        @click="(e: MouseEvent) => handleIconItemClick(e, setting)"
      />
      
      <!-- Sign Out Section -->
      <div v-if="isAuthenticated" class="mt-8 pt-8 border-t border-neutral-200 dark:border-neutral-700">
        <div class="flex justify-center">
          <button
            class="flex items-center gap-2 px-6 py-3 text-error-500 dark:text-error-400 font-semibold bg-transparent border-2 border-error-500 dark:border-error-400 rounded-xl hover:bg-error-500 dark:hover:bg-error-400 hover:text-white dark:hover:text-white hover:shadow-lg transform hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-error-500 dark:focus:ring-error-400 focus:ring-offset-2"
            @click="showSignOutDialog = true"
          >
            <div class="i-solar:logout-2-bold-duotone text-lg" />
            <span>{{ t('settings.auth.sign_out') }}</span>
          </button>
        </div>
      </div>
    </div>
    <IconAnimation
      v-if="showAnimationComponent && !settingsStore.disableTransitions && settingsStore.usePageSpecificTransitions"
      ref="iconAnimation"
      :icon="animationIcon"
      :icon-size="6 * 1.2"
      :position="animationPosition"
      :duration="1000"
      text-color="text-neutral-400/50 dark:text-neutral-600/20"
      :started="iconAnimationStarted"
      @animation-ended.once="handleAnimationEnded"
    />
    <div
      v-else
      v-motion
      text="neutral-200/50 dark:neutral-600/20" pointer-events-none
      fixed top="[calc(100dvh-12rem)]" bottom-0 right--10 z--1
      :initial="{ scale: 0.9, opacity: 0, rotate: 180 }"
      :enter="{ scale: 1, opacity: 1, rotate: 0 }"
      :duration="500"
      size-60
      flex items-center justify-center
    >
      <div v-motion text="60" i-solar:settings-bold-duotone />
    </div>
    
    <!-- Sign Out Confirmation Dialog -->
    <SignOutDialog
      v-model="showSignOutDialog"
      @confirm="handleSignOut"
      @cancel="showSignOutDialog = false"
    />
  </div>
</template>

<route lang="yaml">
meta:
  layout: settings
  stageTransition:
    name: slide
</route>
