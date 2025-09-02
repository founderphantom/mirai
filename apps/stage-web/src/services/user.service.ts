import { api } from '@/lib/api-client';

export interface UserProfile {
  id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
  bio?: string;
  subscription_tier: 'free' | 'plus' | 'pro' | 'enterprise';
  subscription_status: 'active' | 'trialing' | 'past_due' | 'canceled' | 'incomplete';
  subscription_ends_at?: string;
  daily_message_count: number;
  total_message_count: number;
  api_usage: {
    tokens_used: number;
    tokens_limit: number;
    requests_made: number;
    requests_limit: number;
  };
  preferences: {
    theme?: 'light' | 'dark' | 'system';
    language?: string;
    default_model?: string;
    default_provider?: string;
    notifications_enabled?: boolean;
    email_notifications?: boolean;
    sound_enabled?: boolean;
  };
  created_at: string;
  updated_at: string;
}

export interface UpdateProfileData {
  full_name?: string;
  bio?: string;
  avatar_url?: string;
  preferences?: Partial<UserProfile['preferences']>;
}

export interface ChangePasswordData {
  current_password: string;
  new_password: string;
}

export interface ApiKey {
  id: string;
  name: string;
  key_preview: string;
  last_used_at?: string;
  expires_at?: string;
  created_at: string;
}

class UserService {
  /**
   * Get current user profile
   */
  async getProfile(): Promise<UserProfile> {
    const { data } = await api.get<UserProfile>('/users/profile');
    return data;
  }

  /**
   * Update user profile
   */
  async updateProfile(updates: UpdateProfileData): Promise<UserProfile> {
    const { data } = await api.patch<UserProfile>('/users/profile', updates);
    return data;
  }

  /**
   * Upload avatar
   */
  async uploadAvatar(file: File): Promise<{ avatar_url: string }> {
    const formData = new FormData();
    formData.append('avatar', file);
    
    const { data } = await api.post<{ avatar_url: string }>('/users/avatar', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return data;
  }

  /**
   * Change password
   */
  async changePassword(passwordData: ChangePasswordData): Promise<{ message: string }> {
    const { data } = await api.post<{ message: string }>('/users/change-password', passwordData);
    return data;
  }

  /**
   * Delete account
   */
  async deleteAccount(password: string): Promise<void> {
    await api.delete('/users/account', {
      data: { password },
    });
  }

  /**
   * Get user preferences
   */
  async getPreferences(): Promise<UserProfile['preferences']> {
    const { data } = await api.get<UserProfile['preferences']>('/users/preferences');
    return data;
  }

  /**
   * Update user preferences
   */
  async updatePreferences(preferences: Partial<UserProfile['preferences']>): Promise<UserProfile['preferences']> {
    const { data } = await api.patch<UserProfile['preferences']>('/users/preferences', preferences);
    return data;
  }

  /**
   * Get API usage statistics
   */
  async getUsageStats(): Promise<UserProfile['api_usage']> {
    const { data } = await api.get<UserProfile['api_usage']>('/users/usage');
    return data;
  }

  /**
   * Get API keys
   */
  async getApiKeys(): Promise<ApiKey[]> {
    const { data } = await api.get<ApiKey[]>('/users/api-keys');
    return data;
  }

  /**
   * Create API key
   */
  async createApiKey(name: string, expiresIn?: number): Promise<{
    id: string;
    name: string;
    key: string;
    expires_at?: string;
  }> {
    const { data } = await api.post('/users/api-keys', {
      name,
      expires_in: expiresIn,
    });
    return data;
  }

  /**
   * Revoke API key
   */
  async revokeApiKey(keyId: string): Promise<void> {
    await api.delete(`/users/api-keys/${keyId}`);
  }

  /**
   * Export user data
   */
  async exportData(format: 'json' | 'csv' = 'json'): Promise<Blob> {
    const { data } = await api.get('/users/export', {
      params: { format },
      responseType: 'blob',
    });
    return data;
  }

  /**
   * Get notification settings
   */
  async getNotificationSettings(): Promise<{
    push_enabled: boolean;
    email_enabled: boolean;
    sound_enabled: boolean;
    categories: {
      messages: boolean;
      updates: boolean;
      promotions: boolean;
      security: boolean;
    };
  }> {
    const { data } = await api.get('/users/notifications');
    return data;
  }

  /**
   * Update notification settings
   */
  async updateNotificationSettings(settings: any): Promise<void> {
    await api.patch('/users/notifications', settings);
  }
}

export const userService = new UserService();