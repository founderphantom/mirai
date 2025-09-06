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
      `access_token=${result.session.access_token}; HttpOnly; Path=/; Max-Age=${result.session.expires_in}; SameSite=Strict`,
      `refresh_token=${result.session.refresh_token}; HttpOnly; Path=/; Max-Age=604800; SameSite=Strict`,
    ]);

    res.status(201).json({
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
    res.status(400).json({
      error: {
        message: error.message || 'Failed to create account',
      },
    });
  }
}

export default asyncHandler(handler);