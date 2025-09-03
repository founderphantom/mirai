import { NextApiRequest, NextApiResponse } from 'next';
import { authService } from '@/services/auth.service';
import { validate, schemas } from '@/middleware/validation';
import { asyncHandler } from '@/middleware/error';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Validate input
  await new Promise<void>((resolve) => validate(schemas.refreshToken)(req, res, resolve));

  const { refreshToken } = req.body;

  try {
    const tokens = await authService.refreshTokens(refreshToken);
    
    // Set new cookies
    res.setHeader('Set-Cookie', [
      `access_token=${tokens.accessToken}; HttpOnly; Path=/; Max-Age=900; SameSite=Strict`,
      `refresh_token=${tokens.refreshToken}; HttpOnly; Path=/; Max-Age=604800; SameSite=Strict`,
    ]);

    res.status(200).json({
      success: true,
      accessToken: tokens.accessToken,
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