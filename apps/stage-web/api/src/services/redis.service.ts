import { createClient, RedisClientType } from 'redis';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

let redisClient: RedisClientType | null = null;

/**
 * Initialize Redis connection
 */
export const initializeRedis = async (): Promise<void> => {
  if (!config.features.enableCache) {
    logger.info('Redis caching is disabled');
    return;
  }

  try {
    redisClient = createClient({
      url: config.redis.url,
      password: config.redis.password || undefined,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            logger.error('Redis: Max reconnection attempts reached');
            return new Error('Max reconnection attempts reached');
          }
          return Math.min(retries * 100, 3000);
        },
      },
    });

    redisClient.on('error', (err) => {
      logger.error('Redis Client Error:', err);
    });

    redisClient.on('connect', () => {
      logger.info('Redis Client Connected');
    });

    redisClient.on('ready', () => {
      logger.info('Redis Client Ready');
    });

    await redisClient.connect();
  } catch (error) {
    logger.error('Failed to initialize Redis:', error);
    // Don't throw - allow app to run without cache
  }
};

/**
 * Get Redis client
 */
export const getRedisClient = (): RedisClientType | null => {
  return redisClient;
};

/**
 * Close Redis connection
 */
export const closeRedis = async (): Promise<void> => {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    logger.info('Redis connection closed');
  }
};

/**
 * Cache service wrapper
 */
export const cache = {
  /**
   * Get value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    if (!redisClient) return null;
    
    try {
      const value = await redisClient.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.error(`Cache get error for key ${key}:`, error);
      return null;
    }
  },

  /**
   * Set value in cache
   */
  async set(key: string, value: any, ttl?: number): Promise<void> {
    if (!redisClient) return;
    
    try {
      const serialized = JSON.stringify(value);
      if (ttl) {
        await redisClient.setEx(key, ttl, serialized);
      } else {
        await redisClient.set(key, serialized);
      }
    } catch (error) {
      logger.error(`Cache set error for key ${key}:`, error);
    }
  },

  /**
   * Delete value from cache
   */
  async delete(key: string): Promise<void> {
    if (!redisClient) return;
    
    try {
      await redisClient.del(key);
    } catch (error) {
      logger.error(`Cache delete error for key ${key}:`, error);
    }
  },

  /**
   * Delete multiple keys matching a pattern
   */
  async deletePattern(pattern: string): Promise<void> {
    if (!redisClient) return;
    
    try {
      const keys = await redisClient.keys(pattern);
      if (keys.length > 0) {
        await redisClient.del(keys);
      }
    } catch (error) {
      logger.error(`Cache delete pattern error for ${pattern}:`, error);
    }
  },

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    if (!redisClient) return false;
    
    try {
      const result = await redisClient.exists(key);
      return result === 1;
    } catch (error) {
      logger.error(`Cache exists error for key ${key}:`, error);
      return false;
    }
  },

  /**
   * Get remaining TTL for a key
   */
  async ttl(key: string): Promise<number> {
    if (!redisClient) return -1;
    
    try {
      return await redisClient.ttl(key);
    } catch (error) {
      logger.error(`Cache TTL error for key ${key}:`, error);
      return -1;
    }
  },

  /**
   * Increment a counter
   */
  async incr(key: string, by: number = 1): Promise<number> {
    if (!redisClient) return 0;
    
    try {
      if (by === 1) {
        return await redisClient.incr(key);
      } else {
        return await redisClient.incrBy(key, by);
      }
    } catch (error) {
      logger.error(`Cache incr error for key ${key}:`, error);
      return 0;
    }
  },

  /**
   * Set value with expiration (atomic)
   */
  async setNX(key: string, value: any, ttl: number): Promise<boolean> {
    if (!redisClient) return false;
    
    try {
      const serialized = JSON.stringify(value);
      const result = await redisClient.set(key, serialized, {
        NX: true,
        EX: ttl,
      });
      return result === 'OK';
    } catch (error) {
      logger.error(`Cache setNX error for key ${key}:`, error);
      return false;
    }
  },
};

/**
 * Cache key generators
 */
export const cacheKeys = {
  user: (userId: string) => `${config.cache.users.prefix}${userId}`,
  conversation: (conversationId: string) => `${config.cache.conversations.prefix}${conversationId}`,
  conversationList: (userId: string) => `${config.cache.conversations.prefix}list:${userId}`,
  message: (messageId: string) => `${config.cache.messages.prefix}${messageId}`,
  messageList: (conversationId: string) => `${config.cache.messages.prefix}list:${conversationId}`,
  provider: (providerId: string) => `${config.cache.providers.prefix}${providerId}`,
  providerHealth: () => `${config.cache.providers.prefix}health`,
  rateLimit: (userId: string, endpoint: string) => `ratelimit:${userId}:${endpoint}`,
  session: (sessionId: string) => `session:${sessionId}`,
  verification: (email: string) => `verify:${email}`,
  passwordReset: (token: string) => `reset:${token}`,
};

/**
 * Cache decorators for common patterns
 */
export const cacheDecorators = {
  /**
   * Cache the result of a function
   */
  memoize: <T>(
    fn: (...args: any[]) => Promise<T>,
    keyGenerator: (...args: any[]) => string,
    ttl: number = config.redis.ttl.default
  ) => {
    return async (...args: any[]): Promise<T> => {
      const key = keyGenerator(...args);
      
      // Try to get from cache
      const cached = await cache.get<T>(key);
      if (cached !== null) {
        logger.debug(`Cache hit for ${key}`);
        return cached;
      }
      
      // Execute function and cache result
      const result = await fn(...args);
      await cache.set(key, result, ttl);
      logger.debug(`Cache miss for ${key}, cached with TTL ${ttl}`);
      
      return result;
    };
  },

  /**
   * Invalidate cache after function execution
   */
  invalidate: <T>(
    fn: (...args: any[]) => Promise<T>,
    keyPatterns: (...args: any[]) => string[]
  ) => {
    return async (...args: any[]): Promise<T> => {
      const result = await fn(...args);
      
      // Invalidate related cache keys
      const patterns = keyPatterns(...args);
      for (const pattern of patterns) {
        await cache.deletePattern(pattern);
        logger.debug(`Cache invalidated for pattern ${pattern}`);
      }
      
      return result;
    };
  },
};