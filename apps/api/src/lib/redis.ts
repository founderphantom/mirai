import { Redis } from '@upstash/redis';
import { Ratelimit } from '@upstash/ratelimit';

// Validate environment variables
if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
  console.warn('Missing Upstash Redis environment variables. Rate limiting will be disabled.');
}

// Create Redis client
export const redis = process.env.UPSTASH_REDIS_REST_URL
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
  : null;

// Rate limit configurations
const RATE_LIMITS = {
  free: {
    requests: parseInt(process.env.RATE_LIMIT_FREE_REQUESTS || '100'),
    window: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '3600000'), // 1 hour
  },
  basic: {
    requests: parseInt(process.env.RATE_LIMIT_PRO_REQUESTS || '500'),
    window: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '3600000'),
  },
  pro: {
    requests: parseInt(process.env.RATE_LIMIT_PRO_REQUESTS || '1000'),
    window: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '3600000'),
  },
  enterprise: {
    requests: parseInt(process.env.RATE_LIMIT_ENTERPRISE_REQUESTS || '10000'),
    window: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '3600000'),
  },
};

// Create rate limiters for different tiers
export const rateLimiters = redis ? {
  free: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(
      RATE_LIMITS.free.requests,
      `${RATE_LIMITS.free.window}ms`
    ),
    analytics: true,
    prefix: 'ratelimit:free',
  }),
  basic: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(
      RATE_LIMITS.basic.requests,
      `${RATE_LIMITS.basic.window}ms`
    ),
    analytics: true,
    prefix: 'ratelimit:basic',
  }),
  pro: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(
      RATE_LIMITS.pro.requests,
      `${RATE_LIMITS.pro.window}ms`
    ),
    analytics: true,
    prefix: 'ratelimit:pro',
  }),
  enterprise: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(
      RATE_LIMITS.enterprise.requests,
      `${RATE_LIMITS.enterprise.window}ms`
    ),
    analytics: true,
    prefix: 'ratelimit:enterprise',
  }),
  // Special rate limiter for auth endpoints
  auth: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, '60s'), // 10 requests per minute
    analytics: true,
    prefix: 'ratelimit:auth',
  }),
  // Rate limiter for API key usage
  api: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(1000, '60s'), // 1000 requests per minute
    analytics: true,
    prefix: 'ratelimit:api',
  }),
} : null;

// Cache service for general caching needs
export class CacheService {
  private readonly defaultTTL = 3600; // 1 hour in seconds

  async get<T>(key: string): Promise<T | null> {
    if (!redis) return null;
    
    try {
      const data = await redis.get(key);
      return data as T;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  async set(key: string, value: any, ttl?: number): Promise<void> {
    if (!redis) return;
    
    try {
      await redis.set(key, value, {
        ex: ttl || this.defaultTTL,
      });
    } catch (error) {
      console.error('Cache set error:', error);
    }
  }

  async delete(key: string): Promise<void> {
    if (!redis) return;
    
    try {
      await redis.del(key);
    } catch (error) {
      console.error('Cache delete error:', error);
    }
  }

  async exists(key: string): Promise<boolean> {
    if (!redis) return false;
    
    try {
      const result = await redis.exists(key);
      return result === 1;
    } catch (error) {
      console.error('Cache exists error:', error);
      return false;
    }
  }

  async increment(key: string, amount = 1): Promise<number | null> {
    if (!redis) return null;
    
    try {
      const result = await redis.incrby(key, amount);
      return result;
    } catch (error) {
      console.error('Cache increment error:', error);
      return null;
    }
  }

  async expire(key: string, ttl: number): Promise<void> {
    if (!redis) return;
    
    try {
      await redis.expire(key, ttl);
    } catch (error) {
      console.error('Cache expire error:', error);
    }
  }

  // Pattern-specific cache methods
  async getUserSession(userId: string): Promise<any> {
    return this.get(`session:${userId}`);
  }

  async setUserSession(userId: string, session: any, ttl = 900): Promise<void> {
    return this.set(`session:${userId}`, session, ttl);
  }

  async getConversationContext(conversationId: string): Promise<any> {
    return this.get(`conversation:${conversationId}`);
  }

  async setConversationContext(conversationId: string, context: any, ttl = 1800): Promise<void> {
    return this.set(`conversation:${conversationId}`, context, ttl);
  }

  async getLLMResponse(prompt: string, model: string): Promise<string | null> {
    const key = `llm:${model}:${Buffer.from(prompt).toString('base64').substring(0, 100)}`;
    return this.get<string>(key);
  }

  async setLLMResponse(prompt: string, model: string, response: string, ttl = 300): Promise<void> {
    const key = `llm:${model}:${Buffer.from(prompt).toString('base64').substring(0, 100)}`;
    return this.set(key, response, ttl);
  }
}

export const cacheService = new CacheService();

// Queue service for background jobs
export class QueueService {
  async addJob(queue: string, data: any): Promise<void> {
    if (!redis) return;
    
    try {
      const jobId = `job:${Date.now()}:${Math.random().toString(36).substring(7)}`;
      await redis.lpush(`queue:${queue}`, JSON.stringify({
        id: jobId,
        data,
        timestamp: Date.now(),
      }));
    } catch (error) {
      console.error('Queue add job error:', error);
    }
  }

  async getJob(queue: string): Promise<any | null> {
    if (!redis) return null;
    
    try {
      const job = await redis.rpop(`queue:${queue}`);
      return job ? JSON.parse(job as string) : null;
    } catch (error) {
      console.error('Queue get job error:', error);
      return null;
    }
  }

  async getQueueLength(queue: string): Promise<number> {
    if (!redis) return 0;
    
    try {
      const length = await redis.llen(`queue:${queue}`);
      return length;
    } catch (error) {
      console.error('Queue length error:', error);
      return 0;
    }
  }
}

export const queueService = new QueueService();

// Session store for managing user sessions
export class SessionStore {
  private readonly sessionTTL = 86400; // 24 hours

  async createSession(userId: string, data: any): Promise<string> {
    if (!redis) {
      throw new Error('Redis not available');
    }

    const sessionId = `sess:${userId}:${Date.now()}:${Math.random().toString(36).substring(7)}`;
    
    await redis.set(sessionId, {
      userId,
      ...data,
      createdAt: Date.now(),
    }, {
      ex: this.sessionTTL,
    });

    return sessionId;
  }

  async getSession(sessionId: string): Promise<any | null> {
    if (!redis) return null;
    
    try {
      const session = await redis.get(sessionId);
      return session;
    } catch (error) {
      console.error('Session get error:', error);
      return null;
    }
  }

  async updateSession(sessionId: string, data: any): Promise<void> {
    if (!redis) return;
    
    try {
      const session = await this.getSession(sessionId);
      if (session) {
        await redis.set(sessionId, {
          ...session,
          ...data,
          updatedAt: Date.now(),
        }, {
          ex: this.sessionTTL,
        });
      }
    } catch (error) {
      console.error('Session update error:', error);
    }
  }

  async deleteSession(sessionId: string): Promise<void> {
    if (!redis) return;
    
    try {
      await redis.del(sessionId);
    } catch (error) {
      console.error('Session delete error:', error);
    }
  }

  async extendSession(sessionId: string): Promise<void> {
    if (!redis) return;
    
    try {
      await redis.expire(sessionId, this.sessionTTL);
    } catch (error) {
      console.error('Session extend error:', error);
    }
  }
}

export const sessionStore = new SessionStore();

// Analytics tracking
export class AnalyticsService {
  async trackEvent(event: string, userId: string, data?: any): Promise<void> {
    if (!redis) return;
    
    try {
      const key = `analytics:${event}:${new Date().toISOString().split('T')[0]}`;
      await redis.hincrby(key, userId, 1);
      
      // Store detailed event data
      if (data) {
        await redis.lpush(`analytics:events:${userId}`, JSON.stringify({
          event,
          data,
          timestamp: Date.now(),
        }));
      }
      
      // Set expiry for daily analytics (30 days)
      await redis.expire(key, 2592000);
    } catch (error) {
      console.error('Analytics track error:', error);
    }
  }

  async getEventCount(event: string, date?: string): Promise<number> {
    if (!redis) return 0;
    
    try {
      const dateStr = date || new Date().toISOString().split('T')[0];
      const key = `analytics:${event}:${dateStr}`;
      const data = await redis.hgetall(key);
      
      return Object.values(data || {}).reduce((sum: number, count: any) => sum + parseInt(count), 0);
    } catch (error) {
      console.error('Analytics get count error:', error);
      return 0;
    }
  }

  async getUserEvents(userId: string, limit = 100): Promise<any[]> {
    if (!redis) return [];
    
    try {
      const events = await redis.lrange(`analytics:events:${userId}`, 0, limit - 1);
      return events.map((e: any) => JSON.parse(e));
    } catch (error) {
      console.error('Analytics get user events error:', error);
      return [];
    }
  }
}

export const analyticsService = new AnalyticsService();