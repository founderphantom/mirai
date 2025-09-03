import { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import { supabaseAdmin } from '@/lib/supabase';

export interface AuthenticatedRequest extends NextApiRequest {
  user?: {
    id: string;
    email: string;
    role?: string;
    subscription?: {
      plan: string;
      status: string;
    };
  };
}

const JWT_SECRET = process.env.SUPABASE_JWT_SECRET!;

export async function verifyToken(token: string): Promise<any> {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded;
  } catch (error) {
    throw new Error('Invalid token');
  }
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
      res.status(401).json({ error: 'Missing or invalid authorization header' });
      return;
    }

    const token = authHeader.substring(7);

    // Verify token
    const decoded = await verifyToken(token);
    
    if (!decoded.sub) {
      res.status(401).json({ error: 'Invalid token payload' });
      return;
    }

    // Get user from database
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', decoded.sub)
      .single();

    if (userError || !user) {
      res.status(401).json({ error: 'User not found' });
      return;
    }

    // Check if user is active
    if (!user.is_active) {
      res.status(403).json({ error: 'Account is disabled' });
      return;
    }

    // Get user subscription
    const { data: subscription } = await supabaseAdmin
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single();

    // Attach user to request
    req.user = {
      id: user.id,
      email: user.email,
      role: decoded.role || 'user',
      subscription: subscription ? {
        plan: subscription.plan_id,
        status: subscription.status,
      } : undefined,
    };

    // Update last login
    await supabaseAdmin
      .from('users')
      .update({ last_login: new Date().toISOString() })
      .eq('id', user.id);

    if (next) {
      next();
    }
  } catch (error: any) {
    console.error('Authentication error:', error);
    res.status(401).json({ error: error.message || 'Authentication failed' });
  }
}

export function requireAuth(handler: (req: AuthenticatedRequest, res: NextApiResponse) => Promise<void>) {
  return async (req: AuthenticatedRequest, res: NextApiResponse) => {
    await new Promise<void>((resolve, reject) => {
      authenticateUser(req, res, () => resolve());
    });

    if (!req.user) {
      return;
    }

    return handler(req, res);
  };
}

export function requireSubscription(
  requiredPlans: string[] = ['basic', 'pro', 'enterprise']
) {
  return function (handler: (req: AuthenticatedRequest, res: NextApiResponse) => Promise<void>) {
    return requireAuth(async (req: AuthenticatedRequest, res: NextApiResponse) => {
      if (!req.user?.subscription) {
        res.status(403).json({ error: 'Active subscription required' });
        return;
      }

      if (!requiredPlans.includes(req.user.subscription.plan)) {
        res.status(403).json({ 
          error: 'Insufficient subscription plan',
          required: requiredPlans,
          current: req.user.subscription.plan,
        });
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
        res.status(403).json({ 
          error: 'Insufficient permissions',
          required: roles,
          current: req.user?.role,
        });
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
      res.status(401).json({ error: 'Missing API key' });
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
      res.status(401).json({ error: 'Invalid API key' });
      return;
    }

    // Check if key is expired
    if (apiKeyData.expires_at && new Date(apiKeyData.expires_at) < new Date()) {
      res.status(401).json({ error: 'API key expired' });
      return;
    }

    // Get associated user
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', apiKeyData.user_id)
      .single();

    if (userError || !user) {
      res.status(401).json({ error: 'User not found' });
      return;
    }

    // Attach user to request
    req.user = {
      id: user.id,
      email: user.email,
      role: 'service',
    };

    // Update API key last used
    await supabaseAdmin
      .from('api_keys')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', apiKeyData.id);

    if (next) {
      next();
    }
  } catch (error: any) {
    console.error('API key authentication error:', error);
    res.status(401).json({ error: 'Authentication failed' });
  }
}

// Combined authentication middleware (JWT or API Key)
export function authenticate(handler: (req: AuthenticatedRequest, res: NextApiResponse) => Promise<void>) {
  return async (req: AuthenticatedRequest, res: NextApiResponse) => {
    // Check for API key first
    if (req.headers['x-api-key']) {
      await new Promise<void>((resolve) => {
        authenticateApiKey(req, res, () => resolve());
      });
    } else {
      // Fall back to JWT authentication
      await new Promise<void>((resolve) => {
        authenticateUser(req, res, () => resolve());
      });
    }

    if (!req.user) {
      return;
    }

    return handler(req, res);
  };
}