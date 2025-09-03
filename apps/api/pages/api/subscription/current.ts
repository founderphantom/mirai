import { NextApiResponse } from 'next';
import { requireAuth, AuthenticatedRequest } from '@/middleware/auth';
import { asyncHandler } from '@/middleware/error';
import { supabaseAdmin } from '@/lib/supabase';
import { SUBSCRIPTION_TIERS } from '@/lib/stripe';

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get user's subscription
    const { data: subscription, error } = await (supabaseAdmin
      .from('subscriptions') as any)
      .select('*')
      .eq('user_id', req.user!.id)
      .eq('status', 'active')
      .single();

    if (error || !subscription) {
      // Return free tier if no subscription
      return res.status(200).json({
        success: true,
        data: {
          plan: 'free',
          features: SUBSCRIPTION_TIERS.free.features,
          status: 'active',
        },
      });
    }

    // Get tier features
    const tierFeatures = SUBSCRIPTION_TIERS[(subscription as any).plan_id as keyof typeof SUBSCRIPTION_TIERS];

    // Get usage for current period
    const currentPeriodStart = new Date((subscription as any).current_period_start);
    const { data: usage } = await (supabaseAdmin
      .from('usage_metrics') as any)
      .select('tokens_used')
      .eq('user_id', req.user!.id)
      .gte('timestamp', currentPeriodStart.toISOString());

    const totalTokens = usage?.reduce((sum: number, record: any) => sum + record.tokens_used, 0) || 0;

    res.status(200).json({
      success: true,
      data: {
        ...(subscription as any),
        features: tierFeatures?.features,
        usage: {
          tokens: totalTokens,
          messagesUsed: Math.floor(totalTokens / 100), // Rough estimate
        },
      },
    });
  } catch (error: any) {
    res.status(500).json({
      error: {
        message: error.message || 'Failed to fetch subscription',
      },
    });
  }
}

export default requireAuth(asyncHandler(handler));