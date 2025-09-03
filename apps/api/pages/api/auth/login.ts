import { NextApiRequest, NextApiResponse } from 'next';
import { authService } from '@/services/auth.service';
import { validate, schemas } from '@/middleware/validation';
import { asyncHandler } from '@/middleware/error';
import { authRateLimit } from '@/middleware/rateLimit';

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
    
    // Set cookies for tokens
    res.setHeader('Set-Cookie', [
      `access_token=${result.accessToken}; HttpOnly; Path=/; Max-Age=900; SameSite=Strict`,
      `refresh_token=${result.refreshToken}; HttpOnly; Path=/; Max-Age=604800; SameSite=Strict`,
    ]);

    res.status(200).json({
      success: true,
      user: result.user,
      accessToken: result.accessToken,
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