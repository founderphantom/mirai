import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getAdminClient, getUserClient } from '../database/connection.js';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { AppError } from '../utils/errors.js';

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        subscription_tier: 'free' | 'plus' | 'pro' | 'enterprise';
        subscription_status: string;
        role?: string;
      };
      supabaseClient?: ReturnType<typeof getUserClient>;
    }
  }
}

/**
 * Verify JWT token and attach user to request
 */
export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('No authorization token provided', 401);
    }
    
    const token = authHeader.substring(7);
    
    // Verify token with Supabase
    const supabaseClient = getUserClient(token);
    const { data: { user }, error } = await supabaseClient.auth.getUser(token);
    
    if (error || !user) {
      throw new AppError('Invalid or expired token', 401);
    }
    
    // Get user profile from database
    const adminClient = getAdminClient();
    const { data: userProfile, error: profileError } = await adminClient
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    
    if (profileError || !userProfile) {
      // Create profile if it doesn't exist (first time user)
      if (profileError?.code === 'PGRST116') {
        const { data: newProfile, error: createError } = await adminClient
          .from('user_profiles')
          .insert({
            id: user.id,
            subscription_tier: 'free',
            subscription_status: 'active',
            preferences: {},
            metadata: {},
          })
          .select()
          .single();
        
        if (createError || !newProfile) {
          throw new AppError('Failed to create user profile', 500);
        }
        
        req.user = {
          id: user.id,
          email: user.email!,
          subscription_tier: 'free',
          subscription_status: 'active',
        };
      } else {
        throw new AppError('Failed to fetch user profile', 500);
      }
    } else {
      // Check if subscription is active
      if (userProfile.subscription_status === 'canceled' || 
          userProfile.subscription_status === 'past_due') {
        // Allow limited access for canceled/past_due subscriptions
        logger.warn(`User ${user.id} has ${userProfile.subscription_status} subscription`);
      }
      
      req.user = {
        id: user.id,
        email: user.email!,
        subscription_tier: userProfile.subscription_tier,
        subscription_status: userProfile.subscription_status,
      };
    }
    
    // Attach Supabase client for this user
    req.supabaseClient = supabaseClient;
    
    next();
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        error: error.message,
        code: error.code,
      });
    } else {
      logger.error('Authentication error:', error);
      res.status(401).json({
        error: 'Authentication failed',
        code: 'AUTH_FAILED',
      });
    }
  }
};

/**
 * Optional authentication - doesn't fail if no token
 */
export const optionalAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }
    
    const token = authHeader.substring(7);
    const supabaseClient = getUserClient(token);
    const { data: { user } } = await supabaseClient.auth.getUser(token);
    
    if (user) {
      const adminClient = getAdminClient();
      const { data: userProfile } = await adminClient
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      
      if (userProfile) {
        req.user = {
          id: user.id,
          email: user.email!,
          subscription_tier: userProfile.subscription_tier,
          subscription_status: userProfile.subscription_status,
        };
        req.supabaseClient = supabaseClient;
      }
    }
    
    next();
  } catch (error) {
    // Don't fail on optional auth errors
    logger.debug('Optional auth error (ignored):', error);
    next();
  }
};

/**
 * Require specific subscription tier
 */
export const requireSubscription = (
  minTier: 'free' | 'plus' | 'pro' | 'enterprise'
) => {
  const tierOrder = { free: 0, plus: 1, pro: 2, enterprise: 3 };
  
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED',
      });
    }
    
    const userTierLevel = tierOrder[req.user.subscription_tier];
    const requiredTierLevel = tierOrder[minTier];
    
    if (userTierLevel < requiredTierLevel) {
      return res.status(403).json({
        error: `This feature requires ${minTier} subscription or higher`,
        code: 'INSUFFICIENT_SUBSCRIPTION',
        required_tier: minTier,
        current_tier: req.user.subscription_tier,
      });
    }
    
    // Check if subscription is active
    if (req.user.subscription_status !== 'active' && 
        req.user.subscription_status !== 'trialing') {
      return res.status(403).json({
        error: 'Subscription is not active',
        code: 'SUBSCRIPTION_INACTIVE',
        status: req.user.subscription_status,
      });
    }
    
    next();
  };
};

/**
 * Check if user has reached their daily message limit
 */
export const checkMessageLimit = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401);
    }
    
    const limits = config.rateLimit.tiers[req.user.subscription_tier];
    
    // Pro and Enterprise have unlimited messages
    if (limits.messagesPerDay === -1) {
      return next();
    }
    
    // Get user's current daily message count
    const adminClient = getAdminClient();
    const { data: userProfile, error } = await adminClient
      .from('user_profiles')
      .select('daily_message_count, last_message_reset_at')
      .eq('id', req.user.id)
      .single();
    
    if (error || !userProfile) {
      throw new AppError('Failed to check message limit', 500);
    }
    
    // Check if we need to reset the daily count
    const lastReset = new Date(userProfile.last_message_reset_at);
    const now = new Date();
    const isNewDay = lastReset.toDateString() !== now.toDateString();
    
    if (isNewDay) {
      // Reset daily count
      await adminClient
        .from('user_profiles')
        .update({
          daily_message_count: 0,
          last_message_reset_at: now.toISOString(),
        })
        .eq('id', req.user.id);
      
      return next();
    }
    
    // Check if limit reached
    if (userProfile.daily_message_count >= limits.messagesPerDay) {
      return res.status(429).json({
        error: 'Daily message limit reached',
        code: 'MESSAGE_LIMIT_EXCEEDED',
        limit: limits.messagesPerDay,
        reset_at: new Date(lastReset.getTime() + 24 * 60 * 60 * 1000).toISOString(),
        upgrade_url: `${config.server.frontendUrl}/pricing`,
      });
    }
    
    next();
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        error: error.message,
        code: error.code,
      });
    } else {
      logger.error('Message limit check error:', error);
      res.status(500).json({
        error: 'Failed to check message limit',
        code: 'LIMIT_CHECK_FAILED',
      });
    }
  }
};

/**
 * Require admin role (for internal endpoints)
 */
export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required',
      code: 'AUTH_REQUIRED',
    });
  }
  
  // Check if user has admin role in metadata
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      error: 'Admin access required',
      code: 'ADMIN_REQUIRED',
    });
  }
  
  next();
};

/**
 * Validate API key for service-to-service communication
 */
export const validateApiKey = (req: Request, res: Response, next: NextFunction) => {
  const apiKey = req.headers['x-api-key'] as string;
  
  if (!apiKey) {
    return res.status(401).json({
      error: 'API key required',
      code: 'API_KEY_REQUIRED',
    });
  }
  
  // In production, validate against stored API keys
  // For now, check against environment variable
  const validApiKey = process.env.INTERNAL_API_KEY;
  
  if (apiKey !== validApiKey) {
    return res.status(401).json({
      error: 'Invalid API key',
      code: 'INVALID_API_KEY',
    });
  }
  
  next();
};