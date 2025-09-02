import { Request, Response } from 'express';
import { getAdminClient } from '../database/connection.js';
import { checkDatabaseHealth } from '../database/connection.js';
import { getRedisClient } from '../services/redis.service.js';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

/**
 * Basic health check
 */
export const healthCheck = async (req: Request, res: Response) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: config.api.version,
    environment: config.server.env,
  });
};

/**
 * Liveness probe - checks if service is alive
 */
export const liveness = async (req: Request, res: Response) => {
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString(),
  });
};

/**
 * Readiness probe - checks if service is ready to accept traffic
 */
export const readiness = async (req: Request, res: Response) => {
  try {
    const checks = {
      database: false,
      redis: false,
    };
    
    // Check database
    checks.database = await checkDatabaseHealth();
    
    // Check Redis
    const redisClient = getRedisClient();
    if (redisClient) {
      try {
        await redisClient.ping();
        checks.redis = true;
      } catch {
        checks.redis = false;
      }
    } else {
      checks.redis = !config.features.enableCache; // Redis is optional
    }
    
    // Determine overall readiness
    const isReady = checks.database && (checks.redis || !config.features.enableCache);
    
    if (isReady) {
      res.status(200).json({
        status: 'ready',
        checks,
        timestamp: new Date().toISOString(),
      });
    } else {
      res.status(503).json({
        status: 'not ready',
        checks,
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    logger.error('Readiness check failed:', error);
    res.status(503).json({
      status: 'error',
      message: 'Health check failed',
      timestamp: new Date().toISOString(),
    });
  }
};

/**
 * Get AI provider health status
 */
export const providerHealth = async (req: Request, res: Response) => {
  try {
    const adminClient = getAdminClient();
    const { data: providers, error } = await adminClient
      .from('provider_health')
      .select('*')
      .order('name');
    
    if (error) {
      throw error;
    }
    
    res.status(200).json({
      providers: providers || [],
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Provider health check failed:', error);
    res.status(500).json({
      error: 'Failed to get provider health',
      timestamp: new Date().toISOString(),
    });
  }
};