import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { useBeatSyncStore } from '../stores/beat-sync'
import { useDiscordStore } from '../stores/modules/discord'
import { useFactorioStore } from '../stores/modules/gaming-factorio'
import { useMinecraftStore } from '../stores/modules/gaming-minecraft'
import { useSpeechStore } from '../stores/modules/speech'
import { useTwitterStore } from '../stores/modules/twitter'

export interface Module {
  id: string
  name: string
  description: string
  icon?: string
  iconColor?: string
  iconImage?: string
  to: string
  configured: boolean
  category: string
}

export function useModulesList() {
  const { t } = useI18n()

  // Initialize stores
  const speechStore = useSpeechStore()
  const discordStore = useDiscordStore()
  const twitterStore = useTwitterStore()
  const minecraftStore = useMinecraftStore()
  const factorioStore = useFactorioStore()
  const beatSyncStore = useBeatSyncStore()

  const modulesList = computed<Module[]>(() => [
    {
      id: 'speech',
      name: t('settings.pages.modules.speech.title'),
      description: t('settings.pages.modules.speech.description'),
      icon: 'i-solar:user-speak-rounded-bold-duotone',
      to: '/settings/modules/speech',
      configured: speechStore.configured,
      category: 'essential',
    },
    {
      id: 'messaging-discord',
      name: t('settings.pages.modules.messaging-discord.title'),
      description: t('settings.pages.modules.messaging-discord.description'),
      icon: 'i-simple-icons:discord',
      to: '/settings/modules/messaging-discord',
      configured: discordStore.configured,
      category: 'messaging',
    },
    {
      id: 'x',
      name: t('settings.pages.modules.x.title'),
      description: t('settings.pages.modules.x.description'),
      icon: 'i-simple-icons:x',
      to: '/settings/modules/x',
      configured: twitterStore.configured,
      category: 'messaging',
    },
    {
      id: 'gaming-minecraft',
      name: t('settings.pages.modules.gaming-minecraft.title'),
      description: t('settings.pages.modules.gaming-minecraft.description'),
      iconColor: 'i-vscode-icons:file-type-minecraft',
      to: '/settings/modules/gaming-minecraft',
      configured: minecraftStore.configured,
      category: 'gaming',
    },
    {
      id: 'gaming-factorio',
      name: t('settings.pages.modules.gaming-factorio.title'),
      description: t('settings.pages.modules.gaming-factorio.description'),
      to: '/settings/modules/gaming-factorio',
      configured: factorioStore.configured,
      category: 'gaming',
    },
    {
      id: 'mcp-server',
      name: t('settings.pages.modules.mcp-server.title'),
      description: t('settings.pages.modules.mcp-server.description'),
      icon: 'i-solar:server-bold-duotone',
      to: '/settings/modules/mcp',
      configured: false,
      category: 'essential',
    },
    {
      id: 'beat-sync',
      name: t('settings.pages.modules.beat_sync.title'),
      description: t('settings.pages.modules.beat_sync.description'),
      icon: 'i-solar:music-notes-bold-duotone',
      to: '/settings/modules/beat-sync',
      configured: beatSyncStore.isActive,
      category: 'essential',
    },
  ])

  const categorizedModules = computed(() => {
    return modulesList.value.reduce((categories, module) => {
      const { category } = module
      if (!categories[category]) {
        categories[category] = []
      }
      categories[category].push(module)
      return categories
    }, {} as Record<string, Module[]>)
  })

  // Define category display names
  const categoryNames = computed(() => ({
    essential: t('settings.pages.modules.categories.essential'),
    messaging: t('settings.pages.modules.categories.messaging'),
    gaming: t('settings.pages.modules.categories.gaming'),
  }))

  return {
    modulesList,
    categorizedModules,
    categoryNames,
  }
}
