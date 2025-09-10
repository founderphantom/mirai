import { NextApiRequest, NextApiResponse } from 'next';
import { authService } from '@/services/auth.service';
import { validate, schemas } from '@/middleware/validation';
import { asyncHandler } from '@/middleware/error';
import { getCookieSettings } from '@/lib/config';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Validate input
  await new Promise<void>((resolve) => validate(schemas.refreshToken)(req, res, resolve));

  const { refreshToken } = req.body;

  try {
    const session = await authService.refreshTokens(refreshToken);
    
    // Get secure cookie settings
    const cookieSettings = getCookieSettings();
    const secureFlag = cookieSettings.secure ? '; Secure' : '';
    
    // Set new cookies with proper security flags
    res.setHeader('Set-Cookie', [
      `access_token=${session.access_token}; HttpOnly; Path=${cookieSettings.path}; Max-Age=${session.expires_in}; SameSite=${cookieSettings.sameSite}${secureFlag}`,
      `refresh_token=${session.refresh_token}; HttpOnly; Path=${cookieSettings.path}; Max-Age=604800; SameSite=${cookieSettings.sameSite}${secureFlag}`,
    ]);

    res.status(200).json({
      success: true,
      session: {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expires_in: session.expires_in,
        token_type: session.token_type,
      },
    });
  } catch (error: any) {
    res.status(401).json({
      error: {
        message: error.message || 'Invalid refresh token',
      },
    });
  }
}

export default asyncHandler(handler);