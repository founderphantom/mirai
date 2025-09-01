<template>
  <AuthLayout>
    <LoginForm />
  </AuthLayout>
</template>

<script setup lang="ts">
import AuthLayout from '@/layouts/AuthLayout.vue'
import LoginForm from '@/components/auth/LoginForm.vue'
import { useAuthGuard } from '@/composables/useAuth'
import { onMounted } from 'vue'

// Redirect if already authenticated
const { requireGuest } = useAuthGuard()

onMounted(async () => {
  await requireGuest()
})
</script>

<route lang="yaml">
meta:
  layout: false
  requiresAuth: false
  title: Sign In - AIRI
</route>