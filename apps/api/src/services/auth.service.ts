import { nanoid } from 'nanoid';
import { supabaseAdmin } from '@/lib/supabase';
import type { Database, UserProfile } from '@/types/database';
import { subscriptionService } from './subscription.service';
import { moderationService } from './moderation.service';

export class AuthService {

  // Sign up new user
  async signUp(email: string, password: string, metadata?: any) {
    try {
      // Create auth user with Supabase Auth
      const { data: authData, error: authError } = await supabaseAdmin.auth.signUp({
        email,
        password,
        options: {
          data: metadata,
          emailRedirectTo: `${process.env.FRONTEND_URL}/auth/callback`,
        },
      });

      if (authError) {
        throw authError;
      }

      if (!authData.user || !authData.session) {
        throw new Error('Failed to create user session');
      }

      // The database trigger automatically creates user_profile
      // Wait a moment for the trigger to complete
      await new Promise(resolve => setTimeout(resolve, 500));

      // Get the created user profile
      const profile = await subscriptionService.getUserProfile(authData.user.id);

      if (!profile) {
        // If profile wasn't created by trigger, create it manually
        const manualProfile = await subscriptionService.upsertUserProfile({
          id: authData.user.id,
          email,
          full_name: metadata?.full_name || null,
          avatar_url: metadata?.avatar_url || null,
        });

        if (!manualProfile) {
          // Rollback auth user if profile creation fails
          await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
          throw new Error('Failed to create user profile');
        }
      }

      // Create welcome notification
      await this.createNotification(
        authData.user.id,
        'welcome',
        'Welcome to AIRI!',
        'Your AI companion is ready to assist you. Start your first conversation now!'
      );

      return {
        user: {
          id: authData.user.id,
          email: authData.user.email!,
          created_at: authData.user.created_at,
          subscription_tier: profile?.subscription_tier || 'free',
          subscription_status: profile?.subscription_status || 'active',
        },
        session: {
          access_token: authData.session.access_token,
          refresh_token: authData.session.refresh_token,
          expires_in: authData.session.expires_in,
          token_type: authData.session.token_type,
        },
      };
    } catch (error: any) {
      console.error('Sign up error:', error);
      throw new Error(error.message || 'Failed to create account');
    }
  }

  // Sign in user
  async signIn(email: string, password: string) {
    try {
      // Authenticate with Supabase Auth
      const { data: authData, error: authError } = await supabaseAdmin.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        throw new Error('Invalid credentials');
      }

      if (!authData.user || !authData.session) {
        throw new Error('Failed to create session');
      }

      // Get user profile from database
      const profile = await subscriptionService.getUserProfile(authData.user.id);

      if (!profile) {
        throw new Error('User profile not found');
      }

      // Check if user is banned
      const banStatus = await moderationService.isUserBanned(profile.id);
      if (banStatus.banned) {
        throw new Error(banStatus.reason || 'Account is disabled');
      }

      // Update last seen (used for tracking activity)
      await (supabaseAdmin
      .from('user_profiles') as any)
        .update({ 
          last_seen_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', profile.id);

      return {
        user: {
          id: profile.id,
          email: profile.email,
          full_name: profile.full_name,
          avatar_url: profile.avatar_url,
          subscription_tier: profile.subscription_tier,
          subscription_status: profile.subscription_status,
          daily_message_count: profile.daily_message_count,
          total_message_count: profile.total_message_count,
        },
        session: {
          access_token: authData.session.access_token,
          refresh_token: authData.session.refresh_token,
          expires_in: authData.session.expires_in,
          token_type: authData.session.token_type,
        },
      };
    } catch (error: any) {
      console.error('Sign in error:', error);
      throw new Error(error.message || 'Authentication failed');
    }
  }

  // Sign out user
  async signOut(accessToken: string) {
    try {
      // Sign out from Supabase Auth using the JWT token
      const { error } = await supabaseAdmin.auth.signOut(accessToken);
      
      if (error) {
        throw error;
      }

      return { success: true };
    } catch (error: any) {
      console.error('Sign out error:', error);
      throw new Error('Failed to sign out');
    }
  }

  // Refresh tokens
  async refreshTokens(refreshToken: string) {
    try {
      // Use Supabase Auth to refresh the session
      const { data, error } = await supabaseAdmin.auth.refreshSession({
        refresh_token: refreshToken,
      });

      if (error) {
        throw error;
      }

      if (!data.session) {
        throw new Error('Failed to refresh session');
      }

      // Get user profile from database
      const profile = await subscriptionService.getUserProfile(data.user!.id);

      if (!profile) {
        throw new Error('User not found');
      }

      // Check if user is banned
      const banStatus = await moderationService.isUserBanned(profile.id);
      if (banStatus.banned) {
        throw new Error('Account is disabled');
      }

      return {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_in: data.session.expires_in,
        token_type: data.session.token_type,
      };
    } catch (error: any) {
      console.error('Token refresh error:', error);
      // Pass through specific error messages
      if (error.message === 'Account is disabled') {
        throw error;
      }
      throw new Error('Invalid refresh token');
    }
  }

  // Get session
  async getSession(userId: string) {
    try {
      const profile = await subscriptionService.getUserProfile(userId);

      if (!profile) {
        throw new Error('User not found');
      }

      // Check if user is banned
      const banStatus = await moderationService.isUserBanned(profile.id);
      if (banStatus.banned) {
        throw new Error(banStatus.reason || 'Account is disabled');
      }

      // Get subscription limits
      const limits = await subscriptionService.getUserLimits(userId);

      return {
        user: {
          id: profile.id,
          email: profile.email,
          full_name: profile.full_name,
          avatar_url: profile.avatar_url,
          subscription_tier: profile.subscription_tier,
          subscription_status: profile.subscription_status,
          daily_message_count: profile.daily_message_count,
          total_message_count: profile.total_message_count,
          created_at: profile.created_at,
          limits,
        },
      };
    } catch (error: any) {
      console.error('Get session error:', error);
      // Pass through specific error messages
      if (error.message === 'User not found' || error.message.includes('disabled') || error.message.includes('Suspended')) {
        throw error;
      }
      throw new Error('Failed to get session');
    }
  }

  // Reset password
  async resetPassword(email: string) {
    try {
      const { data, error } = await supabaseAdmin.auth.resetPasswordForEmail(email, {
        redirectTo: `${process.env.FRONTEND_URL}/reset-password`,
      });

      if (error) {
        throw error;
      }

      // Create notification
      const { data: profile } = await (supabaseAdmin
      .from('user_profiles') as any)
        .select('id')
        .eq('email', email)
        .single();

      if (profile) {
        await this.createNotification(
          profile.id,
          'password_reset',
          'Password Reset Requested',
          'A password reset link has been sent to your email address.'
        );
      }

      return { success: true };
    } catch (error: any) {
      console.error('Password reset error:', error);
      throw new Error('Failed to reset password');
    }
  }

  // Update password
  async updatePassword(accessToken: string, newPassword: string) {
    try {
      // Update password using the user's access token
      const { data, error } = await supabaseAdmin.auth.updateUser(accessToken, {
        password: newPassword,
      });

      if (error) {
        throw error;
      }

      if (!data.user) {
        throw new Error('Failed to update password');
      }

      // Create notification
      await this.createNotification(
        data.user.id,
        'password_changed',
        'Password Changed',
        'Your password has been successfully updated.'
      );

      return { success: true };
    } catch (error: any) {
      console.error('Password update error:', error);
      throw new Error(error.message || 'Failed to update password');
    }
  }

  // Create API key
  async createApiKey(userId: string, name: string, expiresIn?: number) {
    try {
      const apiKey = `sk_${nanoid(32)}`;
      const expiresAt = expiresIn 
        ? new Date(Date.now() + expiresIn).toISOString()
        : null;

      const { data, error } = await (supabaseAdmin
      .from('api_keys') as any)
        .insert({
          user_id: userId,
          name,
          key: apiKey,
          is_active: true,
          expires_at: expiresAt,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      return {
        id: data.id,
        name: data.name,
        key: apiKey,
        expires_at: data.expires_at,
        created_at: data.created_at,
      };
    } catch (error: any) {
      console.error('Create API key error:', error);
      throw new Error('Failed to create API key');
    }
  }

  // Helper: Create notification
  private async createNotification(userId: string, type: string, title: string, message: string) {
    try {
      await (supabaseAdmin
      .from('notifications') as any)
        .insert({
          user_id: userId,
          type,
          title,
          message,
          is_read: false,
          created_at: new Date().toISOString(),
        });
    } catch (error) {
      console.error('Failed to create notification:', error);
    }
  }
}

export const authService = new AuthService();