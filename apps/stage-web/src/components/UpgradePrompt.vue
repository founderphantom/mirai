<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  show: boolean
  message: string
  usage?: {
    voiceMinutes?: {
      used: number
      limit: number
      remaining: number
    }
  }
  upgradeUrl?: string
}>()

const emit = defineEmits<{
  close: []
  upgrade: []
}>()

const percentUsed = computed(() => {
  if (!props.usage?.voiceMinutes) return 0
  const { used, limit } = props.usage.voiceMinutes
  if (limit === -1) return 0
  return Math.round((used / limit) * 100)
})

const formattedUsage = computed(() => {
  if (!props.usage?.voiceMinutes) return null
  const { used, limit, remaining } = props.usage.voiceMinutes
  return {
    used,
    limit: limit === -1 ? '∞' : limit,
    remaining: remaining < 0 ? 0 : remaining,
  }
})

function handleUpgrade() {
  if (props.upgradeUrl) {
    window.open(props.upgradeUrl, '_blank')
  }
  emit('upgrade')
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="show" class="modal-overlay" @click="emit('close')">
        <div class="modal-container" @click.stop>
          <div class="modal-header">
            <h2>⚠️ Voice Minute Limit Reached</h2>
            <button class="close-btn" @click="emit('close')">&times;</button>
          </div>

          <div class="modal-body">
            <div class="warning-message">
              {{ message }}
            </div>

            <div v-if="formattedUsage" class="usage-display">
              <div class="usage-bar-container">
                <div class="usage-bar" :style="{ width: `${percentUsed}%` }"></div>
              </div>
              <div class="usage-text">
                {{ formattedUsage.used }} / {{ formattedUsage.limit }} minutes used
                <span v-if="formattedUsage.remaining > 0">
                  ({{ formattedUsage.remaining }} remaining)
                </span>
              </div>
            </div>

            <div class="upgrade-benefits">
              <h3>Upgrade to get more voice minutes:</h3>
              <ul>
                <li>
                  <strong>Pro Plan:</strong> 500 minutes per month + unlimited characters
                </li>
                <li>
                  <strong>Max Plan:</strong> Unlimited voice minutes + priority support
                </li>
              </ul>
            </div>
          </div>

          <div class="modal-footer">
            <button class="btn btn-secondary" @click="emit('close')">
              Close
            </button>
            <button class="btn btn-primary" @click="handleUpgrade">
              Upgrade Now
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: 1rem;
}

.modal-container {
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  border-radius: 16px;
  max-width: 500px;
  width: 100%;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.1);
  overflow: hidden;
}

.modal-header {
  padding: 1.5rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: rgba(255, 107, 107, 0.1);
}

.modal-header h2 {
  margin: 0;
  font-size: 1.5rem;
  color: #ff6b6b;
  font-weight: 600;
}

.close-btn {
  background: none;
  border: none;
  color: #fff;
  font-size: 2rem;
  cursor: pointer;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: background 0.2s;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.1);
}

.modal-body {
  padding: 2rem 1.5rem;
}

.warning-message {
  color: #e0e0e0;
  font-size: 1rem;
  line-height: 1.6;
  margin-bottom: 1.5rem;
}

.usage-display {
  margin: 1.5rem 0;
  padding: 1rem;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.usage-bar-container {
  width: 100%;
  height: 8px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 0.75rem;
}

.usage-bar {
  height: 100%;
  background: linear-gradient(90deg, #ff6b6b 0%, #ee5a6f 100%);
  border-radius: 4px;
  transition: width 0.3s ease;
}

.usage-text {
  color: #b0b0b0;
  font-size: 0.875rem;
  text-align: center;
}

.upgrade-benefits {
  margin-top: 1.5rem;
}

.upgrade-benefits h3 {
  color: #fff;
  font-size: 1rem;
  font-weight: 600;
  margin-bottom: 1rem;
}

.upgrade-benefits ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.upgrade-benefits li {
  padding: 0.75rem;
  margin-bottom: 0.5rem;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  color: #e0e0e0;
  font-size: 0.875rem;
  line-height: 1.5;
}

.upgrade-benefits li strong {
  color: #4ecdc4;
  font-weight: 600;
}

.modal-footer {
  padding: 1.5rem;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
}

.btn {
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
}

.btn-secondary {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.btn-secondary:hover {
  background: rgba(255, 255, 255, 0.15);
}

.btn-primary {
  background: linear-gradient(135deg, #4ecdc4 0%, #44a8f0 100%);
  color: #fff;
  box-shadow: 0 4px 12px rgba(78, 205, 196, 0.3);
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(78, 205, 196, 0.4);
}

/* Modal transitions */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-active .modal-container,
.modal-leave-active .modal-container {
  transition: transform 0.3s ease;
}

.modal-enter-from .modal-container,
.modal-leave-to .modal-container {
  transform: scale(0.9);
}
</style>
