import { api, setTokens, clearTokens } from '@/lib/api-client';
import type { User } from '@supabase/supabase-js';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface SignupData {
  email: string;
  password: string;
  full_name?: string;
}

export interface AuthResponse {
  user: User;
  access_token: string;
  refresh_token: string;
  session: {
    expires_at: string;
  };
}

export interface SessionResponse {
  user: User | null;
  session: {
    expires_at: string;
  } | null;
  isAuthenticated: boolean;
}

class AuthService {
  /**
   * Login with email and password
   */
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const { data } = await api.post<AuthResponse>('/auth/login', credentials);
    
    // Store tokens
    setTokens(data.access_token, data.refresh_token);
    
    return data;
  }

  /**
   * Sign up a new user
   */
  async signup(signupData: SignupData): Promise<AuthResponse> {
    const { data } = await api.post<AuthResponse>('/auth/signup', signupData);
    
    // Store tokens
    setTokens(data.access_token, data.refresh_token);
    
    return data;
  }

  /**
   * Logout the current user
   */
  async logout(): Promise<void> {
    try {
      await api.post('/auth/logout');
    } catch (error) {
      // Continue with logout even if API call fails
      console.error('Logout API error:', error);
    } finally {
      // Clear tokens and redirect
      clearTokens();
      window.location.href = '/';
    }
  }

  /**
   * Get current session
   */
  async getSession(): Promise<SessionResponse> {
    try {
      const { data } = await api.get<SessionResponse>('/auth/session');
      return data;
    } catch (error) {
      return {
        user: null,
        session: null,
        isAuthenticated: false,
      };
    }
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken: string): Promise<AuthResponse> {
    const { data } = await api.post<AuthResponse>('/auth/refresh', {
      refresh_token: refreshToken,
    });
    
    // Update tokens
    setTokens(data.access_token, data.refresh_token);
    
    return data;
  }

  /**
   * Request password reset
   */
  async forgotPassword(email: string): Promise<{ message: string }> {
    const { data } = await api.post<{ message: string }>('/auth/forgot-password', {
      email,
    });
    return data;
  }

  /**
   * Reset password with token
   */
  async resetPassword(token: string, password: string): Promise<{ message: string }> {
    const { data } = await api.post<{ message: string }>('/auth/reset-password', {
      token,
      password,
    });
    return data;
  }

  /**
   * Verify email with token
   */
  async verifyEmail(token: string): Promise<{ message: string }> {
    const { data } = await api.post<{ message: string }>('/auth/verify-email', {
      token,
    });
    return data;
  }

  /**
   * Resend verification email
   */
  async resendVerification(email: string): Promise<{ message: string }> {
    const { data } = await api.post<{ message: string }>('/auth/resend-verification', {
      email,
    });
    return data;
  }

  /**
   * OAuth authentication
   */
  async oauthCallback(provider: string, code: string, state?: string): Promise<AuthResponse> {
    const { data } = await api.post<AuthResponse>(`/auth/oauth/${provider}`, {
      code,
      state,
    });
    
    // Store tokens
    setTokens(data.access_token, data.refresh_token);
    
    return data;
  }

  /**
   * Check if user is authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    const session = await this.getSession();
    return session.isAuthenticated;
  }
}

export const authService = new AuthService();