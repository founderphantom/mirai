/**
 * Security Middleware
 * Implements security best practices for the API
 */

import { NextApiRequest, NextApiResponse } from 'next';
import helmet from 'helmet';
import { getConfig } from '@/lib/config';
import { logger } from '@/utils/logger';

/**
 * Apply security headers to responses using Helmet
 */
export function securityHeaders(req: NextApiRequest, res: NextApiResponse, next: () => void) {
  const config = getConfig();
  const isProduction = config.NODE_ENV === 'production';

  // Configure Helmet for enhanced security
  const helmetConfig = helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"], // Required for Next.js
        styleSrc: ["'self'", "'unsafe-inline'"],  // Required for inline styles
        imgSrc: ["'self'", "data:", "https:"],
        fontSrc: ["'self'", "data:"],
        connectSrc: ["'self'", config.SUPABASE_URL || ''],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        upgradeInsecureRequests: isProduction ? [] : null,
      },
    },
    crossOriginEmbedderPolicy: !isProduction, // Disable in dev for easier debugging
    crossOriginOpenerPolicy: { policy: "same-origin" },
    crossOriginResourcePolicy: { policy: "same-origin" },
    dnsPrefetchControl: { allow: false },
    frameguard: { action: 'deny' },
    hidePoweredBy: true,
    hsts: isProduction ? {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    } : false,
    ieNoOpen: true,
    noSniff: true,
    originAgentCluster: true,
    permittedCrossDomainPolicies: false,
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    xssFilter: true,
  });

  // Apply Helmet middleware
  helmetConfig(req as any, res as any, () => {
    // Additional custom security headers
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
    res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
    
    // Add security logging for production
    if (isProduction) {
      logger.debug('Security headers applied', {
        url: req.url,
        method: req.method,
        ip: req.headers['x-forwarded-for'] || req.socket?.remoteAddress,
      });
    }
    
    next();
  });
}

/**
 * Validate request origin for CSRF protection
 */
export function validateOrigin(req: NextApiRequest, res: NextApiResponse, next: () => void) {
  const config = getConfig();
  
  // Skip validation for safe methods
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method || '')) {
    return next();
  }

  const origin = req.headers.origin || req.headers.referer;
  const allowedOrigins = [
    config.FRONTEND_URL,
    config.NODE_ENV === 'development' ? 'http://localhost:3000' : null,
    config.NODE_ENV === 'development' ? 'http://localhost:5173' : null,
  ].filter(Boolean);

  // Check if origin is allowed
  if (origin && !allowedOrigins.some(allowed => origin.startsWith(allowed as string))) {
    return res.status(403).json({ error: 'Invalid origin' });
  }

  next();
}

/**
 * Sanitize user input to prevent XSS
 * This is a wrapper around our comprehensive sanitization utilities
 */
export async function sanitizeInput(input: any): Promise<any> {
  const { sanitizeJson } = await import('@/utils/sanitization');
  return sanitizeJson(input, 'strict');
}

/**
 * Synchronous sanitization for immediate use
 * Note: This is less comprehensive than the async version
 */
export function sanitizeInputSync(input: any): any {
  if (typeof input === 'string') {
    // Basic HTML and script removal
    return input
      .replace(/<script[^>]*>.*?<\/script>/gi, '') // Remove script tags
      .replace(/<[^>]+>/g, '') // Remove HTML tags
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/data:text\/html/gi, '') // Remove data URLs with HTML
      .replace(/on\w+\s*=/gi, '') // Remove event handlers
      .trim();
  }
  
  if (Array.isArray(input)) {
    return input.map(sanitizeInputSync);
  }
  
  if (input && typeof input === 'object') {
    const sanitized: any = {};
    for (const key in input) {
      if (Object.prototype.hasOwnProperty.call(input, key)) {
        // Sanitize the key as well
        const sanitizedKey = sanitizeInputSync(key);
        sanitized[sanitizedKey] = sanitizeInputSync(input[key]);
      }
    }
    return sanitized;
  }
  
  return input;
}

/**
 * Rate limiting per IP address
 */
const ipRequestCounts = new Map<string, { count: number; resetTime: number }>();

export function ipRateLimit(
  windowMs: number = 60000, // 1 minute
  maxRequests: number = 100
) {
  return (req: NextApiRequest, res: NextApiResponse, next: () => void) => {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    
    const requestData = ipRequestCounts.get(ip as string) || { count: 0, resetTime: now + windowMs };
    
    // Reset if window has passed
    if (now > requestData.resetTime) {
      requestData.count = 0;
      requestData.resetTime = now + windowMs;
    }
    
    requestData.count++;
    ipRequestCounts.set(ip as string, requestData);
    
    // Clean up old entries periodically
    if (Math.random() < 0.01) { // 1% chance to clean up
      for (const [key, value] of ipRequestCounts.entries()) {
        if (now > value.resetTime + windowMs) {
          ipRequestCounts.delete(key);
        }
      }
    }
    
    if (requestData.count > maxRequests) {
      res.setHeader('X-RateLimit-Limit', maxRequests.toString());
      res.setHeader('X-RateLimit-Remaining', '0');
      res.setHeader('X-RateLimit-Reset', new Date(requestData.resetTime).toISOString());
      return res.status(429).json({ error: 'Too many requests' });
    }
    
    res.setHeader('X-RateLimit-Limit', maxRequests.toString());
    res.setHeader('X-RateLimit-Remaining', (maxRequests - requestData.count).toString());
    res.setHeader('X-RateLimit-Reset', new Date(requestData.resetTime).toISOString());
    
    next();
  };
}

/**
 * Combine all security middleware
 */
export function applySecurity(req: NextApiRequest, res: NextApiResponse, next: () => void) {
  // Apply all security measures in sequence
  securityHeaders(req, res, () => {
    validateOrigin(req, res, () => {
      next();
    });
  });
}

export default applySecurity;