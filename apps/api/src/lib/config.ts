/**
 * Centralized Environment Variable Configuration and Validation
 * This module validates all required environment variables at startup
 * to prevent runtime failures from missing configuration.
 */

import { z } from 'zod';

// Define the schema for environment variables
const envSchema = z.object({
  // Node environment
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  
  // Server configuration
  PORT: z.string().default('3001').transform(Number),
  
  // Supabase configuration
  SUPABASE_URL: z.string().url('SUPABASE_URL must be a valid URL'),
  SUPABASE_ANON_KEY: z.string().min(1, 'SUPABASE_ANON_KEY is required'),
  SUPABASE_SERVICE_KEY: z.string().min(1, 'SUPABASE_SERVICE_KEY is required'),
  
  // Frontend URL for CORS
  FRONTEND_URL: z.string().url('FRONTEND_URL must be a valid URL').optional(),
  
  // Redis configuration (optional but recommended)
  REDIS_URL: z.string().optional(),
  REDIS_PASSWORD: z.string().optional(),
  
  // Stripe configuration (optional for payments)
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  
  // OpenAI configuration (optional for AI features)
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_ORGANIZATION: z.string().optional(),
  
  // Anthropic configuration (optional for AI features)
  ANTHROPIC_API_KEY: z.string().optional(),
  
  // Google AI configuration (optional for AI features)
  GOOGLE_AI_API_KEY: z.string().optional(),
  
  // Email configuration (optional)
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().transform(Number).optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM: z.string().email().optional(),
  
  // Sentry configuration (optional for error tracking)
  SENTRY_DSN: z.string().url().optional(),
  
  // Security
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters').optional(),
  ENCRYPTION_KEY: z.string().min(32, 'ENCRYPTION_KEY must be at least 32 characters').optional(),
  
  // Feature flags
  ENABLE_RATE_LIMITING: z.string().transform(val => val === 'true').default('true'),
  ENABLE_WEBSOCKETS: z.string().transform(val => val === 'true').default('true'),
  ENABLE_FILE_UPLOADS: z.string().transform(val => val === 'true').default('true'),
  ENABLE_VOICE_CHAT: z.string().transform(val => val === 'true').default('false'),
  
  // Rate limiting
  RATE_LIMIT_WINDOW_MS: z.string().transform(Number).default('60000'), // 1 minute
  RATE_LIMIT_MAX_REQUESTS: z.string().transform(Number).default('100'),
  
  // File upload limits
  MAX_FILE_SIZE_MB: z.string().transform(Number).default('10'),
  ALLOWED_FILE_EXTENSIONS: z.string().default('.jpg,.jpeg,.png,.gif,.pdf,.doc,.docx'),
  
  // Session configuration
  SESSION_COOKIE_NAME: z.string().default('airi-session'),
  SESSION_COOKIE_MAX_AGE: z.string().transform(Number).default('86400000'), // 24 hours
  
  // Debug mode
  DEBUG: z.string().transform(val => val === 'true').default('false'),
});

// Type for the validated environment variables
export type Env = z.infer<typeof envSchema>;

// Function to validate environment variables
export function validateEnv(): Env {
  try {
    // Parse and validate environment variables
    const env = envSchema.parse(process.env);
    
    // Additional custom validations
    if (env.NODE_ENV === 'production') {
      // In production, certain variables become required
      if (!env.FRONTEND_URL) {
        throw new Error('FRONTEND_URL is required in production');
      }
      if (!env.JWT_SECRET) {
        throw new Error('JWT_SECRET is required in production');
      }
      if (!env.ENCRYPTION_KEY) {
        throw new Error('ENCRYPTION_KEY is required in production');
      }
      if (!env.REDIS_URL) {
        console.warn('⚠️  WARNING: Redis is not configured. Rate limiting will use in-memory storage, which is not suitable for production.');
      }
      if (!env.SENTRY_DSN) {
        console.warn('⚠️  WARNING: Sentry is not configured. Error tracking will not be available.');
      }
    }
    
    // Log successful validation
    console.log('✅ Environment variables validated successfully');
    
    // Log configuration summary (without sensitive data)
    console.log('📋 Configuration Summary:');
    console.log(`   - Environment: ${env.NODE_ENV}`);
    console.log(`   - Port: ${env.PORT}`);
    console.log(`   - Supabase URL: ${env.SUPABASE_URL}`);
    console.log(`   - Frontend URL: ${env.FRONTEND_URL || 'Not configured'}`);
    console.log(`   - Redis: ${env.REDIS_URL ? 'Configured' : 'Not configured'}`);
    console.log(`   - Stripe: ${env.STRIPE_SECRET_KEY ? 'Configured' : 'Not configured'}`);
    console.log(`   - OpenAI: ${env.OPENAI_API_KEY ? 'Configured' : 'Not configured'}`);
    console.log(`   - Anthropic: ${env.ANTHROPIC_API_KEY ? 'Configured' : 'Not configured'}`);
    console.log(`   - Email: ${env.SMTP_HOST ? 'Configured' : 'Not configured'}`);
    console.log(`   - Sentry: ${env.SENTRY_DSN ? 'Configured' : 'Not configured'}`);
    console.log(`   - Rate Limiting: ${env.ENABLE_RATE_LIMITING ? 'Enabled' : 'Disabled'}`);
    console.log(`   - WebSockets: ${env.ENABLE_WEBSOCKETS ? 'Enabled' : 'Disabled'}`);
    console.log(`   - File Uploads: ${env.ENABLE_FILE_UPLOADS ? 'Enabled' : 'Disabled'}`);
    console.log(`   - Voice Chat: ${env.ENABLE_VOICE_CHAT ? 'Enabled' : 'Disabled'}`);
    console.log(`   - Debug Mode: ${env.DEBUG ? 'Enabled' : 'Disabled'}`);
    
    return env;
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('❌ Environment variable validation failed:');
      error.errors.forEach(err => {
        console.error(`   - ${err.path.join('.')}: ${err.message}`);
      });
      console.error('\n📝 Please ensure all required environment variables are set correctly.');
      console.error('   You can use the .env.example file as a reference.');
    } else {
      console.error('❌ Environment validation error:', error);
    }
    
    // Exit the process if validation fails
    process.exit(1);
  }
}

// Singleton instance of validated environment variables
let config: Env | null = null;

/**
 * Get the validated configuration object
 * This function ensures validation only happens once
 */
export function getConfig(): Env {
  if (!config) {
    config = validateEnv();
  }
  return config;
}

/**
 * Helper function to check if we're in production
 */
export function isProduction(): boolean {
  return getConfig().NODE_ENV === 'production';
}

/**
 * Helper function to check if we're in development
 */
export function isDevelopment(): boolean {
  return getConfig().NODE_ENV === 'development';
}

/**
 * Helper function to check if we're in test environment
 */
export function isTest(): boolean {
  return getConfig().NODE_ENV === 'test';
}

/**
 * Helper function to get secure cookie settings
 */
export function getCookieSettings() {
  const config = getConfig();
  return {
    httpOnly: true,
    secure: isProduction(), // Only use secure cookies in production
    sameSite: 'strict' as const,
    maxAge: config.SESSION_COOKIE_MAX_AGE,
    path: '/',
  };
}

/**
 * Helper function to get CORS configuration
 */
export function getCorsConfig() {
  const config = getConfig();
  return {
    origin: config.FRONTEND_URL || (isDevelopment() ? 'http://localhost:5173' : false),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    maxAge: 86400, // 24 hours
  };
}

/**
 * Helper function to get rate limit configuration
 */
export function getRateLimitConfig() {
  const config = getConfig();
  return {
    enabled: config.ENABLE_RATE_LIMITING,
    windowMs: config.RATE_LIMIT_WINDOW_MS,
    max: config.RATE_LIMIT_MAX_REQUESTS,
  };
}

/**
 * Helper function to get file upload configuration
 */
export function getFileUploadConfig() {
  const config = getConfig();
  return {
    enabled: config.ENABLE_FILE_UPLOADS,
    maxFileSizeMB: config.MAX_FILE_SIZE_MB,
    allowedExtensions: config.ALLOWED_FILE_EXTENSIONS.split(',').map(ext => ext.trim()),
  };
}

// Export the config type for use in other modules
export type Config = Env;