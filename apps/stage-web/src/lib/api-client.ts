import { supabase } from './supabase'

// API configuration
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1'
const API_VERSION = 'v1'

// Request options type
interface RequestOptions extends RequestInit {
  skipAuth?: boolean
  params?: Record<string, any>
}

// API Error class
export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: any
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

// Base API client class
class ApiClient {
  private baseUrl: string

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl
  }

  /**
   * Get authentication token from Supabase session
   */
  private async getAuthToken(): Promise<string | null> {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token || null
  }

  /**
   * Build URL with query parameters
   */
  private buildUrl(endpoint: string, params?: Record<string, any>): string {
    const url = new URL(`${this.baseUrl}${endpoint}`)
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, String(value))
        }
      })
    }
    return url.toString()
  }

  /**
   * Make HTTP request to API
   */
  private async request<T>(
    endpoint: string,
    options: RequestOptions = {}
  ): Promise<T> {
    const { skipAuth = false, params, ...fetchOptions } = options

    // Get auth token if needed
    let headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((fetchOptions.headers as Record<string, string>) || {})
    }

    if (!skipAuth) {
      const token = await this.getAuthToken()
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }
    }

    // Build full URL with params
    const url = this.buildUrl(endpoint, params)

    try {
      const response = await fetch(url, {
        ...fetchOptions,
        headers
      })

      // Parse response
      const data = await response.json().catch(() => null)

      // Handle errors
      if (!response.ok) {
        throw new ApiError(
          response.status,
          data?.code || 'UNKNOWN_ERROR',
          data?.error || data?.message || `Request failed with status ${response.status}`,
          data
        )
      }

      return data as T
    } catch (error) {
      if (error instanceof ApiError) {
        throw error
      }
      
      // Network or other errors
      throw new ApiError(
        0,
        'NETWORK_ERROR',
        error instanceof Error ? error.message : 'Network request failed',
        error
      )
    }
  }

  /**
   * GET request
   */
  async get<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'GET'
    })
  }

  /**
   * POST request
   */
  async post<T>(endpoint: string, body?: any, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined
    })
  }

  /**
   * PUT request
   */
  async put<T>(endpoint: string, body?: any, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined
    })
  }

  /**
   * PATCH request
   */
  async patch<T>(endpoint: string, body?: any, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined
    })
  }

  /**
   * DELETE request
   */
  async delete<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'DELETE'
    })
  }

  /**
   * Stream response (for SSE/streaming endpoints)
   */
  async stream(
    endpoint: string,
    body?: any,
    options?: RequestOptions
  ): Promise<ReadableStream<Uint8Array>> {
    const { skipAuth = false, params, ...fetchOptions } = options || {}

    // Get auth token if needed
    let headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((fetchOptions.headers as Record<string, string>) || {})
    }

    if (!skipAuth) {
      const token = await this.getAuthToken()
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }
    }

    // Build full URL with params
    const url = this.buildUrl(endpoint, params)

    const response = await fetch(url, {
      ...fetchOptions,
      method: 'POST',
      headers,
      body: body ? JSON.stringify(body) : undefined
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Stream request failed' }))
      throw new ApiError(
        response.status,
        error.code || 'STREAM_ERROR',
        error.error || error.message || `Stream failed with status ${response.status}`,
        error
      )
    }

    if (!response.body) {
      throw new ApiError(
        500,
        'NO_STREAM',
        'Response body is not available',
        null
      )
    }

    return response.body
  }
}

// Create singleton instance
const apiClient = new ApiClient()

// Export API service modules
export const api = {
  // Auth endpoints
  auth: {
    login: (email: string, password: string) =>
      apiClient.post('/auth/login', { email, password }, { skipAuth: true }),
    
    register: (email: string, password: string, metadata?: any) =>
      apiClient.post('/auth/register', { email, password, metadata }, { skipAuth: true }),
    
    logout: () =>
      apiClient.post('/auth/logout'),
    
    refreshToken: (refreshToken: string) =>
      apiClient.post('/auth/refresh', { refresh_token: refreshToken }, { skipAuth: true }),
    
    resetPassword: (email: string) =>
      apiClient.post('/auth/reset-password', { email }, { skipAuth: true }),
    
    updatePassword: (newPassword: string) =>
      apiClient.post('/auth/update-password', { password: newPassword })
  },

  // User endpoints
  users: {
    getProfile: () =>
      apiClient.get('/users/profile'),
    
    updateProfile: (data: any) =>
      apiClient.patch('/users/profile', data),
    
    uploadAvatar: (file: File) => {
      const formData = new FormData()
      formData.append('avatar', file)
      return apiClient.post('/users/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
    },
    
    getUsage: () =>
      apiClient.get('/users/usage'),
    
    getSubscription: () =>
      apiClient.get('/users/subscription')
  },

  // Conversation endpoints
  conversations: {
    list: (params?: { limit?: number; offset?: number; search?: string }) =>
      apiClient.get('/conversations', { params }),
    
    get: (id: string) =>
      apiClient.get(`/conversations/${id}`),
    
    create: (data: { title?: string; metadata?: any }) =>
      apiClient.post('/conversations', data),
    
    update: (id: string, data: { title?: string; metadata?: any }) =>
      apiClient.patch(`/conversations/${id}`, data),
    
    delete: (id: string) =>
      apiClient.delete(`/conversations/${id}`),
    
    getMessages: (id: string, params?: { limit?: number; offset?: number }) =>
      apiClient.get(`/conversations/${id}/messages`, { params }),
    
    clearMessages: (id: string) =>
      apiClient.delete(`/conversations/${id}/messages`)
  },

  // Chat endpoints
  chat: {
    sendMessage: (data: {
      conversation_id: string
      content: string
      content_type?: string
      attachments?: any[]
      stream?: boolean
    }) => {
      if (data.stream) {
        return apiClient.stream('/chat/messages', data)
      }
      return apiClient.post('/chat/messages', data)
    },
    
    regenerateMessage: (conversationId: string, messageId?: string) =>
      apiClient.post('/chat/messages/regenerate', {
        conversation_id: conversationId,
        message_id: messageId
      }),
    
    updateMessage: (id: string, data: { content?: string; rating?: number; feedback?: string }) =>
      apiClient.patch(`/chat/messages/${id}`, data),
    
    deleteMessage: (id: string) =>
      apiClient.delete(`/chat/messages/${id}`),
    
    searchMessages: (query: string, conversationId?: string, limit?: number) =>
      apiClient.post('/chat/messages/search', { query, conversation_id: conversationId, limit }),
    
    completion: (data: {
      messages: Array<{ role: string; content: string }>
      model?: string
      provider?: string
      temperature?: number
      max_tokens?: number
      stream?: boolean
    }) => {
      if (data.stream) {
        return apiClient.stream('/chat/completion', data)
      }
      return apiClient.post('/chat/completion', data)
    },
    
    getModels: () =>
      apiClient.get('/chat/models'),
    
    textToSpeech: (text: string, voiceId?: string, provider?: string) =>
      apiClient.post('/chat/tts', { text, voice_id: voiceId, provider }),
    
    speechToText: (audio: Blob) => {
      const formData = new FormData()
      formData.append('audio', audio)
      return apiClient.post('/chat/stt', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
    }
  },

  // Subscription endpoints
  subscriptions: {
    getPlans: () =>
      apiClient.get('/subscriptions/plans'),
    
    getCurrent: () =>
      apiClient.get('/subscriptions/current'),
    
    createCheckoutSession: (planId: string) =>
      apiClient.post('/subscriptions/checkout', { plan_id: planId }),
    
    createPortalSession: () =>
      apiClient.post('/subscriptions/portal'),
    
    cancel: () =>
      apiClient.post('/subscriptions/cancel'),
    
    resume: () =>
      apiClient.post('/subscriptions/resume')
  },

  // Usage endpoints
  usage: {
    getCurrent: () =>
      apiClient.get('/usage/current'),
    
    getHistory: (params?: { start_date?: string; end_date?: string }) =>
      apiClient.get('/usage/history', { params }),
    
    getQuota: () =>
      apiClient.get('/usage/quota')
  },

  // Provider endpoints
  providers: {
    list: () =>
      apiClient.get('/providers'),
    
    get: (id: string) =>
      apiClient.get(`/providers/${id}`),
    
    testConnection: (provider: string, config: any) =>
      apiClient.post('/providers/test', { provider, config }),
    
    saveConfig: (provider: string, config: any) =>
      apiClient.post('/providers/config', { provider, config }),
    
    deleteConfig: (provider: string) =>
      apiClient.delete(`/providers/config/${provider}`)
  },

  // Health check
  health: {
    check: () =>
      apiClient.get('/health', { skipAuth: true }),
    
    ready: () =>
      apiClient.get('/health/ready', { skipAuth: true })
  }
}

// Export types
export type { ApiError, RequestOptions }
export default apiClient