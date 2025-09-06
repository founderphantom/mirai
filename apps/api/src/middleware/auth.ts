import { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase';

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

export async function authenticateUser(
  req: AuthenticatedRequest,
  res: NextApiResponse,
  next?: () => void
): Promise<void> {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      if (!res.headersSent) {
        res.status(401).json({ error: 'Missing or invalid authorization header' });
      }
      return;
    }

    const token = authHeader.substring(7);

    // Verify token with Supabase Auth
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      if (!res.headersSent) {
        res.status(401).json({ error: 'Invalid or expired token' });
      }
      return;
    }

    // Get user profile from database
    const { data: profile, error: profileError } = await (supabaseAdmin
      .from('user_profiles') as any)
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
    const { data: violations } = await (supabaseAdmin
      .from('user_violations') as any)
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
    req.user = {
      id: user.id,
      email: user.email!,
      role: user.role || 'user',
      subscription: {
        tier: profile.subscription_tier || 'free',
        status: profile.subscription_status || 'active',
      },
    };

    // Update last seen
    await (supabaseAdmin
      .from('user_profiles') as any)
      .update({ last_seen_at: new Date().toISOString() })
      .eq('id', user.id);

    if (next) {
      next();
    }
  } catch (error: any) {
    console.error('Authentication error:', error);
    if (!res.headersSent) {
      res.status(401).json({ error: error.message || 'Authentication failed' });
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
    const { data: apiKeyData, error } = await (supabaseAdmin
      .from('api_keys') as any)
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
    const { data: profile, error: profileError } = await (supabaseAdmin
      .from('user_profiles') as any)
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

    // Update API key last used
    await (supabaseAdmin
      .from('api_keys') as any)
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', apiKeyData.id);

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