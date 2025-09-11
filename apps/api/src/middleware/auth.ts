import { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase';
import { jwtVerify, createRemoteJWKSet } from 'jose';
import type { JWTPayload } from 'jose';

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

// Supabase project configuration
const SUPABASE_PROJECT_ID = 'sgupizcxhxohouklbntm';
const JWKS_URL = `https://${SUPABASE_PROJECT_ID}.supabase.co/auth/v1/.well-known/jwks.json`;

// Create JWKS client for public key verification
const jwks = createRemoteJWKSet(new URL(JWKS_URL));

// Cache for public keys with 10-minute TTL as per Supabase docs
class PublicKeyCache {
  private lastFetch: number = 0;
  private readonly cacheTTL = 600000; // 10 minutes in milliseconds
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Only start cleanup interval in non-test environments
    if (process.env.NODE_ENV !== 'test') {
      this.startCleanup();
    }
  }

  private startCleanup(): void {
    // Cleanup every 15 minutes to ensure cache doesn't grow stale
    this.cleanupInterval = setInterval(() => {
      this.checkExpiry();
    }, 900000); // 15 minutes
  }

  public stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  private checkExpiry(): void {
    const now = Date.now();
    if (this.lastFetch && (now - this.lastFetch) > this.cacheTTL) {
      // Cache has expired, will be refreshed on next verification
      this.lastFetch = 0;
    }
  }

  public shouldRefresh(): boolean {
    const now = Date.now();
    return !this.lastFetch || (now - this.lastFetch) > this.cacheTTL;
  }

  public markFetched(): void {
    this.lastFetch = Date.now();
  }

  public clear(): void {
    this.lastFetch = 0;
  }
}

const publicKeyCache = new PublicKeyCache();

// Extended JWT payload type for Supabase tokens
interface SupabaseJWTPayload extends JWTPayload {
  sub?: string; // User ID
  email?: string;
  role?: string;
  aal?: string; // Auth assurance level
  amr?: Array<{ method: string; timestamp: number }>; // Auth methods
  session_id?: string;
}

// Export for cleanup in tests
export const cleanupAuthMiddleware = (): void => {
  publicKeyCache.stopCleanup();
  publicKeyCache.clear();
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
    
    // Basic token format validation
    if (!token || token.split('.').length !== 3) {
      securityEventType = 'invalid_token_format';
      if (!res.headersSent) {
        res.status(401).json({ error: 'Invalid token format' });
      }
      return;
    }

    // Verify JWT using JWKS as per Supabase best practices
    let payload: SupabaseJWTPayload;
    try {
      // Mark cache as accessed for TTL tracking
      if (publicKeyCache.shouldRefresh()) {
        publicKeyCache.markFetched();
      }

      // Verify JWT signature and claims using public key from JWKS
      const { payload: verifiedPayload } = await jwtVerify(token, jwks, {
        issuer: `https://${SUPABASE_PROJECT_ID}.supabase.co/auth/v1`,
        audience: 'authenticated'
      });
      
      payload = verifiedPayload as SupabaseJWTPayload;
    } catch (jwtError: any) {
      // Enhanced error logging for security monitoring
      const errorMessage = jwtError.message || 'Unknown error';
      
      if (errorMessage.includes('expired') || jwtError.code === 'ERR_JWT_EXPIRED') {
        securityEventType = 'token_expired';
        console.warn('JWT validation failed - expired token:', {
          error: errorMessage,
          ip: req.headers['x-forwarded-for'] || req.socket?.remoteAddress,
          userAgent: req.headers['user-agent'],
          timestamp: new Date().toISOString()
        });
      } else if (errorMessage.includes('signature') || jwtError.code === 'ERR_JWS_SIGNATURE_VERIFICATION_FAILED') {
        securityEventType = 'invalid_signature';
        console.warn('JWT validation failed - invalid signature:', {
          error: errorMessage,
          ip: req.headers['x-forwarded-for'] || req.socket?.remoteAddress,
          userAgent: req.headers['user-agent'],
          timestamp: new Date().toISOString()
        });
      } else if (errorMessage.includes('claim') || jwtError.code === 'ERR_JWT_CLAIM_VALIDATION_FAILED') {
        securityEventType = 'invalid_claims';
        console.warn('JWT validation failed - invalid claims:', {
          error: errorMessage,
          ip: req.headers['x-forwarded-for'] || req.socket?.remoteAddress,
          userAgent: req.headers['user-agent'],
          timestamp: new Date().toISOString()
        });
      } else {
        securityEventType = 'auth_error';
        console.error('JWT validation error:', {
          error: errorMessage,
          code: jwtError.code,
          timestamp: new Date().toISOString()
        });
      }
      
      if (!res.headersSent) {
        res.status(401).json({ error: 'Invalid or expired token' });
      }
      return;
    }

    // Validate required claims
    if (!payload.sub || !payload.email) {
      securityEventType = 'missing_claims';
      console.warn('JWT missing required claims:', {
        hasSub: !!payload.sub,
        hasEmail: !!payload.email,
        timestamp: new Date().toISOString()
      });
      if (!res.headersSent) {
        res.status(401).json({ error: 'Invalid token claims' });
      }
      return;
    }
    
    // Extract user ID from the sub claim
    userId = payload.sub;
    const userEmail = payload.email;
    const userRole = payload.role || 'authenticated';

    // Get user profile from database with proper error handling
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
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
      .eq('user_id', userId)
      .eq('status', 'active')
      .single();

    if (violations) {
      if (!res.headersSent) {
        res.status(403).json({ error: 'Account is suspended' });
      }
      return;
    }

    // Attach user to request
    req.user = {
      id: userId,
      email: userEmail,
      role: userRole,
      subscription: {
        tier: profile.subscription_tier || 'free',
        status: profile.subscription_status || 'active',
      },
    };

    // Update last seen (non-blocking with proper error handling)
    Promise.resolve(
      supabaseAdmin
        .from('user_profiles')
        .update({ last_seen_at: new Date().toISOString() })
        .eq('id', userId)
    ).then((result) => {
      if (result.error && process.env.NODE_ENV !== 'test') {
        console.error('Failed to update last_seen_at:', result.error);
      }
    }).catch((err: Error) => {
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
    
    // Log security events to analytics_events table for audit trail
    if (securityEventType && securityEventType !== 'auth_success') {
      try {
        const auditResult = await supabaseAdmin
          .from('analytics_events')
          .insert({
            user_id: userId,
            event_type: `auth_${securityEventType}`,
            event_data: {
              category: 'authentication',
              security_event: securityEventType,
              ip_address: req.headers['x-forwarded-for'] || req.socket?.remoteAddress || null,
              user_agent: req.headers['user-agent'] || null,
              request_path: req.url || '/api',
              request_method: req.method || 'POST',
              response_status: securityEventType === 'auth_exception' ? 500 : 401,
              duration_ms: duration,
              timestamp: new Date().toISOString()
            },
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

// Alias for consistency with other middleware
export const withAuth = requireAuth;