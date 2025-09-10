import { NextApiRequest, NextApiResponse } from 'next';
import { authService } from '@/services/auth.service';
import { validate, schemas } from '@/middleware/validation';
import { asyncHandler } from '@/middleware/error';
import { authRateLimit } from '@/middleware/rateLimit';
import { getCookieSettings, isProduction } from '@/lib/config';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Apply rate limiting
  await new Promise<void>((resolve) => authRateLimit(req, res, resolve));

  // Validate input
  await new Promise<void>((resolve) => validate(schemas.signIn)(req, res, resolve));

  const { email, password } = req.body;

  try {
    const result = await authService.signIn(email, password);
    
    // Get secure cookie settings
    const cookieSettings = getCookieSettings();
    const secureFlag = cookieSettings.secure ? '; Secure' : '';
    
    // Set cookies for tokens with proper security flags
    res.setHeader('Set-Cookie', [
      `access_token=${result.session.access_token}; HttpOnly; Path=${cookieSettings.path}; Max-Age=${result.session.expires_in}; SameSite=${cookieSettings.sameSite}${secureFlag}`,
      `refresh_token=${result.session.refresh_token}; HttpOnly; Path=${cookieSettings.path}; Max-Age=604800; SameSite=${cookieSettings.sameSite}${secureFlag}`,
    ]);

    res.status(200).json({
      success: true,
      user: result.user,
      session: {
        access_token: result.session.access_token,
        refresh_token: result.session.refresh_token,
        expires_in: result.session.expires_in,
        token_type: result.session.token_type,
      },
    });
  } catch (error: any) {
    res.status(401).json({
      error: {
        message: error.message || 'Authentication failed',
      },
    });
  }
}

export default asyncHandler(handler);