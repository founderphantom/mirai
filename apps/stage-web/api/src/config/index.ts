import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

// Environment variable schema
const envSchema = z.object({
  // Server
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3000'),
  API_VERSION: z.string().default('v1'),
  FRONTEND_URL: z.string().url(),
  
  // Supabase
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string(),
  SUPABASE_SERVICE_KEY: z.string(),
  SUPABASE_JWT_SECRET: z.string(),
  DATABASE_URL: z.string(),
  
  // Redis
  REDIS_URL: z.string().optional(),
  REDIS_PASSWORD: z.string().optional(),
  
  // JWT
  JWT_SECRET: z.string(),
  JWT_EXPIRES_IN: z.string().default('7d'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),
  
  // Stripe
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  
  // AI Providers
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  GOOGLE_AI_API_KEY: z.string().optional(),
  GROQ_API_KEY: z.string().optional(),
  
  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.string().default('900000'),
  RATE_LIMIT_MAX_REQUESTS: z.string().default('100'),
  
  // Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  LOG_FILE_PATH: z.string().default('./logs/api.log'),
  
  // CORS
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
  
  // Features
  ENABLE_WEBSOCKETS: z.string().default('true'),
  ENABLE_RATE_LIMITING: z.string().default('true'),
  ENABLE_CACHE: z.string().default('true'),
  ENABLE_MONITORING: z.string().default('false'),
});

// Parse and validate environment variables
const env = envSchema.parse(process.env);

// Application configuration
export const config = {
  server: {
    env: env.NODE_ENV,
    port: parseInt(env.PORT, 10),
    frontendUrl: env.FRONTEND_URL,
  },
  
  api: {
    version: env.API_VERSION,
    prefix: `/api/${env.API_VERSION}`,
  },
  
  database: {
    url: env.DATABASE_URL,
  },
  
  supabase: {
    url: env.SUPABASE_URL,
    anonKey: env.SUPABASE_ANON_KEY,
    serviceKey: env.SUPABASE_SERVICE_KEY,
    jwtSecret: env.SUPABASE_JWT_SECRET,
  },
  
  redis: {
    url: env.REDIS_URL || 'redis://localhost:6379',
    password: env.REDIS_PASSWORD,
    ttl: {
      default: 3600, // 1 hour
      session: 86400, // 24 hours
      cache: 300, // 5 minutes
    },
  },
  
  jwt: {
    secret: env.JWT_SECRET,
    expiresIn: env.JWT_EXPIRES_IN,
    refreshExpiresIn: env.JWT_REFRESH_EXPIRES_IN,
  },
  
  stripe: {
    secretKey: env.STRIPE_SECRET_KEY,
    webhookSecret: env.STRIPE_WEBHOOK_SECRET,
    prices: {
      plus: process.env.STRIPE_PRICE_ID_PLUS,
      pro: process.env.STRIPE_PRICE_ID_PRO,
      enterprise: process.env.STRIPE_PRICE_ID_ENTERPRISE,
    },
  },
  
  aiProviders: {
    openai: {
      apiKey: env.OPENAI_API_KEY,
      models: ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo'],
    },
    anthropic: {
      apiKey: env.ANTHROPIC_API_KEY,
      models: ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku'],
    },
    google: {
      apiKey: env.GOOGLE_AI_API_KEY,
      models: ['gemini-pro', 'gemini-pro-vision'],
    },
    groq: {
      apiKey: env.GROQ_API_KEY,
      models: ['llama-3-70b', 'mixtral-8x7b'],
    },
  },
  
  rateLimit: {
    windowMs: parseInt(env.RATE_LIMIT_WINDOW_MS, 10),
    maxRequests: parseInt(env.RATE_LIMIT_MAX_REQUESTS, 10),
    tiers: {
      free: {
        windowMs: 900000, // 15 minutes
        maxRequests: 50,
        messagesPerDay: 50,
      },
      plus: {
        windowMs: 900000,
        maxRequests: 500,
        messagesPerDay: 500,
      },
      pro: {
        windowMs: 900000,
        maxRequests: 5000,
        messagesPerDay: -1, // unlimited
      },
      enterprise: {
        windowMs: 900000,
        maxRequests: 10000,
        messagesPerDay: -1,
      },
    },
  },
  
  logging: {
    level: env.LOG_LEVEL,
    filePath: env.LOG_FILE_PATH,
  },
  
  cors: {
    origins: env.CORS_ORIGINS.split(',').map(origin => origin.trim()),
  },
  
  features: {
    enableWebsockets: env.ENABLE_WEBSOCKETS === 'true',
    enableRateLimiting: env.ENABLE_RATE_LIMITING === 'true',
    enableCache: env.ENABLE_CACHE === 'true',
    enableMonitoring: env.ENABLE_MONITORING === 'true',
  },
  
  limits: {
    maxMessageLength: 10000,
    maxConversationMessages: 1000,
    maxAttachmentSize: 10 * 1024 * 1024, // 10MB
    maxAttachmentsPerMessage: 5,
  },
  
  cache: {
    conversations: {
      ttl: 300, // 5 minutes
      prefix: 'conv:',
    },
    messages: {
      ttl: 600, // 10 minutes
      prefix: 'msg:',
    },
    users: {
      ttl: 3600, // 1 hour
      prefix: 'user:',
    },
    providers: {
      ttl: 1800, // 30 minutes
      prefix: 'provider:',
    },
  },
};

// Export type for TypeScript
export type Config = typeof config;