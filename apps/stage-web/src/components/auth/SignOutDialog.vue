<script setup lang="ts">
import { Button } from '@proj-airi/stage-ui/components'
import {
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogRoot,
  AlertDialogTitle,
} from 'reka-ui'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

interface Props {
  modelValue: boolean
}

defineProps<Props>()
const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'confirm'): void
  (e: 'cancel'): void
}>()

const { t } = useI18n()
const isLoading = ref(false)

function handleCancel() {
  if (isLoading.value) return
  emit('update:modelValue', false)
  emit('cancel')
}

async function handleConfirm() {
  isLoading.value = true
  emit('confirm')
}
</script>

<template>
  <AlertDialogRoot :open="modelValue" @update:open="!isLoading && emit('update:modelValue', $event)">
    <AlertDialogPortal>
      <AlertDialogOverlay class="fixed inset-0 z-100 bg-black/50 data-[state=closed]:animate-fadeOut data-[state=open]:animate-fadeIn" />
      <AlertDialogContent
        class="fixed left-1/2 top-1/2 z-100 max-w-md w-full border border-neutral-200 rounded-xl bg-white p-6 shadow-xl -translate-x-1/2 -translate-y-1/2 data-[state=closed]:animate-contentHide data-[state=open]:animate-contentShow dark:border-neutral-700 dark:bg-neutral-800"
      >
        <AlertDialogTitle class="mb-4 text-xl font-normal">
          {{ t('settings.auth.sign_out_title') }}
        </AlertDialogTitle>
        <AlertDialogDescription class="mb-6 text-neutral-600 dark:text-neutral-400">
          {{ t('settings.auth.sign_out_confirmation') }}
        </AlertDialogDescription>

        <div class="flex flex-row justify-end gap-3">
          <AlertDialogCancel as-child>
            <Button
              variant="secondary"
              :label="t('base.general.cancel')"
              :disabled="isLoading"
              @click="handleCancel"
            />
          </AlertDialogCancel>
          <AlertDialogAction as-child>
            <Button
              variant="danger"
              :label="isLoading ? t('settings.auth.signing_out') : t('settings.auth.sign_out')"
              :disabled="isLoading"
              @click="handleConfirm"
            >
              <template v-if="isLoading" #icon>
                <div class="i-solar:loading-bold-duotone animate-spin" />
              </template>
            </Button>
          </AlertDialogAction>
        </div>
      </AlertDialogContent>
    </AlertDialogPortal>
  </AlertDialogRoot>
</template>