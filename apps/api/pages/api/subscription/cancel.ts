import { NextApiResponse } from 'next';
import { requireAuth, AuthenticatedRequest } from '@/middleware/auth';
import { asyncHandler } from '@/middleware/error';
import { stripeService } from '@/lib/stripe';

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { immediately = false } = req.body;

  try {
    const result = await stripeService.cancelSubscription(
      req.user!.id,
      immediately
    );

    res.status(200).json({
      success: true,
      data: {
        message: immediately 
          ? 'Subscription canceled immediately' 
          : 'Subscription will be canceled at the end of the current period',
        ...result,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      error: {
        message: error.message || 'Failed to cancel subscription',
      },
    });
  }
}

export default requireAuth(asyncHandler(handler));