/**
 * CSRF Protection Middleware
 * 
 * Provides protection against Cross-Site Request Forgery attacks
 * using double-submit cookie pattern with additional security measures.
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { doubleCsrf } from 'csrf-csrf';
import { getCookieSettings, isProduction } from '@/lib/config';
import { logger } from '@/utils/logger';

// Initialize CSRF protection with secure configuration
const cookieSettings = getCookieSettings();

const {
  generateToken,
  validateRequest,
  doubleCsrfProtection,
} = doubleCsrf({
  getSecret: () => process.env.CSRF_SECRET || process.env.JWT_SECRET || 'csrf-secret-key-change-in-production',
  cookieName: '_csrf',
  cookieOptions: {
    httpOnly: true,
    sameSite: cookieSettings.sameSite as 'strict' | 'lax' | 'none',
    path: cookieSettings.path,
    secure: cookieSettings.secure,
    maxAge: 86400, // 24 hours
  },
  getTokenFromRequest: (req: any) => {
    // Try to get token from header first (preferred)
    const headerToken = req.headers['x-csrf-token'];
    if (headerToken) return headerToken;
    
    // Fallback to body for form submissions
    const bodyToken = req.body?._csrf;
    if (bodyToken) return bodyToken;
    
    // Fallback to query params (not recommended but supported)
    const queryToken = req.query?._csrf;
    if (queryToken) return queryToken;
    
    return null;
  },
});

/**
 * CSRF Token Generation Endpoint Handler
 * Use this to get a CSRF token for the frontend
 */
export const getCsrfToken = (req: NextApiRequest, res: NextApiResponse) => {
  try {
    const token = generateToken(req as any, res as any);
    
    // Log token generation for security audit
    logger.info('CSRF token generated', {
      ip: req.headers['x-forwarded-for'] || req.socket?.remoteAddress,
      userAgent: req.headers['user-agent'],
    });
    
    res.status(200).json({ 
      csrfToken: token,
      headerName: 'X-CSRF-Token',
      paramName: '_csrf',
    });
  } catch (error) {
    logger.error('Failed to generate CSRF token', { error });
    res.status(500).json({ error: 'Failed to generate CSRF token' });
  }
};

/**
 * CSRF Protection Middleware
 * Apply this to all state-changing operations (POST, PUT, DELETE, PATCH)
 */
export const csrfProtection = (handler: Function) => {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    // Skip CSRF for safe methods
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method || '')) {
      return handler(req, res);
    }
    
    // Skip CSRF for webhook endpoints (they use signature verification instead)
    if (req.url?.includes('/api/subscription/webhook') || 
        req.url?.includes('/api/webhooks/')) {
      return handler(req, res);
    }
    
    try {
      // Validate CSRF token
      const isValid = validateRequest(req as any);
      
      if (!isValid) {
        // Log potential CSRF attack
        logger.warn('CSRF validation failed', {
          url: req.url,
          method: req.method,
          ip: req.headers['x-forwarded-for'] || req.socket?.remoteAddress,
          userAgent: req.headers['user-agent'],
          referer: req.headers.referer,
          origin: req.headers.origin,
        });
        
        return res.status(403).json({ 
          error: 'Invalid CSRF token',
          code: 'CSRF_VALIDATION_FAILED',
        });
      }
      
      // CSRF validation passed, continue to handler
      return handler(req, res);
    } catch (error) {
      logger.error('CSRF middleware error', { error });
      
      // In production, fail closed (deny the request)
      if (isProduction()) {
        return res.status(403).json({ 
          error: 'CSRF validation error',
          code: 'CSRF_ERROR',
        });
      }
      
      // In development, log but allow request (for easier debugging)
      logger.warn('CSRF error in development, allowing request', { error });
      return handler(req, res);
    }
  };
};

/**
 * Express-style middleware for CSRF protection
 * Can be used with Next.js API routes that support middleware chains
 */
export const csrfMiddleware = async (
  req: NextApiRequest,
  res: NextApiResponse,
  next: Function
) => {
  // Skip CSRF for safe methods
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method || '')) {
    return next();
  }
  
  // Skip CSRF for webhook endpoints
  if (req.url?.includes('/api/subscription/webhook') || 
      req.url?.includes('/api/webhooks/')) {
    return next();
  }
  
  try {
    const isValid = validateRequest(req as any);
    
    if (!isValid) {
      logger.warn('CSRF validation failed (middleware)', {
        url: req.url,
        method: req.method,
        ip: req.headers['x-forwarded-for'] || req.socket?.remoteAddress,
      });
      
      return res.status(403).json({ 
        error: 'Invalid CSRF token',
        code: 'CSRF_VALIDATION_FAILED',
      });
    }
    
    next();
  } catch (error) {
    logger.error('CSRF middleware error', { error });
    
    if (isProduction()) {
      return res.status(403).json({ 
        error: 'CSRF validation error',
        code: 'CSRF_ERROR',
      });
    }
    
    logger.warn('CSRF error in development, allowing request', { error });
    next();
  }
};

/**
 * Helper to wrap API handlers with CSRF protection
 * Usage: export default withCsrf(yourHandler)
 */
export const withCsrf = (handler: Function) => csrfProtection(handler);

/**
 * Configuration helper for setting up CSRF in app initialization
 */
export const configureCsrf = () => {
  // Validate CSRF secret is set in production
  if (isProduction() && (!process.env.CSRF_SECRET || process.env.CSRF_SECRET === 'csrf-secret-key-change-in-production')) {
    throw new Error('CSRF_SECRET environment variable must be set in production');
  }
  
  logger.info('CSRF protection configured', {
    cookieName: '_csrf',
    sameSite: cookieSettings.sameSite,
    secure: cookieSettings.secure,
    environment: isProduction() ? 'production' : 'development',
  });
};

export default {
  getCsrfToken,
  csrfProtection,
  csrfMiddleware,
  withCsrf,
  configureCsrf,
};