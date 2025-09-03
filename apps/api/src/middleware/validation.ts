import { NextApiRequest, NextApiResponse } from 'next';
import { z, ZodError, ZodSchema } from 'zod';
import { ValidationError } from './error';

// Common validation schemas
export const schemas = {
  // Auth schemas
  signUp: z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    metadata: z.record(z.any()).optional(),
  }),

  signIn: z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(1, 'Password is required'),
  }),

  refreshToken: z.object({
    refreshToken: z.string().min(1, 'Refresh token is required'),
  }),

  resetPassword: z.object({
    email: z.string().email('Invalid email address'),
  }),

  updatePassword: z.object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string().min(8, 'New password must be at least 8 characters'),
  }),

  // Chat schemas
  createConversation: z.object({
    title: z.string().min(1).max(255).optional(),
    model_id: z.string().default('gpt-3.5-turbo'),
    provider_id: z.string().default('openai'),
    system_prompt: z.string().optional(),
    temperature: z.number().min(0).max(2).optional(),
    max_tokens: z.number().min(1).max(32000).optional(),
    avatar_id: z.string().optional(),
    voice_id: z.string().optional(),
    personality_template: z.string().optional(),
    settings: z.record(z.any()).optional(),
    metadata: z.record(z.any()).optional(),
  }),

  sendMessage: z.object({
    content: z.string().min(1).max(10000),
    model: z.string().optional(),
    temperature: z.number().min(0).max(2).optional(),
    maxTokens: z.number().min(1).max(4096).optional(),
    stream: z.boolean().optional(),
  }),

  // Subscription schemas
  createCheckout: z.object({
    priceId: z.string().min(1),
    successUrl: z.string().url(),
    cancelUrl: z.string().url(),
  }),

  // Voice schemas
  textToSpeech: z.object({
    text: z.string().min(1).max(5000),
    voice: z.string().optional(),
    language: z.string().optional(),
    speed: z.number().min(0.5).max(2).optional(),
  }),

  speechToText: z.object({
    audio: z.string().min(1), // Base64 encoded audio
    language: z.string().optional(),
  }),

  // Gaming schemas
  createGamingSession: z.object({
    game: z.enum(['minecraft', 'roblox', 'fortnite']),
    serverId: z.string().optional(),
    metadata: z.record(z.any()).optional(),
  }),

  // Pagination
  pagination: z.object({
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(100).default(20),
    sort: z.string().optional(),
    order: z.enum(['asc', 'desc']).default('desc'),
    before_id: z.string().uuid().optional(),
    include_archived: z.coerce.boolean().optional(),
    starred_only: z.coerce.boolean().optional(),
  }),

  // ID parameters
  id: z.object({
    id: z.string().uuid('Invalid ID format'),
  }),

  // Query filters
  conversationFilters: z.object({
    isArchived: z.coerce.boolean().optional(),
    aiModel: z.string().optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
  }),

  // User profile schemas
  updateProfile: z.object({
    username: z.string().min(3).max(50).optional(),
    display_name: z.string().max(100).optional(),
    avatar_url: z.string().url().optional().nullable(),
    bio: z.string().max(500).optional(),
    preferences: z.record(z.any()).optional(),
    metadata: z.record(z.any()).optional(),
  }),

  // Search schemas
  searchMessages: z.object({
    q: z.string().min(2).optional(),
    query: z.string().min(2).optional(),
    limit: z.coerce.number().min(1).max(100).default(20),
    offset: z.coerce.number().min(0).default(0),
    conversation_id: z.string().uuid().optional(),
    include_context: z.coerce.boolean().default(true),
    highlight: z.coerce.boolean().default(true),
  }).refine(
    (data) => data.q || data.query,
    { message: 'Either q or query parameter is required' }
  ),

  // Usage schemas
  usageSummary: z.object({
    period: z.enum(['day', 'week', 'month', 'year']).default('month'),
    start_date: z.string().optional(),
    end_date: z.string().optional(),
    include_daily: z.coerce.boolean().optional(),
    include_providers: z.coerce.boolean().optional(),
    include_models: z.coerce.boolean().optional(),
  }),

  // Message management schemas
  updateMessage: z.object({
    rating: z.number().min(1).max(5).optional(),
    feedback: z.string().max(1000).optional(),
  }),
};

// Validation middleware factory
export function validate(schema: ZodSchema) {
  return async (req: NextApiRequest, res: NextApiResponse, next?: () => void) => {
    try {
      // Validate request body, query, or params based on method
      const dataToValidate = req.method === 'GET' ? req.query : req.body;
      
      const validated = await schema.parseAsync(dataToValidate);
      
      // Replace with validated data (with defaults applied)
      if (req.method === 'GET') {
        req.query = validated;
      } else {
        req.body = validated;
      }

      if (next) next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errors = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
        }));

        res.status(400).json({
          error: {
            message: 'Validation failed',
            errors,
          },
        });
      } else {
        res.status(400).json({
          error: {
            message: 'Invalid request data',
          },
        });
      }
    }
  };
}

// Validate with custom error handling
export function validateWithHandler(
  schema: ZodSchema,
  handler: (req: NextApiRequest, res: NextApiResponse) => Promise<void>
) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    try {
      const dataToValidate = req.method === 'GET' ? req.query : req.body;
      const validated = await schema.parseAsync(dataToValidate);
      
      if (req.method === 'GET') {
        req.query = validated;
      } else {
        req.body = validated;
      }

      return handler(req, res);
    } catch (error) {
      if (error instanceof ZodError) {
        const errors = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
        }));

        return res.status(400).json({
          error: {
            message: 'Validation failed',
            errors,
          },
        });
      }
      
      throw error;
    }
  };
}

// Sanitization helpers
export const sanitize = {
  // Remove HTML tags
  stripHtml(input: string): string {
    return input.replace(/<[^>]*>?/gm, '');
  },

  // Escape HTML entities
  escapeHtml(input: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#x27;',
      '/': '&#x2F;',
    };
    return input.replace(/[&<>"'/]/g, (char) => map[char]);
  },

  // Normalize whitespace
  normalizeWhitespace(input: string): string {
    return input.replace(/\s+/g, ' ').trim();
  },

  // Remove non-printable characters
  removeNonPrintable(input: string): string {
    return input.replace(/[^\x20-\x7E]/g, '');
  },

  // Sanitize filename
  filename(input: string): string {
    return input.replace(/[^a-zA-Z0-9.-]/g, '_');
  },

  // Sanitize URL
  url(input: string): string {
    try {
      const url = new URL(input);
      return url.toString();
    } catch {
      throw new ValidationError('Invalid URL');
    }
  },
};

// Input sanitization middleware
export function sanitizeInput(req: NextApiRequest, res: NextApiResponse, next: () => void) {
  // Sanitize query parameters
  if (req.query) {
    Object.keys(req.query).forEach(key => {
      if (typeof req.query[key] === 'string') {
        req.query[key] = sanitize.normalizeWhitespace(req.query[key] as string);
      }
    });
  }

  // Sanitize body
  if (req.body && typeof req.body === 'object') {
    const sanitizeObject = (obj: any): any => {
      if (typeof obj === 'string') {
        return sanitize.normalizeWhitespace(obj);
      }
      if (Array.isArray(obj)) {
        return obj.map(sanitizeObject);
      }
      if (obj && typeof obj === 'object') {
        const sanitized: any = {};
        Object.keys(obj).forEach(key => {
          sanitized[key] = sanitizeObject(obj[key]);
        });
        return sanitized;
      }
      return obj;
    };

    req.body = sanitizeObject(req.body);
  }

  next();
}

// Custom validators
export const validators = {
  // Check if string is a valid UUID
  isUUID(value: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(value);
  },

  // Check if string is a valid email
  isEmail(value: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value);
  },

  // Check if string is a valid URL
  isURL(value: string): boolean {
    try {
      new URL(value);
      return true;
    } catch {
      return false;
    }
  },

  // Check if string is a valid JWT
  isJWT(value: string): boolean {
    const jwtRegex = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/;
    return jwtRegex.test(value);
  },

  // Check password strength
  isStrongPassword(value: string): boolean {
    // At least 8 characters, 1 uppercase, 1 lowercase, 1 number, 1 special character
    const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    return strongPasswordRegex.test(value);
  },
};