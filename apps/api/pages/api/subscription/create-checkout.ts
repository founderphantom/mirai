import { NextApiResponse } from 'next';
import { requireAuth, AuthenticatedRequest } from '@/middleware/auth';
import { validate, schemas } from '@/middleware/validation';
import { asyncHandler } from '@/middleware/error';
import { stripeService } from '@/lib/stripe';

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Validate request body
  await new Promise<void>((resolve) => 
    validate(schemas.createCheckout)(req, res, resolve)
  );

  const { priceId, successUrl, cancelUrl } = req.body;

  try {
    const session = await stripeService.createCheckoutSession(
      req.user!.id,
      req.user!.email,
      priceId,
      successUrl,
      cancelUrl
    );

    res.status(200).json({
      success: true,
      data: {
        checkoutUrl: session.url,
        sessionId: session.id,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      error: {
        message: error.message || 'Failed to create checkout session',
      },
    });
  }
}

export default requireAuth(asyncHandler(handler));