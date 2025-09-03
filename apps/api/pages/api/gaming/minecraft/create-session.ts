import { NextApiResponse } from 'next';
import { requireAuth, requireSubscription, AuthenticatedRequest } from '@/middleware/auth';
import { asyncHandler } from '@/middleware/error';
import { rateLimit } from '@/middleware/rateLimit';
import { gamingService } from '@/services/gaming.service';

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Apply rate limiting
  await new Promise<void>((resolve) => rateLimit(req, res, resolve));

  const { serverId } = req.body;

  try {
    const session = await gamingService.createMinecraftSession(
      req.user!.id,
      serverId
    );

    res.status(201).json({
      success: true,
      data: session,
    });
  } catch (error: any) {
    res.status(500).json({
      error: {
        message: error.message || 'Failed to create Minecraft session',
      },
    });
  }
}

// Gaming features require at least basic subscription
export default requireSubscription(['basic', 'pro', 'enterprise'])(asyncHandler(handler));