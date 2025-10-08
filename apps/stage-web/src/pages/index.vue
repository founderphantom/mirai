<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useSession } from '@/lib/auth'
import { computed, watch } from 'vue'

const router = useRouter()
const sessionData = useSession()
const isAuthenticated = computed(() => !!sessionData.value.data?.user)

// Redirect authenticated users to dashboard
watch(isAuthenticated, (authenticated) => {
  if (authenticated) {
    router.push('/dashboard')
  }
}, { immediate: true })

function navigateToSignIn() {
  router.push('/auth/sign-in')
}

function navigateToSignUp() {
  router.push('/auth/sign-up')
}
</script>

<template>
  <div class="landing-page">
    <!-- Hero Section -->
    <div class="hero-section">
      <div class="hero-content">
        <div class="hero-text">
          <div class="logo-container">
            <h1 class="brand-name">Mirai</h1>
            <p class="tagline">Your AI Companion Platform</p>
          </div>

          <h2 class="hero-title">
            Connect with AI Characters Through <span class="gradient-text">Voice Conversations</span>
          </h2>

          <p class="hero-description">
            Experience immersive interactions with AI companions powered by advanced natural language processing,
            real-time voice synthesis, and expressive Live2D avatars.
          </p>

          <div class="cta-buttons">
            <button @click="navigateToSignUp" class="cta-primary">
              Get Started
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </button>
            <button @click="navigateToSignIn" class="cta-secondary">
              Sign In
            </button>
          </div>
        </div>

        <div class="hero-visual">
          <div class="floating-card card-1">
            <div class="card-icon">🎭</div>
            <div class="card-text">Multiple Characters</div>
          </div>
          <div class="floating-card card-2">
            <div class="card-icon">🎤</div>
            <div class="card-text">Voice Conversations</div>
          </div>
          <div class="floating-card card-3">
            <div class="card-icon">💫</div>
            <div class="card-text">Live2D Avatars</div>
          </div>
          <div class="gradient-orb orb-1"></div>
          <div class="gradient-orb orb-2"></div>
        </div>
      </div>
    </div>

    <!-- Features Section -->
    <div class="features-section">
      <div class="features-container">
        <h2 class="section-title">Powerful Features</h2>
        <p class="section-subtitle">Everything you need for meaningful AI interactions</p>

        <div class="features-grid">
          <div class="feature-card">
            <div class="feature-icon">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v3"/>
              </svg>
            </div>
            <h3>Real-Time Voice Chat</h3>
            <p>Natural, flowing conversations with ultra-low latency voice synthesis and speech recognition</p>
          </div>

          <div class="feature-card">
            <div class="feature-icon">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="8" r="5"/>
                <path d="M3 21v-2a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v2"/>
              </svg>
            </div>
            <h3>Unique AI Personalities</h3>
            <p>Interact with diverse characters, each with their own distinct personality, voice, and backstory</p>
          </div>

          <div class="feature-card">
            <div class="feature-icon">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
            </div>
            <h3>Contextual Memory</h3>
            <p>Characters remember your conversations and build meaningful relationships over time</p>
          </div>

          <div class="feature-card">
            <div class="feature-icon">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="2" y="3" width="20" height="14" rx="2"/>
                <path d="M8 21h8M12 17v4"/>
              </svg>
            </div>
            <h3>Live2D Animation</h3>
            <p>Expressive animated avatars that react to emotions and enhance the immersive experience</p>
          </div>

          <div class="feature-card">
            <div class="feature-icon">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
            </div>
            <h3>Privacy First</h3>
            <p>Your conversations are secure and private. We prioritize your data protection</p>
          </div>

          <div class="feature-card">
            <div class="feature-icon">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
              </svg>
            </div>
            <h3>Always Improving</h3>
            <p>Powered by cutting-edge AI models that continuously learn and improve</p>
          </div>
        </div>
      </div>
    </div>

    <!-- CTA Section -->
    <div class="cta-section">
      <div class="cta-content">
        <h2>Ready to Get Started?</h2>
        <p>Join thousands of users experiencing the future of AI companionship</p>
        <button @click="navigateToSignUp" class="cta-button">
          Create Your Account
        </button>
      </div>
    </div>

    <!-- Footer -->
    <footer class="footer">
      <p>&copy; 2025 Mirai by Phantom Systems Inc. All rights reserved.</p>
    </footer>
  </div>
</template>

<style scoped>
.landing-page {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

/* Hero Section */
.hero-section {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  position: relative;
  overflow: hidden;
}

.hero-content {
  max-width: 1200px;
  width: 100%;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4rem;
  align-items: center;
}

@media (max-width: 768px) {
  .hero-content {
    grid-template-columns: 1fr;
    text-align: center;
  }
}

.hero-text {
  z-index: 2;
}

.logo-container {
  margin-bottom: 2rem;
}

.brand-name {
  font-size: 3.5rem;
  font-weight: 900;
  margin: 0 0 0.5rem 0;
  background: linear-gradient(135deg, #fff 0%, #e0e7ff 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.tagline {
  font-size: 1.25rem;
  opacity: 0.9;
  margin: 0;
}

.hero-title {
  font-size: 3rem;
  font-weight: 800;
  line-height: 1.2;
  margin-bottom: 1.5rem;
}

@media (max-width: 768px) {
  .hero-title {
    font-size: 2rem;
  }
}

.gradient-text {
  background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.hero-description {
  font-size: 1.25rem;
  line-height: 1.8;
  opacity: 0.95;
  margin-bottom: 2.5rem;
}

.cta-buttons {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}

@media (max-width: 768px) {
  .cta-buttons {
    justify-content: center;
  }
}

.cta-primary, .cta-secondary {
  padding: 1rem 2rem;
  font-size: 1.125rem;
  font-weight: 600;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  border: none;
}

.cta-primary {
  background: white;
  color: #667eea;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
}

.cta-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.3);
}

.cta-secondary {
  background: rgba(255, 255, 255, 0.2);
  color: white;
  backdrop-filter: blur(10px);
}

.cta-secondary:hover {
  background: rgba(255, 255, 255, 0.3);
}

/* Hero Visual */
.hero-visual {
  position: relative;
  height: 500px;
  display: flex;
  align-items: center;
  justify-content: center;
}

@media (max-width: 768px) {
  .hero-visual {
    height: 300px;
  }
}

.floating-card {
  position: absolute;
  background: rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(10px);
  border-radius: 16px;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  animation: float 3s ease-in-out infinite;
}

.card-1 {
  top: 10%;
  left: 10%;
  animation-delay: 0s;
}

.card-2 {
  top: 50%;
  right: 5%;
  animation-delay: 1s;
}

.card-3 {
  bottom: 15%;
  left: 20%;
  animation-delay: 2s;
}

@keyframes float {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-20px);
  }
}

.card-icon {
  font-size: 3rem;
}

.card-text {
  font-weight: 600;
  font-size: 1rem;
}

.gradient-orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(60px);
  opacity: 0.3;
  animation: pulse 4s ease-in-out infinite;
}

.orb-1 {
  width: 300px;
  height: 300px;
  background: #fbbf24;
  top: 0;
  right: 0;
}

.orb-2 {
  width: 250px;
  height: 250px;
  background: #f59e0b;
  bottom: 0;
  left: 0;
  animation-delay: 2s;
}

@keyframes pulse {
  0%, 100% {
    transform: scale(1);
    opacity: 0.3;
  }
  50% {
    transform: scale(1.1);
    opacity: 0.5;
  }
}

/* Features Section */
.features-section {
  padding: 6rem 2rem;
  background: white;
  color: #1a202c;
}

.features-container {
  max-width: 1200px;
  margin: 0 auto;
}

.section-title {
  font-size: 2.5rem;
  font-weight: 800;
  text-align: center;
  margin-bottom: 1rem;
}

.section-subtitle {
  font-size: 1.25rem;
  text-align: center;
  color: #6b7280;
  margin-bottom: 4rem;
}

.features-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 2rem;
}

.feature-card {
  padding: 2rem;
  background: #f9fafb;
  border-radius: 16px;
  transition: all 0.3s ease;
}

.feature-card:hover {
  transform: translateY(-8px);
  box-shadow: 0 12px 40px rgba(102, 126, 234, 0.15);
}

.feature-icon {
  width: 70px;
  height: 70px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 1.5rem;
  color: white;
}

.feature-card h3 {
  font-size: 1.5rem;
  font-weight: 700;
  margin-bottom: 0.75rem;
  color: #1a202c;
}

.feature-card p {
  font-size: 1rem;
  line-height: 1.6;
  color: #6b7280;
}

/* CTA Section */
.cta-section {
  padding: 6rem 2rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  text-align: center;
}

.cta-content {
  max-width: 800px;
  margin: 0 auto;
}

.cta-content h2 {
  font-size: 3rem;
  font-weight: 800;
  margin-bottom: 1rem;
}

.cta-content p {
  font-size: 1.25rem;
  opacity: 0.95;
  margin-bottom: 2.5rem;
}

.cta-button {
  padding: 1.25rem 3rem;
  font-size: 1.25rem;
  font-weight: 700;
  background: white;
  color: #667eea;
  border: none;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.2);
}

.cta-button:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.3);
}

/* Footer */
.footer {
  padding: 2rem;
  text-align: center;
  background: rgba(0, 0, 0, 0.2);
  color: white;
}

.footer p {
  margin: 0;
  opacity: 0.8;
}
</style>

<route lang="yaml">
name: LandingPage
meta:
  layout: plain
</route>
