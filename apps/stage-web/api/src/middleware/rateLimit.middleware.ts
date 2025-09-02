import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { getAdminClient } from '../database/connection.js';

/**
 * Create rate limiter based on user subscription tier
 */
export const createRateLimiter = (tier: 'free' | 'plus' | 'pro' | 'enterprise') => {
  const limits = config.rateLimit.tiers[tier];
  
  return rateLimit({
    windowMs: limits.windowMs,
    max: limits.maxRequests,
    message: {
      error: 'Too many requests',
      code: 'RATE_LIMIT_EXCEEDED',
      statusCode: 429,
      retryAfter: limits.windowMs / 1000,
      upgradeUrl: `${config.server.frontendUrl}/pricing`,
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req: Request) => {
      // Skip rate limiting for health checks
      return req.path === '/health' || req.path === '/api/v1/health';
    },
    handler: (req: Request, res: Response) => {
      logger.warn('Rate limit exceeded', {
        userId: req.user?.id,
        ip: req.ip,
        path: req.path,
        tier,
      });
      
      res.status(429).json({
        error: 'Too many requests',
        code: 'RATE_LIMIT_EXCEEDED',
        statusCode: 429,
        retryAfter: limits.windowMs / 1000,
        upgradeUrl: `${config.server.frontendUrl}/pricing`,
      });
    },
  });
};

/**
 * Dynamic rate limiter that checks user's subscription tier
 */
export const rateLimiter = async (req: Request, res: Response, next: Function) => {
  // Skip if rate limiting is disabled
  if (!config.features.enableRateLimiting) {
    return next();
  }
  
  // Determine tier based on authenticated user
  let tier: 'free' | 'plus' | 'pro' | 'enterprise' = 'free';
  
  if (req.user) {
    tier = req.user.subscription_tier;
  }
  
  // Apply the appropriate rate limiter
  const limiter = createRateLimiter(tier);
  limiter(req, res, next);
};

/**
 * Strict rate limiter for sensitive endpoints (auth, payments)
 */
export const strictRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  message: {
    error: 'Too many attempts, please try again later',
    code: 'TOO_MANY_ATTEMPTS',
    statusCode: 429,
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful requests
});

/**
 * API key rate limiter for service-to-service communication
 */
export const apiKeyRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  keyGenerator: (req: Request) => {
    // Use API key as identifier
    return req.headers['x-api-key'] as string || req.ip;
  },
  message: {
    error: 'API rate limit exceeded',
    code: 'API_RATE_LIMIT_EXCEEDED',
    statusCode: 429,
  },
});

/**
 * WebSocket connection rate limiter
 */
export const wsRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 connections per minute
  message: {
    error: 'Too many WebSocket connection attempts',
    code: 'WS_RATE_LIMIT_EXCEEDED',
    statusCode: 429,
  },
});

/**
 * Track API usage for billing purposes
 */
export const trackUsage = async (req: Request, res: Response, next: Function) => {
  const startTime = Date.now();
  
  // Capture response data
  const originalSend = res.send;
  res.send = function(data: any) {
    res.locals.responseBody = data;
    res.locals.responseTime = Date.now() - startTime;
    return originalSend.call(this, data);
  };
  
  // Log usage after response
  res.on('finish', async () => {
    if (req.user) {
      try {
        const adminClient = getAdminClient();
        
        // Extract token usage from response if available
        let promptTokens = 0;
        let completionTokens = 0;
        
        if (res.locals.tokenUsage) {
          promptTokens = res.locals.tokenUsage.promptTokens || 0;
          completionTokens = res.locals.tokenUsage.completionTokens || 0;
        }
        
        // Log to usage_logs table
        await adminClient.from('usage_logs').insert({
          user_id: req.user.id,
          endpoint: req.path,
          method: req.method,
          status_code: res.statusCode,
          prompt_tokens: promptTokens,
          completion_tokens: completionTokens,
          total_tokens: promptTokens + completionTokens,
          response_time_ms: res.locals.responseTime,
          ip_address: req.ip,
          user_agent: req.get('user-agent'),
          metadata: {
            tier: req.user.subscription_tier,
          },
        });
      } catch (error) {
        // Don't fail the request if usage tracking fails
        logger.error('Failed to track usage:', error);
      }
    }
  });
  
  next();
};