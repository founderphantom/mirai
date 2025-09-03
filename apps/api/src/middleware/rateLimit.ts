import { NextApiRequest, NextApiResponse } from 'next';
import { rateLimiters } from '@/lib/redis';
import { RateLimitError } from './error';
import { AuthenticatedRequest } from './auth';

export async function rateLimit(
  req: AuthenticatedRequest,
  res: NextApiResponse,
  next?: () => void
) {
  // Skip rate limiting if Redis is not configured
  if (!rateLimiters) {
    if (next) next();
    return;
  }

  try {
    // Determine the identifier (user ID or IP address)
    const forwardedFor = req.headers['x-forwarded-for'];
    const ipAddress = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
    const identifier = req.user?.id || 
      ipAddress || 
      req.socket.remoteAddress || 
      'anonymous';

    // Determine the rate limiter based on user's subscription
    let limiter = rateLimiters.free;
    
    if (req.user?.subscription) {
      const plan = req.user.subscription.plan;
      if (plan === 'basic') limiter = rateLimiters.basic;
      else if (plan === 'pro') limiter = rateLimiters.pro;
      else if (plan === 'enterprise') limiter = rateLimiters.enterprise;
    }

    // Check rate limit
    const { success, limit, remaining, reset } = await limiter.limit(identifier);

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', limit);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', new Date(reset).toISOString());

    if (!success) {
      throw new RateLimitError(
        `Rate limit exceeded. Try again at ${new Date(reset).toISOString()}`
      );
    }

    if (next) next();
  } catch (error) {
    if (error instanceof RateLimitError) {
      res.status(429).json({
        error: {
          message: error.message,
          statusCode: 429,
          retryAfter: res.getHeader('X-RateLimit-Reset'),
        },
      });
    } else {
      console.error('Rate limiting error:', error);
      // Don't block the request if rate limiting fails
      if (next) next();
    }
  }
}

// Specific rate limiter for auth endpoints
export async function authRateLimit(
  req: NextApiRequest,
  res: NextApiResponse,
  next?: () => void
) {
  if (!rateLimiters) {
    if (next) next();
    return;
  }

  try {
    const forwardedFor = req.headers['x-forwarded-for'];
    const ipAddress = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
    const identifier = ipAddress || 
      req.socket.remoteAddress || 
      'anonymous';

    const { success, limit, remaining, reset } = await rateLimiters.auth.limit(identifier);

    res.setHeader('X-RateLimit-Limit', limit);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', new Date(reset).toISOString());

    if (!success) {
      throw new RateLimitError(
        `Too many authentication attempts. Try again at ${new Date(reset).toISOString()}`
      );
    }

    if (next) next();
  } catch (error) {
    if (error instanceof RateLimitError) {
      res.status(429).json({
        error: {
          message: error.message,
          statusCode: 429,
          retryAfter: res.getHeader('X-RateLimit-Reset'),
        },
      });
    } else {
      console.error('Auth rate limiting error:', error);
      if (next) next();
    }
  }
}

// API key rate limiter
export async function apiKeyRateLimit(
  req: AuthenticatedRequest,
  res: NextApiResponse,
  next?: () => void
) {
  if (!rateLimiters) {
    if (next) next();
    return;
  }

  try {
    const apiKey = req.headers['x-api-key'] as string;
    
    if (!apiKey) {
      throw new Error('API key required');
    }

    const { success, limit, remaining, reset } = await rateLimiters.api.limit(apiKey);

    res.setHeader('X-RateLimit-Limit', limit);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', new Date(reset).toISOString());

    if (!success) {
      throw new RateLimitError(
        `API rate limit exceeded. Try again at ${new Date(reset).toISOString()}`
      );
    }

    if (next) next();
  } catch (error) {
    if (error instanceof RateLimitError) {
      res.status(429).json({
        error: {
          message: error.message,
          statusCode: 429,
          retryAfter: res.getHeader('X-RateLimit-Reset'),
        },
      });
    } else {
      console.error('API key rate limiting error:', error);
      res.status(401).json({
        error: {
          message: 'Invalid API key',
          statusCode: 401,
        },
      });
    }
  }
}

// Create a custom rate limiter
export function createRateLimit(requests: number, window: string) {
  return async (req: AuthenticatedRequest, res: NextApiResponse, next?: () => void) => {
    if (!rateLimiters) {
      if (next) next();
      return;
    }

    try {
      const { Ratelimit } = await import('@upstash/ratelimit');
      const { redis } = await import('@/lib/redis');
      
      if (!redis) {
        if (next) next();
        return;
      }

      const limiter = new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(requests, window as any),
        analytics: true,
      });

      const identifier = req.user?.id || 
        (Array.isArray(req.headers['x-forwarded-for']) 
          ? req.headers['x-forwarded-for'][0] 
          : req.headers['x-forwarded-for']) || 
        req.socket.remoteAddress || 
        'anonymous';

      const { success, limit, remaining, reset } = await limiter.limit(identifier);

      res.setHeader('X-RateLimit-Limit', limit);
      res.setHeader('X-RateLimit-Remaining', remaining);
      res.setHeader('X-RateLimit-Reset', new Date(reset).toISOString());

      if (!success) {
        throw new RateLimitError(
          `Rate limit exceeded. Try again at ${new Date(reset).toISOString()}`
        );
      }

      if (next) next();
    } catch (error) {
      if (error instanceof RateLimitError) {
        res.status(429).json({
          error: {
            message: error.message,
            statusCode: 429,
            retryAfter: res.getHeader('X-RateLimit-Reset'),
          },
        });
      } else {
        console.error('Custom rate limiting error:', error);
        if (next) next();
      }
    }
  };
}