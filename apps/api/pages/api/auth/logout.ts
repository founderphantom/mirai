import { NextApiRequest, NextApiResponse } from 'next';
import { requireAuth, AuthenticatedRequest } from '@/middleware/auth';
import { authService } from '@/services/auth.service';
import { asyncHandler } from '@/middleware/error';

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await authService.signOut(req.user!.id);
    
    // Clear cookies
    res.setHeader('Set-Cookie', [
      `access_token=; HttpOnly; Path=/; Max-Age=0; SameSite=Strict`,
      `refresh_token=; HttpOnly; Path=/; Max-Age=0; SameSite=Strict`,
    ]);

    res.status(200).json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error: any) {
    res.status(500).json({
      error: {
        message: error.message || 'Failed to logout',
      },
    });
  }
}

export default requireAuth(asyncHandler(handler));