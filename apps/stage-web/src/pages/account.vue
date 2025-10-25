<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { useSession, authClient } from '@/lib/auth'
import { useRouter } from 'vue-router'
import { openCustomerPortal, getSubscription, type SubscriptionResponse } from '@/services/api/payments'

// Get API base URL from environment
const API_BASE_URL = import.meta.env.VITE_API_URL || window.location.origin

const router = useRouter()
const sessionData = useSession()
const session = computed(() => sessionData.value.data)
const user = computed(() => session.value?.user)
const isLoading = computed(() => sessionData.value.isPending)

// Type definitions
interface AvatarUploadResponse {
  url: string
}

// Subscription data state
const subscriptionData = ref<SubscriptionResponse | null>(null)
const isLoadingSubscription = ref(false)

// Computed properties for subscription
const userSubscriptionTier = computed(() => subscriptionData.value?.tier || 'free')
const userSubscriptionStatus = computed(() => subscriptionData.value?.status)

// Form states
const isEditingName = ref(false)
const isChangingPassword = ref(false)
const isUploadingAvatar = ref(false)

// Form data
const displayName = ref('')
const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const error = ref<string | null>(null)
const success = ref<string | null>(null)

// Avatar upload
const avatarFile = ref<File | null>(null)
const avatarPreview = ref<string | null>(null)

// Fetch subscription data
async function fetchSubscription() {
  if (!user.value) return

  isLoadingSubscription.value = true
  try {
    subscriptionData.value = await getSubscription()
  } catch (err) {
    console.error('Failed to fetch subscription:', err)
    // Don't show error to user, just log it
  } finally {
    isLoadingSubscription.value = false
  }
}

onMounted(async () => {
  if (user.value) {
    displayName.value = user.value.name || ''
    // Fetch subscription data
    await fetchSubscription()
  }
})

// Update display name
async function handleUpdateName() {
  error.value = null
  success.value = null

  try {
    // Call Better-Auth update user API
    await authClient.updateUser({
      name: displayName.value,
    })

    success.value = 'Name updated successfully!'
    isEditingName.value = false

    // Note: Session will be refreshed on next page load
    // Better-Auth doesn't expose a refetch method in the client
  } catch (err) {
    error.value = 'Failed to update name'
    console.error('Update name error:', err)
  }
}

// Change password
async function handleChangePassword() {
  error.value = null
  success.value = null

  // Validate passwords
  if (newPassword.value !== confirmPassword.value) {
    error.value = 'New passwords do not match'
    return
  }

  if (newPassword.value.length < 8) {
    error.value = 'Password must be at least 8 characters'
    return
  }

  try {
    await authClient.changePassword({
      currentPassword: currentPassword.value,
      newPassword: newPassword.value,
      revokeOtherSessions: false,
    })

    success.value = 'Password changed successfully!'
    isChangingPassword.value = false
    currentPassword.value = ''
    newPassword.value = ''
    confirmPassword.value = ''
  } catch (err: any) {
    error.value = err?.message || 'Failed to change password'
    console.error('Change password error:', err)
  }
}

// Handle avatar file selection
function handleAvatarSelect(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]

  if (!file) return

  // Validate file type
  if (!file.type.startsWith('image/')) {
    error.value = 'Please select an image file'
    return
  }

  // Validate file size (max 5MB)
  if (file.size > 5 * 1024 * 1024) {
    error.value = 'Image must be less than 5MB'
    return
  }

  avatarFile.value = file

  // Create preview
  const reader = new FileReader()
  reader.onload = (e) => {
    avatarPreview.value = e.target?.result as string
  }
  reader.readAsDataURL(file)
}

// Upload avatar to R2
async function handleUploadAvatar() {
  if (!avatarFile.value) return

  error.value = null
  success.value = null
  isUploadingAvatar.value = true

  try {
    // Create form data
    const formData = new FormData()
    formData.append('avatar', avatarFile.value)

    // Upload to API Gateway
    const response = await fetch(`${API_BASE_URL}/api/assets/avatar`, {
      method: 'POST',
      body: formData,
      credentials: 'include',
    })

    if (!response.ok) {
      throw new Error('Failed to upload avatar')
    }

    const data = await response.json() as AvatarUploadResponse

    // Update user profile with new avatar URL
    await authClient.updateUser({
      image: data.url,
    })

    success.value = 'Avatar updated successfully!'
    avatarFile.value = null
    avatarPreview.value = null

    // Note: Session will be refreshed on next page load
    // Better-Auth doesn't expose a refetch method in the client
  } catch (err) {
    error.value = 'Failed to upload avatar'
    console.error('Upload avatar error:', err)
  } finally {
    isUploadingAvatar.value = false
  }
}

function getSubscriptionTierLabel(tier?: string) {
  if (!tier) return 'Free'
  return tier.charAt(0).toUpperCase() + tier.slice(1)
}

function getSubscriptionTierColor(tier?: string) {
  switch (tier) {
    case 'pro':
      return '#667eea'
    case 'max':
      return '#764ba2'
    default:
      return '#6b7280'
  }
}

// Handle manage subscription button
async function handleManageSubscription() {
  const tier = userSubscriptionTier.value || 'free'

  // If user is on free tier or no subscription, redirect to pricing page
  if (tier === 'free' || !userSubscriptionStatus.value) {
    router.push('/pricing')
    return
  }

  // If user has active subscription, open customer portal
  try {
    await openCustomerPortal()
  } catch (err) {
    error.value = 'Failed to open customer portal. Please try again.'
    console.error('Customer portal error:', err)
  }
}
</script>

<template>
  <div class="account-page">
    <div class="account-container">
      <!-- Loading State -->
      <div v-if="isLoading" class="loading-container">
        <div class="loading-spinner"></div>
        <p class="loading-text">Loading account...</p>
      </div>

      <!-- Main Content -->
      <div v-else-if="user" class="account-content">
        <!-- Header -->
        <div class="account-header">
          <button @click="router.push('/dashboard')" class="back-btn">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
            Back to Dashboard
          </button>
          <h1>Account Settings</h1>
          <p>Manage your profile and preferences</p>
        </div>

        <!-- Messages -->
        <div v-if="error" class="message error-message">
          {{ error }}
        </div>
        <div v-if="success" class="message success-message">
          {{ success }}
        </div>

        <!-- Profile Section -->
        <div class="settings-section">
          <h2>Profile Information</h2>

          <!-- Avatar -->
          <div class="setting-item">
            <label>Profile Picture</label>
            <div class="avatar-section">
              <div class="avatar-display">
                <img
                  v-if="avatarPreview || user.image"
                  :src="avatarPreview || user.image || undefined"
                  alt="Profile picture"
                  class="avatar-image"
                />
                <div v-else class="avatar-placeholder">
                  {{ user.name?.charAt(0).toUpperCase() || '?' }}
                </div>
              </div>
              <div class="avatar-controls">
                <input
                  type="file"
                  id="avatar-upload"
                  accept="image/*"
                  @change="handleAvatarSelect"
                  style="display: none"
                />
                <label for="avatar-upload" class="upload-btn">
                  Choose Image
                </label>
                <button
                  v-if="avatarFile"
                  @click="handleUploadAvatar"
                  :disabled="isUploadingAvatar"
                  class="save-avatar-btn"
                >
                  {{ isUploadingAvatar ? 'Uploading...' : 'Save Avatar' }}
                </button>
              </div>
            </div>
          </div>

          <!-- Name -->
          <div class="setting-item">
            <label>Display Name</label>
            <div v-if="!isEditingName" class="setting-display">
              <span>{{ user.name }}</span>
              <button @click="isEditingName = true" class="edit-btn">Edit</button>
            </div>
            <div v-else class="setting-edit">
              <input
                v-model="displayName"
                type="text"
                placeholder="Your name"
                class="setting-input"
              />
              <div class="edit-actions">
                <button @click="handleUpdateName" class="save-btn">Save</button>
                <button @click="isEditingName = false" class="cancel-btn">Cancel</button>
              </div>
            </div>
          </div>

          <!-- Email -->
          <div class="setting-item">
            <label>Email Address</label>
            <div class="setting-display">
              <span>{{ user.email }}</span>
              <span class="verified-badge" v-if="user.emailVerified">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                  <polyline points="22 4 12 14.01 9 11.01"></polyline>
                </svg>
                Verified
              </span>
            </div>
            <p class="setting-help">Email address cannot be changed</p>
          </div>
        </div>

        <!-- Security Section -->
        <div class="settings-section">
          <h2>Security</h2>

          <div class="setting-item">
            <label>Password</label>
            <div v-if="!isChangingPassword" class="setting-display">
              <span>••••••••</span>
              <button @click="isChangingPassword = true" class="edit-btn">Change Password</button>
            </div>
            <div v-else class="password-change-form">
              <input
                v-model="currentPassword"
                type="password"
                placeholder="Current password"
                class="setting-input"
              />
              <input
                v-model="newPassword"
                type="password"
                placeholder="New password (min. 8 characters)"
                class="setting-input"
                minlength="8"
              />
              <input
                v-model="confirmPassword"
                type="password"
                placeholder="Confirm new password"
                class="setting-input"
              />
              <div class="edit-actions">
                <button @click="handleChangePassword" class="save-btn">Change Password</button>
                <button @click="isChangingPassword = false; currentPassword = ''; newPassword = ''; confirmPassword = ''" class="cancel-btn">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Subscription Section -->
        <div class="settings-section">
          <h2>Subscription</h2>

          <!-- Loading State -->
          <div v-if="isLoadingSubscription" class="subscription-loading">
            <div class="loading-spinner-small"></div>
            <span>Loading subscription...</span>
          </div>

          <!-- Subscription Card -->
          <div v-else class="subscription-card">
            <div class="subscription-info">
              <div class="subscription-tier">
                <span
                  class="tier-badge"
                  :style="{ backgroundColor: getSubscriptionTierColor(userSubscriptionTier) }"
                >
                  {{ getSubscriptionTierLabel(userSubscriptionTier) }}
                </span>
              </div>
              <div class="subscription-status">
                <span v-if="userSubscriptionStatus === 'active'" class="status-active">
                  Active
                </span>
                <span v-else-if="userSubscriptionStatus === 'canceled'" class="status-canceled">
                  Canceled
                </span>
                <span v-else-if="userSubscriptionStatus === 'past_due'" class="status-past-due">
                  Past Due
                </span>
                <span v-else class="status-inactive">
                  No active subscription
                </span>
              </div>
              <!-- Usage Info -->
              <div v-if="subscriptionData?.usage" class="subscription-usage">
                <span class="usage-label">Voice Minutes Used:</span>
                <span class="usage-value">
                  {{ subscriptionData.usage.voiceMinutes }} /
                  {{ subscriptionData.usage.voiceMinutesLimit === -1 ? 'Unlimited' : subscriptionData.usage.voiceMinutesLimit }}
                </span>
              </div>
            </div>
            <button @click="handleManageSubscription" class="manage-subscription-btn">
              {{ (userSubscriptionTier === 'free' || !userSubscriptionStatus) ? 'Upgrade Plan' : 'Manage Subscription' }}
            </button>
          </div>
        </div>

        <!-- Danger Zone -->
        <div class="settings-section danger-section">
          <h2>Danger Zone</h2>
          <div class="setting-item">
            <div class="danger-content">
              <div>
                <h3>Delete Account</h3>
                <p>Permanently delete your account and all associated data</p>
              </div>
              <button class="danger-btn">Delete Account</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.account-page {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 2rem;
}

.account-container {
  max-width: 900px;
  margin: 0 auto;
}

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
}

.loading-spinner {
  width: 60px;
  height: 60px;
  border: 4px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.loading-text {
  color: white;
  margin-top: 1rem;
  font-size: 1.125rem;
}

.account-content {
  background: white;
  border-radius: 20px;
  padding: 3rem;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

.account-header {
  margin-bottom: 2.5rem;
}

.back-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background-color: #f9fafb;
  color: #4a5568;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 0.95rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  margin-bottom: 1.5rem;
}

.back-btn:hover {
  background-color: #f3f4f6;
  transform: translateX(-4px);
}

.account-header h1 {
  font-size: 2.5rem;
  font-weight: 800;
  color: #1a202c;
  margin-bottom: 0.5rem;
}

.account-header p {
  color: #6b7280;
  font-size: 1.125rem;
}

.message {
  padding: 1rem 1.5rem;
  border-radius: 8px;
  margin-bottom: 2rem;
  font-weight: 500;
}

.error-message {
  background-color: #fed7d7;
  color: #c53030;
  border-left: 4px solid #c53030;
}

.success-message {
  background-color: #c6f6d5;
  color: #22543d;
  border-left: 4px solid #22543d;
}

.settings-section {
  margin-bottom: 3rem;
  padding-bottom: 2rem;
  border-bottom: 2px solid #e5e7eb;
}

.settings-section:last-child {
  border-bottom: none;
}

.settings-section h2 {
  font-size: 1.5rem;
  font-weight: 700;
  color: #1a202c;
  margin-bottom: 1.5rem;
}

.setting-item {
  margin-bottom: 2rem;
}

.setting-item:last-child {
  margin-bottom: 0;
}

.setting-item label {
  display: block;
  font-weight: 600;
  color: #4a5568;
  margin-bottom: 0.75rem;
  font-size: 0.95rem;
}

.setting-display {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem;
  background-color: #f9fafb;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
}

.setting-display span {
  color: #1a202c;
  font-size: 1rem;
}

.verified-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.75rem;
  background-color: #c6f6d5;
  color: #22543d;
  border-radius: 20px;
  font-size: 0.875rem;
  font-weight: 600;
}

.setting-help {
  margin-top: 0.5rem;
  font-size: 0.875rem;
  color: #6b7280;
}

.setting-edit,
.password-change-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.setting-input {
  padding: 0.75rem 1rem;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 1rem;
  transition: all 0.2s;
}

.setting-input:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.edit-actions {
  display: flex;
  gap: 0.75rem;
}

.edit-btn,
.save-btn,
.cancel-btn,
.upload-btn,
.save-avatar-btn {
  padding: 0.625rem 1.25rem;
  border-radius: 8px;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.edit-btn {
  background-color: white;
  color: #667eea;
  border: 2px solid #667eea;
}

.edit-btn:hover {
  background-color: #667eea;
  color: white;
}

.save-btn {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
}

.save-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.cancel-btn {
  background-color: #f9fafb;
  color: #4a5568;
  border: 1px solid #e2e8f0;
}

.cancel-btn:hover {
  background-color: #f3f4f6;
}

/* Avatar Section */
.avatar-section {
  display: flex;
  align-items: center;
  gap: 2rem;
}

.avatar-display {
  flex-shrink: 0;
}

.avatar-image {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  object-fit: cover;
  border: 4px solid #e2e8f0;
}

.avatar-placeholder {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 3rem;
  font-weight: 800;
  color: white;
}

.avatar-controls {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.upload-btn {
  display: inline-block;
  padding: 0.625rem 1.25rem;
  background-color: white;
  color: #667eea;
  border: 2px solid #667eea;
  border-radius: 8px;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  text-align: center;
}

.upload-btn:hover {
  background-color: #667eea;
  color: white;
}

.save-avatar-btn {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
}

.save-avatar-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Subscription Loading */
.subscription-loading {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.5rem;
  background: linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%);
  border-radius: 12px;
  border: 2px solid #e2e8f0;
  color: #6b7280;
}

.loading-spinner-small {
  width: 24px;
  height: 24px;
  border: 3px solid rgba(102, 126, 234, 0.2);
  border-top-color: #667eea;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

/* Subscription Card */
.subscription-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  background: linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%);
  border-radius: 12px;
  border: 2px solid #e2e8f0;
}

.subscription-info {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.tier-badge {
  display: inline-block;
  padding: 0.5rem 1.25rem;
  color: white;
  border-radius: 20px;
  font-size: 1.125rem;
  font-weight: 700;
}

.status-active {
  color: #22543d;
  font-weight: 600;
}

.status-canceled,
.status-past-due {
  color: #c53030;
  font-weight: 600;
}

.status-inactive {
  color: #6b7280;
  font-weight: 600;
}

.subscription-usage {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: rgba(102, 126, 234, 0.1);
  border-radius: 6px;
}

.usage-label {
  font-size: 0.875rem;
  color: #4a5568;
  font-weight: 500;
}

.usage-value {
  font-size: 0.875rem;
  color: #667eea;
  font-weight: 700;
}

.manage-subscription-btn {
  padding: 0.75rem 1.5rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.manage-subscription-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

/* Danger Zone */
.danger-section h2 {
  color: #c53030;
}

.danger-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  background-color: #fed7d7;
  border-radius: 12px;
  border: 2px solid #fc8181;
}

.danger-content h3 {
  font-size: 1.125rem;
  font-weight: 700;
  color: #1a202c;
  margin-bottom: 0.25rem;
}

.danger-content p {
  color: #6b7280;
  font-size: 0.95rem;
}

.danger-btn {
  padding: 0.75rem 1.5rem;
  background-color: #c53030;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.danger-btn:hover {
  background-color: #9b2c2c;
  transform: translateY(-2px);
}

@media (max-width: 768px) {
  .account-content {
    padding: 2rem 1.5rem;
  }

  .avatar-section {
    flex-direction: column;
    align-items: flex-start;
  }

  .subscription-card,
  .danger-content {
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
  }

  .manage-subscription-btn,
  .danger-btn {
    width: 100%;
  }
}
</style>
