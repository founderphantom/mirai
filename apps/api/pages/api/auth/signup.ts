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
  await new Promise<void>((resolve) => validate(schemas.signUp)(req, res, resolve));

  const { email, password, metadata } = req.body;

  try {
    const result = await authService.signUp(email, password, metadata);
    
    // Set cookies for tokens
    res.setHeader('Set-Cookie', [
      `access_token=${result.accessToken}; HttpOnly; Path=/; Max-Age=900; SameSite=Strict`,
      `refresh_token=${result.refreshToken}; HttpOnly; Path=/; Max-Age=604800; SameSite=Strict`,
    ]);

    res.status(201).json({
      success: true,
      user: result.user,
      accessToken: result.accessToken,
    });
  } catch (error: any) {
    res.status(400).json({
      error: {
        message: error.message || 'Failed to create account',
      },
    });
  }
}

export default asyncHandler(handler);