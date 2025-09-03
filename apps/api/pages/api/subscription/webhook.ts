import { NextApiRequest, NextApiResponse } from 'next';
import { buffer } from 'micro';
import { stripe, stripeService } from '@/lib/stripe';
import { asyncHandler } from '@/middleware/error';

// Disable body parser for webhook
export const config = {
  api: {
    bodyParser: false,
  },
};

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const signature = req.headers['stripe-signature'];
  
  if (!signature) {
    return res.status(400).json({ error: 'Missing stripe signature' });
  }

  try {
    const rawBody = await buffer(req);
    const event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );

    await stripeService.handleWebhookEvent(event);

    res.status(200).json({ received: true });
  } catch (error: any) {
    console.error('Webhook error:', error);
    res.status(400).json({
      error: {
        message: `Webhook error: ${error.message}`,
      },
    });
  }
}

export default asyncHandler(handler);