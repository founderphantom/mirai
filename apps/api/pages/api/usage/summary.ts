import { NextApiResponse } from 'next';
import { requireAuth, AuthenticatedRequest } from '@/middleware/auth';
import { validate, schemas } from '@/middleware/validation';
import { asyncHandler } from '@/middleware/error';
import { rateLimit } from '@/middleware/rateLimit';
import { dbHelpers, supabaseAdmin } from '@/lib/supabase';

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  // Apply rate limiting
  await new Promise<void>((resolve) => rateLimit(req, res, resolve));

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  return getUsageSummary(req, res);
}

async function getUsageSummary(req: AuthenticatedRequest, res: NextApiResponse) {
  try {
    const { 
      period = 'month', 
      start_date, 
      end_date,
      include_daily = false,
      include_providers = true,
      include_models = true,
    } = req.query;

    // Calculate date range based on period
    let startDate: Date;
    let endDate: Date = new Date();

    if (start_date && end_date) {
      startDate = new Date(start_date as string);
      endDate = new Date(end_date as string);
    } else {
      switch (period) {
        case 'day':
          startDate = new Date();
          startDate.setHours(0, 0, 0, 0);
          break;
        case 'week':
          startDate = new Date();
          startDate.setDate(startDate.getDate() - 7);
          startDate.setHours(0, 0, 0, 0);
          break;
        case 'month':
          startDate = new Date();
          startDate.setDate(1);
          startDate.setHours(0, 0, 0, 0);
          break;
        case 'year':
          startDate = new Date();
          startDate.setMonth(0, 1);
          startDate.setHours(0, 0, 0, 0);
          break;
        default:
          startDate = new Date();
          startDate.setDate(startDate.getDate() - 30);
          startDate.setHours(0, 0, 0, 0);
      }
    }

    // Get usage summary using RPC function
    const usageSummary: any = await dbHelpers.getUserUsageSummary(
      req.user!.id,
      startDate,
      endDate
    );

    // Get daily breakdown if requested
    let dailyBreakdown = null;
    if (include_daily === 'true') {
      const { data: dailyData, error: dailyError } = await (supabaseAdmin
        .from('usage_daily_aggregates') as any)
        .select('*')
        .eq('user_id', req.user!.id)
        .gte('date', startDate.toISOString().split('T')[0])
        .lte('date', endDate.toISOString().split('T')[0])
        .order('date', { ascending: false });

      if (!dailyError) {
        dailyBreakdown = dailyData;
      }
    }

    // Get provider breakdown if requested
    let providerBreakdown = null;
    if (include_providers === 'true' && dailyBreakdown) {
      providerBreakdown = dailyBreakdown.reduce((acc: any, day: any) => {
        if (day.provider_usage) {
          Object.entries(day.provider_usage).forEach(([provider, count]) => {
            acc[provider] = (acc[provider] || 0) + (count as number);
          });
        }
        return acc;
      }, {});
    }

    // Get model breakdown if requested
    let modelBreakdown = null;
    if (include_models === 'true' && dailyBreakdown) {
      modelBreakdown = dailyBreakdown.reduce((acc: any, day: any) => {
        if (day.model_usage) {
          Object.entries(day.model_usage).forEach(([model, count]) => {
            acc[model] = (acc[model] || 0) + (count as number);
          });
        }
        return acc;
      }, {});
    }

    // Get current subscription and limits
    const profile: any = await dbHelpers.getUserProfile(req.user!.id);
    const { data: subscription } = await dbHelpers.getUserSubscription(req.user!.id);

    // Calculate usage percentage based on tier limits
    const tierLimits: Record<string, number> = {
      free: 50,    // 50 messages per day
      plus: 500,   // 500 messages per day
      pro: -1,     // unlimited
      enterprise: -1, // unlimited
    };

    const tier = profile?.subscription_tier || 'free';
    const dailyLimit = tierLimits[tier];
    const todayUsage = dailyBreakdown?.find(
      (d: any) => d.date === new Date().toISOString().split('T')[0]
    );
    const usagePercentage = dailyLimit === -1 
      ? 0 
      : ((todayUsage?.message_count || 0) / dailyLimit) * 100;

    // Build response
    const response = {
      summary: {
        period: {
          start: startDate.toISOString(),
          end: endDate.toISOString(),
        },
        total_messages: usageSummary?.total_messages || 0,
        total_conversations: usageSummary?.total_conversations || 0,
        total_tokens: usageSummary?.total_tokens || 0,
        estimated_cost: usageSummary?.estimated_cost || 0,
        avg_messages_per_day: usageSummary?.avg_messages_per_day || 0,
        most_used_model: usageSummary?.most_used_model || null,
        most_used_provider: usageSummary?.most_used_provider || null,
        peak_usage_date: usageSummary?.peak_usage_date || null,
        peak_usage_count: usageSummary?.peak_usage_count || 0,
      },
      subscription: {
        tier: tier,
        status: profile?.subscription_status || 'active',
        daily_limit: dailyLimit === -1 ? 'unlimited' : dailyLimit,
        daily_usage: todayUsage?.message_count || 0,
        usage_percentage: usagePercentage,
        reset_at: new Date(Date.now() + (24 - new Date().getHours()) * 3600000).toISOString(),
      },
    };

    // Add optional data
    if (dailyBreakdown) {
      (response as any).daily_breakdown = dailyBreakdown;
    }
    if (providerBreakdown) {
      (response as any).provider_breakdown = providerBreakdown;
    }
    if (modelBreakdown) {
      (response as any).model_breakdown = modelBreakdown;
    }

    // Log the request
    await dbHelpers.logApiRequest(
      req.user!.id,
      '/api/usage/summary',
      'GET',
      200
    );

    res.status(200).json({
      success: true,
      data: response,
    });
  } catch (error: any) {
    console.error('Get usage summary error:', error);
    
    await dbHelpers.logApiRequest(
      req.user!.id,
      '/api/usage/summary',
      'GET',
      500
    );

    res.status(500).json({
      error: {
        message: error.message || 'Failed to fetch usage summary',
      },
    });
  }
}

export default requireAuth(asyncHandler(handler));