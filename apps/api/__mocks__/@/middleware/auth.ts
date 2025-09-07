import { NextApiRequest, NextApiResponse } from 'next';

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

// Mock verifyToken - synchronous
export const verifyToken = jest.fn(async (token: string) => {
  if (token === 'invalid-token' || token === 'expired-token' || !token) {
    throw new Error('Invalid token');
  }
  
  // Extract user info from test tokens if possible
  const parts = token.split('.');
  if (parts.length === 3 && parts[1]) {
    try {
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
      return payload;
    } catch {
      // Fallback for simple test tokens
    }
  }
  
  return {
    sub: 'test-user-id',
    email: 'test@example.com',
    type: 'access',
    role: 'user'
  };
});

// Mock authenticateUser - synchronous
export const authenticateUser = jest.fn(async (
  req: AuthenticatedRequest,
  res: NextApiResponse,
  next?: () => void
) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid authorization header' });
    return;
  }
  
  const token = authHeader.substring(7);
  
  try {
    const decoded = await verifyToken(token);
    req.user = {
      id: decoded.sub,
      email: decoded.email,
      role: decoded.role || 'user',
    };
    
    if (next) next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

// Mock authenticateApiKey - synchronous
export const authenticateApiKey = jest.fn(async (
  req: AuthenticatedRequest,
  res: NextApiResponse,
  next?: () => void
) => {
  const apiKey = req.headers['x-api-key'] as string;
  
  if (!apiKey) {
    res.status(401).json({ error: 'Missing API key' });
    return;
  }
  
  if (apiKey === 'invalid_key') {
    res.status(401).json({ error: 'Invalid API key' });
    return;
  }
  
  req.user = {
    id: 'api-user-id',
    email: 'api@example.com',
    role: 'service',
  };
  
  if (next) next();
});

// Mock requireAuth - synchronous wrapper
export const requireAuth = jest.fn((handler: any) => {
  return (req: AuthenticatedRequest, res: NextApiResponse) => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    return handler(req, res);
  };
});

// Mock requireSubscription - synchronous wrapper
export const requireSubscription = jest.fn((plans: string[]) => {
  return (handler: any) => {
    return (req: AuthenticatedRequest, res: NextApiResponse) => {
      if (!req.user?.subscription) {
        res.status(403).json({ error: 'Active subscription required' });
        return;
      }
      
      if (!plans.includes(req.user.subscription.tier)) {
        res.status(403).json({ 
          error: 'Insufficient subscription tier',
          required: plans,
          current: req.user.subscription.tier
        });
        return;
      }
      
      return handler(req, res);
    };
  };
});

// Mock requireRole - synchronous wrapper
export const requireRole = jest.fn((roles: string[]) => {
  return (handler: any) => {
    return (req: AuthenticatedRequest, res: NextApiResponse) => {
      if (!req.user?.role || !roles.includes(req.user.role)) {
        res.status(403).json({ 
          error: 'Insufficient permissions',
          required: roles,
          current: req.user?.role || 'none'
        });
        return;
      }
      
      return handler(req, res);
    };
  };
});

// Mock authenticate - synchronous
export const authenticate = jest.fn((handler: any) => {
  return async (req: AuthenticatedRequest, res: NextApiResponse) => {
    if (req.headers['x-api-key']) {
      await authenticateApiKey(req, res);
    } else {
      await authenticateUser(req, res);
    }
    
    if (!req.user) {
      return;
    }
    
    return handler(req, res);
  };
});