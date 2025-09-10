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
    // Get user's subscription from user_profiles
    const { data: userProfile, error } = await (supabaseAdmin
      .from('user_profiles') as any)
      .select('*')
      .eq('id', req.user!.id)
      .single();

    if (error || !userProfile || !userProfile.subscription_tier || userProfile.subscription_tier === 'free') {
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
    const tierFeatures = SUBSCRIPTION_TIERS[userProfile.subscription_tier as keyof typeof SUBSCRIPTION_TIERS];

    // Get usage for current period (use beginning of current month)
    const currentPeriodStart = new Date();
    currentPeriodStart.setDate(1);
    currentPeriodStart.setHours(0, 0, 0, 0);
    const { data: usage } = await (supabaseAdmin
      .from('usage_logs') as any)
      .select('total_tokens')
      .eq('user_id', req.user!.id)
      .gte('created_at', currentPeriodStart.toISOString());

    const totalTokens = usage?.reduce((sum: number, record: any) => sum + (record.total_tokens || 0), 0) || 0;

    res.status(200).json({
      success: true,
      data: {
        id: userProfile.id,
        plan: userProfile.subscription_tier,
        status: userProfile.subscription_status || 'active',
        stripe_customer_id: userProfile.stripe_customer_id,
        stripe_subscription_id: userProfile.stripe_subscription_id,
        trial_ends_at: userProfile.trial_ends_at,
        subscription_ends_at: userProfile.subscription_ends_at,
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