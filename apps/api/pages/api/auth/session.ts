import { NextApiResponse } from 'next';
import { requireAuth, AuthenticatedRequest } from '@/middleware/auth';
import { authService } from '@/services/auth.service';
import { asyncHandler } from '@/middleware/error';

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const session = await authService.getSession(req.user!.id);
    
    res.status(200).json({
      success: true,
      session,
    });
  } catch (error: any) {
    res.status(500).json({
      error: {
        message: error.message || 'Failed to get session',
      },
    });
  }
}

export default requireAuth(asyncHandler(handler));