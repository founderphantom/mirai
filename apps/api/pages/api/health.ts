import { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '@/lib/supabase';
import { redis } from '@/lib/redis';
import { stripe } from '@/lib/stripe';
import { llmService } from '@/services/llm.service';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    services: {
      database: 'unknown',
      redis: 'unknown',
      stripe: 'unknown',
      llm: 'unknown',
    },
    environment: process.env.NODE_ENV,
    version: process.env.npm_package_version || '1.0.0',
  };

  // Check database
  try {
    const { error } = await supabase.from('user_profiles').select('id').limit(1);
    health.services.database = error ? 'unhealthy' : 'healthy';
  } catch {
    health.services.database = 'unhealthy';
  }

  // Check Redis
  try {
    if (redis) {
      await redis.ping();
      health.services.redis = 'healthy';
    } else {
      health.services.redis = 'not configured';
    }
  } catch {
    health.services.redis = 'unhealthy';
  }

  // Check Stripe
  try {
    await stripe.customers.list({ limit: 1 });
    health.services.stripe = 'healthy';
  } catch {
    health.services.stripe = 'unhealthy';
  }

  // Check LLM providers
  try {
    const models = llmService.getAvailableModels();
    health.services.llm = Object.keys(models).length > 0 ? 'healthy' : 'no providers';
  } catch {
    health.services.llm = 'unhealthy';
  }

  // Determine overall health
  const unhealthyServices = Object.values(health.services).filter(
    status => status === 'unhealthy'
  );
  
  if (unhealthyServices.length > 0) {
    health.status = 'degraded';
  }

  const statusCode = health.status === 'healthy' ? 200 : 503;
  
  res.status(statusCode).json(health);
}