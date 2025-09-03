import { NextApiRequest, NextApiResponse } from 'next';
import winston from 'winston';

// Configure logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
  ],
});

// Add file transport in production
if (process.env.NODE_ENV === 'production' && process.env.LOG_FILE) {
  logger.add(new winston.transports.File({
    filename: process.env.LOG_FILE,
    maxsize: 10485760, // 10MB
    maxFiles: 5,
  }));
}

export { logger };

// Error types
export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string, statusCode: number, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400);
  }
}

export class AuthenticationError extends AppError {
  constructor(message = 'Authentication failed') {
    super(message, 401);
  }
}

export class AuthorizationError extends AppError {
  constructor(message = 'Insufficient permissions') {
    super(message, 403);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404);
  }
}

export class RateLimitError extends AppError {
  constructor(message = 'Too many requests') {
    super(message, 429);
  }
}

export class ExternalServiceError extends AppError {
  constructor(message: string, service: string) {
    super(`${service} error: ${message}`, 503);
  }
}

// Error handler middleware
export function errorHandler(
  error: Error | AppError,
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Log error
  logger.error({
    error: {
      message: error.message,
      stack: error.stack,
      name: error.name,
    },
    request: {
      method: req.method,
      url: req.url,
      headers: req.headers,
      query: req.query,
      body: req.body,
    },
    timestamp: new Date().toISOString(),
  });

  // Send error response
  if (error instanceof AppError) {
    return res.status(error.statusCode).json({
      error: {
        message: error.message,
        statusCode: error.statusCode,
        ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
      },
    });
  }

  // Handle Stripe errors
  if (error.constructor.name === 'StripeError') {
    const stripeError = error as any;
    return res.status(stripeError.statusCode || 400).json({
      error: {
        message: stripeError.message,
        type: stripeError.type,
        code: stripeError.code,
      },
    });
  }

  // Handle Supabase errors
  if (error.constructor.name === 'PostgrestError') {
    const supabaseError = error as any;
    return res.status(400).json({
      error: {
        message: supabaseError.message,
        details: supabaseError.details,
        hint: supabaseError.hint,
      },
    });
  }

  // Default error response
  const statusCode = (error as any).statusCode || 500;
  const message = process.env.NODE_ENV === 'production'
    ? 'Internal server error'
    : error.message;

  res.status(statusCode).json({
    error: {
      message,
      statusCode,
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
    },
  });
}

// Async error wrapper
export function asyncHandler(
  handler: (req: NextApiRequest, res: NextApiResponse) => Promise<void>
) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    try {
      await handler(req, res);
    } catch (error) {
      errorHandler(error as Error, req, res);
    }
  };
}

// Global error handling for unhandled rejections
process.on('unhandledRejection', (reason: Error | any, promise: Promise<any>) => {
  logger.error('Unhandled Rejection:', {
    reason: reason?.message || reason,
    stack: reason?.stack,
  });
});

process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught Exception:', {
    message: error.message,
    stack: error.stack,
  });
  
  // Exit process after logging
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
});

// Request logging middleware
export function requestLogger(
  req: NextApiRequest,
  res: NextApiResponse,
  next: () => void
) {
  const start = Date.now();
  
  // Log request
  logger.info({
    type: 'request',
    method: req.method,
    url: req.url,
    query: req.query,
    ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
    userAgent: req.headers['user-agent'],
  });

  // Override res.end to log response
  const originalEnd = res.end;
  res.end = function(...args: any[]) {
    const duration = Date.now() - start;
    
    // Log response
    logger.info({
      type: 'response',
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
    });

    return (originalEnd as any).apply(res, args);
  } as any;

  next();
}

// Performance monitoring
export function performanceMonitor(
  req: NextApiRequest,
  res: NextApiResponse,
  next: () => void
) {
  const start = process.hrtime.bigint();
  
  res.on('finish', () => {
    const end = process.hrtime.bigint();
    const duration = Number(end - start) / 1e6; // Convert to milliseconds
    
    // Log slow requests
    if (duration > 1000) {
      logger.warn({
        type: 'slow_request',
        method: req.method,
        url: req.url,
        duration: `${duration.toFixed(2)}ms`,
      });
    }
    
    // Set response header
    res.setHeader('X-Response-Time', `${duration.toFixed(2)}ms`);
  });

  next();
}