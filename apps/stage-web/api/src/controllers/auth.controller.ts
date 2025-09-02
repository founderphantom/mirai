import { Request, Response } from 'express';
import { getAdminClient, getUserClient } from '../database/connection.js';
import { logger } from '../utils/logger.js';
import { AppError } from '../utils/errors.js';

/**
 * Handle user login (Supabase manages actual auth)
 */
export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    
    // Use Supabase client to authenticate
    const supabaseClient = getUserClient();
    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email,
      password
    });
    
    if (error) {
      throw new AppError('Invalid credentials', 401);
    }
    
    // Ensure user profile exists
    if (data.user) {
      const adminClient = getAdminClient();
      const { data: profile } = await adminClient
        .from('user_profiles')
        .select('*')
        .eq('id', data.user.id)
        .single();
      
      if (!profile) {
        // Create profile for new user
        await adminClient
          .from('user_profiles')
          .insert({
            id: data.user.id,
            subscription_tier: 'free',
            subscription_status: 'active',
            preferences: {},
            metadata: {}
          });
      }
    }
    
    res.json({
      user: data.user,
      session: data.session
    });
  } catch (error) {
    logger.error('Login error:', error);
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
    } else {
      res.status(401).json({ error: 'Authentication failed' });
    }
  }
};

/**
 * Handle user registration
 */
export const register = async (req: Request, res: Response) => {
  try {
    const { email, password, metadata } = req.body;
    
    const supabaseClient = getUserClient();
    const { data, error } = await supabaseClient.auth.signUp({
      email,
      password,
      options: {
        data: metadata,
        emailRedirectTo: `${process.env.FRONTEND_URL}/auth/callback`
      }
    });
    
    if (error) {
      throw new AppError(error.message, 400);
    }
    
    // Create user profile
    if (data.user) {
      const adminClient = getAdminClient();
      await adminClient
        .from('user_profiles')
        .insert({
          id: data.user.id,
          subscription_tier: 'free',
          subscription_status: 'active',
          preferences: {},
          metadata: metadata || {}
        });
    }
    
    res.status(201).json({
      user: data.user,
      session: data.session,
      message: 'Registration successful. Please check your email to verify your account.'
    });
  } catch (error) {
    logger.error('Registration error:', error);
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
    } else {
      res.status(400).json({ error: 'Registration failed' });
    }
  }
};

/**
 * Handle user logout
 */
export const logout = async (req: Request, res: Response) => {
  try {
    // Logout is typically handled client-side with Supabase
    // This endpoint can be used for server-side cleanup if needed
    res.json({ message: 'Logout successful' });
  } catch (error) {
    logger.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
};

/**
 * Refresh authentication token
 */
export const refreshToken = async (req: Request, res: Response) => {
  try {
    const { refresh_token } = req.body;
    
    if (!refresh_token) {
      throw new AppError('Refresh token required', 400);
    }
    
    const supabaseClient = getUserClient();
    const { data, error } = await supabaseClient.auth.refreshSession({
      refresh_token
    });
    
    if (error) {
      throw new AppError('Invalid refresh token', 401);
    }
    
    res.json({
      user: data.user,
      session: data.session
    });
  } catch (error) {
    logger.error('Token refresh error:', error);
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
    } else {
      res.status(401).json({ error: 'Token refresh failed' });
    }
  }
};

/**
 * Send password reset email
 */
export const resetPassword = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    
    const supabaseClient = getUserClient();
    const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.FRONTEND_URL}/auth/reset-password`
    });
    
    if (error) {
      throw new AppError('Failed to send reset email', 400);
    }
    
    res.json({ 
      message: 'Password reset email sent. Please check your inbox.' 
    });
  } catch (error) {
    logger.error('Password reset error:', error);
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
    } else {
      res.status(400).json({ error: 'Password reset failed' });
    }
  }
};

/**
 * Update user password
 */
export const updatePassword = async (req: Request, res: Response) => {
  try {
    const { password } = req.body;
    const token = req.headers.authorization?.substring(7);
    
    if (!token) {
      throw new AppError('Authorization required', 401);
    }
    
    const supabaseClient = getUserClient(token);
    const { error } = await supabaseClient.auth.updateUser({
      password
    });
    
    if (error) {
      throw new AppError('Failed to update password', 400);
    }
    
    res.json({ 
      message: 'Password updated successfully' 
    });
  } catch (error) {
    logger.error('Password update error:', error);
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
    } else {
      res.status(400).json({ error: 'Password update failed' });
    }
  }
};

/**
 * Verify email token
 */
export const verifyEmail = async (req: Request, res: Response) => {
  try {
    const { token, email } = req.body;
    
    const supabaseClient = getUserClient();
    const { error } = await supabaseClient.auth.verifyOtp({
      email,
      token,
      type: 'email'
    });
    
    if (error) {
      throw new AppError('Invalid verification token', 400);
    }
    
    res.json({ 
      message: 'Email verified successfully' 
    });
  } catch (error) {
    logger.error('Email verification error:', error);
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
    } else {
      res.status(400).json({ error: 'Email verification failed' });
    }
  }
};