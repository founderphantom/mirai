import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { nanoid } from 'nanoid';
import { supabaseAdmin } from '@/lib/supabase';
import type { Database, UserProfile } from '@/types/database';
import { subscriptionService } from './subscription.service';
import { moderationService } from './moderation.service';

const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || process.env.SUPABASE_JWT_SECRET!;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || process.env.SUPABASE_JWT_SECRET!;
const JWT_ACCESS_EXPIRY = process.env.JWT_ACCESS_EXPIRY || '15m';
const JWT_REFRESH_EXPIRY = process.env.JWT_REFRESH_EXPIRY || '7d';

export class AuthService {
  // Generate tokens
  private generateTokens(userId: string, email: string, role = 'user') {
    const accessToken = jwt.sign(
      { sub: userId, email, role, type: 'access' },
      JWT_ACCESS_SECRET,
      { expiresIn: JWT_ACCESS_EXPIRY }
    );

    const refreshToken = jwt.sign(
      { sub: userId, email, type: 'refresh' },
      JWT_REFRESH_SECRET,
      { expiresIn: JWT_REFRESH_EXPIRY }
    );

    return { accessToken, refreshToken };
  }

  // Sign up new user
  async signUp(email: string, password: string, metadata?: any) {
    try {
      // Check if user already exists
      const { data: existingUser } = await supabaseAdmin
        .from('user_profiles')
        .select('id')
        .eq('email', email)
        .single();

      if (existingUser) {
        throw new Error('User already exists');
      }

      // Create auth user with Supabase Auth
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: metadata,
      });

      if (authError) {
        throw authError;
      }

      // Create user profile with subscription info
      const profile = await subscriptionService.upsertUserProfile({
        id: authData.user.id,
        email,
        full_name: metadata?.full_name || null,
        avatar_url: metadata?.avatar_url || null,
      });

      if (!profile) {
        // Rollback auth user if profile creation fails
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
        throw new Error('Failed to create user profile');
      }

      // Generate tokens
      const tokens = this.generateTokens(profile.id, profile.email);

      // Create welcome notification
      await this.createNotification(
        profile.id,
        'welcome',
        'Welcome to AIRI!',
        'Your AI companion is ready to assist you. Start your first conversation now!'
      );

      return {
        user: {
          id: profile.id,
          email: profile.email,
          created_at: profile.created_at,
          subscription_tier: profile.subscription_tier,
          subscription_status: profile.subscription_status,
        },
        ...tokens,
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

      // Update last message at (used for tracking activity)
      await supabaseAdmin
        .from('user_profiles')
        .update({ 
          last_message_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', profile.id);

      // Generate tokens
      const tokens = this.generateTokens(profile.id, profile.email);

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
        ...tokens,
      };
    } catch (error: any) {
      console.error('Sign in error:', error);
      throw new Error(error.message || 'Authentication failed');
    }
  }

  // Sign out user
  async signOut(userId: string) {
    try {
      // Sign out from Supabase Auth
      const { error } = await supabaseAdmin.auth.admin.signOut(userId);
      
      if (error) {
        throw error;
      }

      // Invalidate any active sessions (you might want to implement a session table)
      // For now, we'll just return success
      return { success: true };
    } catch (error: any) {
      console.error('Sign out error:', error);
      throw new Error('Failed to sign out');
    }
  }

  // Refresh tokens
  async refreshTokens(refreshToken: string) {
    try {
      // Verify refresh token
      const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET) as any;
      
      if (decoded.type !== 'refresh') {
        throw new Error('Invalid token type');
      }

      // Get user profile from database
      const profile = await subscriptionService.getUserProfile(decoded.sub);

      if (!profile) {
        throw new Error('User not found');
      }

      // Check if user is banned
      const banStatus = await moderationService.isUserBanned(profile.id);
      if (banStatus.banned) {
        throw new Error('Account is disabled');
      }

      // Generate new tokens
      const tokens = this.generateTokens(profile.id, profile.email);

      return tokens;
    } catch (error: any) {
      console.error('Token refresh error:', error);
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
      const { data: profile } = await supabaseAdmin
        .from('user_profiles')
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
  async updatePassword(userId: string, currentPassword: string, newPassword: string) {
    try {
      // Get user profile
      const profile = await subscriptionService.getUserProfile(userId);

      if (!profile) {
        throw new Error('User not found');
      }

      // Verify current password
      const { error: signInError } = await supabaseAdmin.auth.signInWithPassword({
        email: profile.email,
        password: currentPassword,
      });

      if (signInError) {
        throw new Error('Current password is incorrect');
      }

      // Update password
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        userId,
        { password: newPassword }
      );

      if (updateError) {
        throw updateError;
      }

      // Create notification
      await this.createNotification(
        userId,
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

      const { data, error } = await supabaseAdmin
        .from('api_keys')
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
      await supabaseAdmin
        .from('notifications')
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