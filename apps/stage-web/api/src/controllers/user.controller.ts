import { Request, Response } from 'express';
import { getAdminClient } from '../database/connection.js';
import { logger } from '../utils/logger.js';
import { AppError } from '../utils/errors.js';

/**
 * Get user profile
 */
export const getProfile = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    
    const adminClient = getAdminClient();
    const { data: profile, error } = await adminClient
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (error || !profile) {
      throw new AppError('Profile not found', 404);
    }
    
    // Get user data from auth
    const { data: authUser } = await req.supabaseClient!.auth.getUser();
    
    res.json({
      id: userId,
      email: authUser.user?.email,
      created_at: authUser.user?.created_at,
      ...profile,
      metadata: {
        ...profile.metadata,
        ...authUser.user?.user_metadata
      }
    });
  } catch (error) {
    logger.error('Get profile error:', error);
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Failed to get profile' });
    }
  }
};

/**
 * Update user profile
 */
export const updateProfile = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { full_name, avatar_url, preferences, metadata } = req.body;
    
    const adminClient = getAdminClient();
    
    // Update profile
    const updateData: any = {};
    if (preferences !== undefined) updateData.preferences = preferences;
    if (metadata !== undefined) updateData.metadata = metadata;
    updateData.updated_at = new Date().toISOString();
    
    const { data: profile, error } = await adminClient
      .from('user_profiles')
      .update(updateData)
      .eq('id', userId)
      .select()
      .single();
    
    if (error) {
      throw new AppError('Failed to update profile', 500);
    }
    
    // Update auth metadata if needed
    if (full_name !== undefined || avatar_url !== undefined) {
      const authUpdate: any = {};
      if (full_name !== undefined) authUpdate.full_name = full_name;
      if (avatar_url !== undefined) authUpdate.avatar_url = avatar_url;
      
      await req.supabaseClient!.auth.updateUser({
        data: authUpdate
      });
    }
    
    res.json(profile);
  } catch (error) {
    logger.error('Update profile error:', error);
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Failed to update profile' });
    }
  }
};

/**
 * Get user usage statistics
 */
export const getUsage = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    
    const adminClient = getAdminClient();
    
    // Get user profile with usage data
    const { data: profile } = await adminClient
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single();
    
    // Get message count for today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const { count: todayMessages } = await adminClient
      .from('chat_messages')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', today.toISOString());
    
    // Get total message count
    const { count: totalMessages } = await adminClient
      .from('chat_messages')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);
    
    // Get conversation count
    const { count: conversationCount } = await adminClient
      .from('conversations')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .is('deleted_at', null);
    
    // Calculate token usage (would need aggregation)
    const { data: tokenUsage } = await adminClient
      .from('chat_messages')
      .select('total_tokens')
      .eq('user_id', userId)
      .not('total_tokens', 'is', null);
    
    const totalTokens = tokenUsage?.reduce((sum, msg) => sum + (msg.total_tokens || 0), 0) || 0;
    
    res.json({
      messages: {
        today: todayMessages || 0,
        total: totalMessages || 0,
        daily_limit: profile?.subscription_tier === 'free' ? 50 : 
                    profile?.subscription_tier === 'plus' ? 500 : -1
      },
      conversations: conversationCount || 0,
      tokens: {
        used: totalTokens,
        limit: profile?.subscription_tier === 'pro' || 
               profile?.subscription_tier === 'enterprise' ? -1 : 100000
      },
      voice_minutes: {
        used: profile?.voice_minutes_used || 0,
        limit: profile?.subscription_tier === 'free' ? 5 :
               profile?.subscription_tier === 'plus' ? 60 : -1
      },
      subscription: {
        tier: profile?.subscription_tier,
        status: profile?.subscription_status
      }
    });
  } catch (error) {
    logger.error('Get usage error:', error);
    res.status(500).json({ error: 'Failed to get usage statistics' });
  }
};

/**
 * Get user subscription details
 */
export const getSubscription = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    
    const adminClient = getAdminClient();
    const { data: profile } = await adminClient
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single();
    
    res.json({
      tier: profile?.subscription_tier || 'free',
      status: profile?.subscription_status || 'active',
      current_period_start: profile?.current_period_start,
      current_period_end: profile?.current_period_end,
      cancel_at_period_end: profile?.cancel_at_period_end || false,
      stripe_customer_id: profile?.stripe_customer_id,
      stripe_subscription_id: profile?.stripe_subscription_id,
      features: getFeaturesByTier(profile?.subscription_tier || 'free')
    });
  } catch (error) {
    logger.error('Get subscription error:', error);
    res.status(500).json({ error: 'Failed to get subscription' });
  }
};

/**
 * Upload user avatar
 */
export const uploadAvatar = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    // File upload would be handled here
    // For now, return a mock response
    
    const avatarUrl = `https://avatars.example.com/${userId}.jpg`;
    
    // Update user metadata
    await req.supabaseClient!.auth.updateUser({
      data: { avatar_url: avatarUrl }
    });
    
    res.json({ avatar_url: avatarUrl });
  } catch (error) {
    logger.error('Upload avatar error:', error);
    res.status(500).json({ error: 'Failed to upload avatar' });
  }
};

/**
 * Delete user account
 */
export const deleteAccount = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { confirmation } = req.body;
    
    if (confirmation !== 'DELETE') {
      throw new AppError('Invalid confirmation', 400);
    }
    
    const adminClient = getAdminClient();
    
    // Soft delete all user data
    await adminClient
      .from('conversations')
      .update({ deleted_at: new Date().toISOString() })
      .eq('user_id', userId);
    
    await adminClient
      .from('chat_messages')
      .update({ deleted_at: new Date().toISOString() })
      .eq('user_id', userId);
    
    // Mark profile as deleted
    await adminClient
      .from('user_profiles')
      .update({ 
        deleted_at: new Date().toISOString(),
        subscription_status: 'canceled'
      })
      .eq('id', userId);
    
    // Delete auth account
    // Note: This would typically be done through Supabase admin API
    
    res.json({ message: 'Account deletion initiated' });
  } catch (error) {
    logger.error('Delete account error:', error);
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Failed to delete account' });
    }
  }
};

/**
 * Helper function to get features by subscription tier
 */
function getFeaturesByTier(tier: string) {
  const features = {
    free: {
      messages_per_day: 50,
      models: ['gpt-3.5-turbo', 'claude-3-haiku'],
      voice_enabled: false,
      custom_avatars: false,
      api_access: false,
      priority_support: false
    },
    plus: {
      messages_per_day: 500,
      models: ['gpt-4', 'gpt-4-turbo', 'claude-3-sonnet', 'gemini-pro'],
      voice_enabled: true,
      voice_minutes: 60,
      custom_avatars: true,
      api_access: false,
      priority_support: false
    },
    pro: {
      messages_per_day: -1, // unlimited
      models: ['gpt-4-turbo', 'claude-3-opus', 'gemini-ultra'],
      voice_enabled: true,
      voice_minutes: 300,
      custom_avatars: true,
      api_access: true,
      priority_support: true
    },
    enterprise: {
      messages_per_day: -1,
      models: ['all', 'custom'],
      voice_enabled: true,
      voice_minutes: -1,
      custom_avatars: true,
      api_access: true,
      priority_support: true,
      sla: true,
      custom_integration: true
    }
  };
  
  return features[tier as keyof typeof features] || features.free;
}