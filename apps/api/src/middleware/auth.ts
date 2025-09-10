import { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase';
import { createHash } from 'crypto';

export interface AuthenticatedRequest extends NextApiRequest {
  user?: {
    id: string;
    email: string;
    role?: string;
    subscription?: {
      tier: string;
      status: string;
    };
  };
}

// LRU cache for token validation to reduce database calls
interface CacheEntry {
  user: {
    id: string;
    email: string;
    role: string;
    subscription: {
      tier: string;
      status: string;
    };
  };
  expiry: number;
  lastAccess: number;
}

class LRUTokenCache {
  private cache = new Map<string, CacheEntry>();
  private readonly maxSize = 1000; // Maximum cache entries
  private readonly ttlMs = 60000; // 1 minute TTL
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Only start cleanup interval in non-test environments
    if (process.env.NODE_ENV !== 'test') {
      this.startCleanup();
    }
  }

  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      this.evictExpired();
    }, 300000); // Clean every 5 minutes
  }

  public stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  private evictExpired(): void {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (value.expiry < now) {
        this.cache.delete(key);
      }
    }
  }

  private evictLRU(): void {
    if (this.cache.size <= this.maxSize) return;
    
    // Find and remove least recently used entries
    const entries = Array.from(this.cache.entries());
    entries.sort((a, b) => a[1].lastAccess - b[1].lastAccess);
    
    const toRemove = entries.slice(0, Math.floor(this.maxSize * 0.1)); // Remove 10% of cache
    for (const [key] of toRemove) {
      this.cache.delete(key);
    }
  }

  public get(key: string): CacheEntry | undefined {
    const entry = this.cache.get(key);
    if (entry) {
      if (entry.expiry > Date.now()) {
        entry.lastAccess = Date.now();
        return entry;
      }
      this.cache.delete(key);
    }
    return undefined;
  }

  public set(key: string, user: CacheEntry['user']): void {
    if (this.cache.size >= this.maxSize) {
      this.evictLRU();
    }
    
    this.cache.set(key, {
      user,
      expiry: Date.now() + this.ttlMs,
      lastAccess: Date.now()
    });
  }

  public clear(): void {
    this.cache.clear();
  }

  public size(): number {
    return this.cache.size;
  }
}

const tokenValidationCache = new LRUTokenCache();

// Export for cleanup in tests
export const cleanupAuthMiddleware = (): void => {
  tokenValidationCache.stopCleanup();
  tokenValidationCache.clear();
};

export async function authenticateUser(
  req: AuthenticatedRequest,
  res: NextApiResponse,
  next?: () => void
): Promise<void> {
  const startTime = Date.now();
  let securityEventType: string | null = null;
  let userId: string | null = null;
  
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      securityEventType = 'missing_auth_header';
      if (!res.headersSent) {
        res.status(401).json({ error: 'Missing or invalid authorization header' });
      }
      return;
    }

    const token = authHeader.substring(7);
    
    // Basic token format validation (relaxed for testing)
    if (!token || (process.env.NODE_ENV !== 'test' && token.length < 20)) {
      securityEventType = 'invalid_token_format';
      if (!res.headersSent) {
        res.status(401).json({ error: 'Invalid token format' });
      }
      return;
    }
    
    // Generate cache key for this token
    const tokenHash = createHash('sha256').update(token).digest('hex');
    
    // Check cache first
    const cached = tokenValidationCache.get(tokenHash);
    if (cached) {
      // Use cached validation result
      req.user = cached.user;
      userId = cached.user.id;
      
      // Update last seen (throttled to once per minute via cache)
      if (next) {
        next();
      }
      return;
    }

    // Verify token with Supabase Auth
    // IMPORTANT: When using the admin client (service role key), getUser performs full JWT validation
    // including signature verification and expiry checks
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      // Enhanced error logging for security monitoring
      if (authError) {
        // Check for specific error types
        const errorMessage = authError.message || 'Unknown error';
        if (errorMessage.includes('expired')) {
          securityEventType = 'token_expired';
          console.warn('JWT validation failed - expired token:', {
            error: errorMessage,
            ip: req.headers['x-forwarded-for'] || req.socket?.remoteAddress,
            userAgent: req.headers['user-agent'],
            timestamp: new Date().toISOString()
          });
        } else if (errorMessage.includes('invalid') || errorMessage.includes('malformed')) {
          securityEventType = 'invalid_token';
          console.warn('JWT validation failed - invalid token:', {
            error: errorMessage,
            ip: req.headers['x-forwarded-for'] || req.socket?.remoteAddress,
            userAgent: req.headers['user-agent'],
            timestamp: new Date().toISOString()
          });
        } else {
          securityEventType = 'auth_error';
          console.error('JWT validation error:', {
            error: errorMessage,
            timestamp: new Date().toISOString()
          });
        }
      }
      
      if (!res.headersSent) {
        res.status(401).json({ error: 'Invalid or expired token' });
      }
      return;
    }
    
    // Additional validation: Check if user email is verified (if required)
    if (user.email && !user.email_confirmed_at) {
      securityEventType = 'unverified_email';
      console.warn('Authentication attempt with unverified email:', {
        userId: user.id,
        email: user.email,
        timestamp: new Date().toISOString()
      });
      // Optionally enforce email verification
      // if (!res.headersSent) {
      //   res.status(403).json({ error: 'Email verification required' });
      // }
      // return;
    }
    
    userId = user.id;

    // Get user profile from database with proper error handling
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      if (!res.headersSent) {
        res.status(401).json({ error: 'User profile not found' });
      }
      return;
    }

    // Check if user is banned (using moderation service)
    const { data: violations } = await supabaseAdmin
      .from('user_violations')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single();

    if (violations) {
      if (!res.headersSent) {
        res.status(403).json({ error: 'Account is suspended' });
      }
      return;
    }

    // Attach user to request
    const userInfo = {
      id: user.id,
      email: user.email!,
      role: user.role || 'user',
      subscription: {
        tier: profile.subscription_tier || 'free',
        status: profile.subscription_status || 'active',
      },
    };
    
    req.user = userInfo;
    
    // Cache the validation result
    tokenValidationCache.set(tokenHash, userInfo);

    // Update last seen (non-blocking with proper error handling)
    supabaseAdmin
      .from('user_profiles')
      .update({ last_seen_at: new Date().toISOString() })
      .eq('id', user.id)
      .then((result) => {
        if (result.error && process.env.NODE_ENV !== 'test') {
          console.error('Failed to update last_seen_at:', result.error);
        }
      })
      .catch((err: Error) => {
        // Only log in production to avoid test noise
        if (process.env.NODE_ENV !== 'test') {
          console.error('Failed to update last_seen_at:', err.message);
        }
      });

    if (next) {
      next();
    }
  } catch (error: any) {
    securityEventType = 'auth_exception';
    console.error('Authentication error:', {
      error: error.message || error,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
    if (!res.headersSent) {
      res.status(401).json({ error: 'Authentication failed' });
    }
  } finally {
    // Log authentication metrics for monitoring
    const duration = Date.now() - startTime;
    if (duration > 1000) {
      console.warn('Slow authentication:', {
        duration,
        userId,
        securityEventType,
        timestamp: new Date().toISOString()
      });
    }
    
    // Log security events to dedicated audit trail table
    if (securityEventType && securityEventType !== 'auth_success') {
      try {
        const auditResult = await supabaseAdmin
          .from('security_audit_logs')
          .insert({
            user_id: userId,
            event_type: `auth_${securityEventType}`,
            event_category: 'authentication',
            event_details: {
              security_event: securityEventType,
              timestamp: new Date().toISOString()
            },
            ip_address: req.headers['x-forwarded-for'] || req.socket?.remoteAddress || null,
            user_agent: req.headers['user-agent'] || null,
            request_path: req.url || '/api',
            request_method: req.method || 'POST',
            response_status: securityEventType === 'auth_exception' ? 500 : 401,
            duration_ms: duration,
            created_at: new Date().toISOString()
          });
        
        if (auditResult.error && process.env.NODE_ENV !== 'test') {
          console.error('Failed to log security event:', auditResult.error);
        }
      } catch (error) {
        if (process.env.NODE_ENV !== 'test') {
          console.error('Security event logging error:', error);
        }
      }
    }
  }
}

export function requireAuth(handler: (req: AuthenticatedRequest, res: NextApiResponse) => Promise<void>) {
  return async (req: AuthenticatedRequest, res: NextApiResponse) => {
    await new Promise<void>((resolve) => {
      authenticateUser(req, res, () => resolve()).then(() => resolve(), () => resolve());
    });

    if (!req.user) {
      if (!res.headersSent) {
        res.status(401).json({ error: 'Authentication required' });
      }
      return;
    }

    return handler(req, res);
  };
}

export function requireSubscription(
  requiredTiers: string[] = ['free', 'pro', 'enterprise']
) {
  return function (handler: (req: AuthenticatedRequest, res: NextApiResponse) => Promise<void>) {
    return requireAuth(async (req: AuthenticatedRequest, res: NextApiResponse) => {
      if (!req.user?.subscription) {
        if (!res.headersSent) {
          res.status(403).json({ error: 'Active subscription required' });
        }
        return;
      }

      if (!requiredTiers.includes(req.user.subscription.tier)) {
        if (!res.headersSent) {
          res.status(403).json({ 
            error: 'Insufficient subscription tier',
            required: requiredTiers,
            current: req.user.subscription.tier,
          });
        }
        return;
      }

      if (req.user.subscription.status !== 'active') {
        if (!res.headersSent) {
          res.status(403).json({ 
            error: 'Subscription is not active',
            status: req.user.subscription.status,
          });
        }
        return;
      }

      return handler(req, res);
    });
  };
}

export function requireRole(roles: string[]) {
  return function (handler: (req: AuthenticatedRequest, res: NextApiResponse) => Promise<void>) {
    return requireAuth(async (req: AuthenticatedRequest, res: NextApiResponse) => {
      if (!req.user?.role || !roles.includes(req.user.role)) {
        if (!res.headersSent) {
          res.status(403).json({ 
            error: 'Insufficient permissions',
            required: roles,
            current: req.user?.role,
          });
        }
        return;
      }

      return handler(req, res);
    });
  };
}

// API Key authentication for service-to-service communication
export async function authenticateApiKey(
  req: AuthenticatedRequest,
  res: NextApiResponse,
  next?: () => void
): Promise<void> {
  try {
    const apiKey = req.headers['x-api-key'] as string;
    
    if (!apiKey) {
      if (!res.headersSent) {
        res.status(401).json({ error: 'Missing API key' });
      }
      return;
    }

    // Validate API key against database
    const { data: apiKeyData, error } = await supabaseAdmin
      .from('api_keys')
      .select('*')
      .eq('key', apiKey)
      .eq('is_active', true)
      .single();

    if (error || !apiKeyData) {
      if (!res.headersSent) {
        res.status(401).json({ error: 'Invalid API key' });
      }
      return;
    }

    // Check if key is expired
    if (apiKeyData.expires_at && new Date(apiKeyData.expires_at) < new Date()) {
      if (!res.headersSent) {
        res.status(401).json({ error: 'API key expired' });
      }
      return;
    }

    // Get associated user profile
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('*')
      .eq('id', apiKeyData.user_id)
      .single();

    if (profileError || !profile) {
      if (!res.headersSent) {
        res.status(401).json({ error: 'User not found' });
      }
      return;
    }

    // Attach user to request
    req.user = {
      id: profile.id,
      email: profile.email,
      role: 'service',
      subscription: {
        tier: profile.subscription_tier || 'free',
        status: profile.subscription_status || 'active',
      },
    };

    // Update API key last used with proper error handling
    const updateResult = await supabaseAdmin
      .from('api_keys')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', apiKeyData.id);
    
    if (updateResult.error && process.env.NODE_ENV !== 'test') {
      console.error('Failed to update API key last_used_at:', updateResult.error);
    }

    if (next) {
      next();
    }
  } catch (error: any) {
    console.error('API key authentication error:', error);
    if (!res.headersSent) {
      res.status(401).json({ error: 'Authentication failed' });
    }
  }
}

// Combined authentication middleware (JWT or API Key)
export function authenticate(handler: (req: AuthenticatedRequest, res: NextApiResponse) => Promise<void>) {
  return async (req: AuthenticatedRequest, res: NextApiResponse) => {
    // Check for API key first
    if (req.headers['x-api-key']) {
      await new Promise<void>((resolve) => {
        authenticateApiKey(req, res, () => resolve()).then(() => resolve(), () => resolve());
      });
    } else {
      // Fall back to JWT authentication
      await new Promise<void>((resolve) => {
        authenticateUser(req, res, () => resolve()).then(() => resolve(), () => resolve());
      });
    }

    if (!req.user) {
      return;
    }

    return handler(req, res);
  };
}