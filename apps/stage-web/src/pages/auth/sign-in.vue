<script setup lang="ts">
import { ref } from 'vue'
import { authClient } from '@/lib/auth'
import { useRouter } from 'vue-router'

const router = useRouter()
const email = ref('')
const password = ref('')
const error = ref<string | null>(null)
const loading = ref(false)

async function handleSignIn() {
  loading.value = true
  error.value = null

  try {
    const { data, error: signInError } = await authClient.signIn.email({
      email: email.value,
      password: password.value,
      callbackURL: '/dashboard',
    })

    if (signInError) {
      error.value = signInError.message
      return
    }

    router.push('/dashboard')
  } catch (err) {
    error.value = 'An unexpected error occurred'
    console.error('Sign in error:', err)
  } finally {
    loading.value = false
  }
}

// Social sign-in (optional)
async function handleGoogleSignIn() {
  await authClient.signIn.social({
    provider: 'google',
    callbackURL: '/dashboard',
  })
}

async function handleDiscordSignIn() {
  await authClient.signIn.social({
    provider: 'discord',
    callbackURL: '/dashboard',
  })
}
</script>

<template>
  <div class="auth-container">
    <div class="auth-card">
      <div class="auth-header">
        <h1>Welcome Back</h1>
        <p>Sign in to your Mirai account</p>
      </div>

      <form @submit.prevent="handleSignIn" class="auth-form">
        <div class="form-group">
          <label for="email">Email</label>
          <input
            id="email"
            v-model="email"
            type="email"
            placeholder="you@example.com"
            required
            autocomplete="email"
          />
        </div>

        <div class="form-group">
          <label for="password">Password</label>
          <input
            id="password"
            v-model="password"
            type="password"
            placeholder="••••••••"
            required
            autocomplete="current-password"
          />
        </div>

        <button type="submit" :disabled="loading" class="btn-primary">
          {{ loading ? 'Signing in...' : 'Sign In' }}
        </button>

        <p v-if="error" class="error-message">{{ error }}</p>
      </form>

      <div class="divider">
        <span>or</span>
      </div>

      <div class="social-auth">
        <button @click="handleGoogleSignIn" type="button" class="btn-social">
          <span>Continue with Google</span>
        </button>
        <button @click="handleDiscordSignIn" type="button" class="btn-social">
          <span>Continue with Discord</span>
        </button>
      </div>

      <div class="auth-footer">
        <p>
          Don't have an account?
          <RouterLink to="/auth/sign-up">Sign up</RouterLink>
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.auth-container {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 2rem;
}

.auth-card {
  width: 100%;
  max-width: 450px;
  background: white;
  border-radius: 16px;
  padding: 3rem;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

.auth-header {
  text-align: center;
  margin-bottom: 2rem;
}

.auth-header h1 {
  font-size: 2rem;
  font-weight: 700;
  color: #1a202c;
  margin-bottom: 0.5rem;
}

.auth-header p {
  color: #718096;
  font-size: 1rem;
}

.auth-form {
  margin-bottom: 2rem;
}

.form-group {
  margin-bottom: 1.5rem;
}

.form-group label {
  display: block;
  font-size: 0.875rem;
  font-weight: 600;
  color: #374151;
  margin-bottom: 0.5rem;
}

.form-group input {
  width: 100%;
  padding: 0.75rem 1rem;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  font-size: 1rem;
  transition: border-color 0.2s;
}

.form-group input:focus {
  outline: none;
  border-color: #667eea;
}

.btn-primary {
  width: 100%;
  padding: 0.875rem 1.5rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(102, 126, 234, 0.4);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.error-message {
  margin-top: 1rem;
  padding: 0.75rem;
  background-color: #fee;
  color: #c00;
  border-radius: 8px;
  font-size: 0.875rem;
  text-align: center;
}

.divider {
  position: relative;
  text-align: center;
  margin: 2rem 0;
}

.divider::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 0;
  right: 0;
  height: 1px;
  background-color: #e5e7eb;
}

.divider span {
  position: relative;
  background: white;
  padding: 0 1rem;
  color: #9ca3af;
  font-size: 0.875rem;
}

.social-auth {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.btn-social {
  width: 100%;
  padding: 0.875rem 1.5rem;
  background: white;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: border-color 0.2s, background-color 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
}

.btn-social:hover {
  border-color: #667eea;
  background-color: #f9fafb;
}

.auth-footer {
  margin-top: 2rem;
  text-align: center;
  font-size: 0.875rem;
  color: #6b7280;
}

.auth-footer a {
  color: #667eea;
  font-weight: 600;
  text-decoration: none;
}

.auth-footer a:hover {
  text-decoration: underline;
}
</style>
