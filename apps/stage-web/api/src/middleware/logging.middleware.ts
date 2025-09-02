import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';
import { v4 as uuidv4 } from 'nanoid';

// Extend Request to include request ID
declare global {
  namespace Express {
    interface Request {
      id?: string;
      startTime?: number;
    }
  }
}

/**
 * Add request ID and start time to request
 */
export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  // Generate unique request ID
  req.id = uuidv4();
  req.startTime = Date.now();
  
  // Add request ID to response headers
  res.setHeader('X-Request-Id', req.id);
  
  // Log incoming request
  logger.info('Incoming request', {
    requestId: req.id,
    method: req.method,
    url: req.url,
    query: req.query,
    ip: req.ip,
    userAgent: req.get('user-agent'),
    userId: req.user?.id,
  });
  
  // Log response when finished
  res.on('finish', () => {
    const duration = req.startTime ? Date.now() - req.startTime : 0;
    
    logger.info('Request completed', {
      requestId: req.id,
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      userId: req.user?.id,
    });
    
    // Log slow requests
    if (duration > 1000) {
      logger.warn('Slow request detected', {
        requestId: req.id,
        method: req.method,
        url: req.url,
        duration: `${duration}ms`,
        userId: req.user?.id,
      });
    }
  });
  
  next();
};

/**
 * Log request body for debugging (use with caution)
 */
export const bodyLogger = (req: Request, res: Response, next: NextFunction) => {
  if (req.body && Object.keys(req.body).length > 0) {
    // Sanitize sensitive fields
    const sanitizedBody = { ...req.body };
    const sensitiveFields = ['password', 'token', 'apiKey', 'secret', 'cardNumber', 'cvv'];
    
    sensitiveFields.forEach(field => {
      if (sanitizedBody[field]) {
        sanitizedBody[field] = '[REDACTED]';
      }
    });
    
    logger.debug('Request body', {
      requestId: req.id,
      body: sanitizedBody,
    });
  }
  
  next();
};

/**
 * Performance monitoring middleware
 */
export const performanceMonitor = (req: Request, res: Response, next: NextFunction) => {
  const route = req.route?.path || req.path;
  const method = req.method;
  
  // Track database query time
  let dbQueryTime = 0;
  req.on('dbQuery', (duration: number) => {
    dbQueryTime += duration;
  });
  
  // Track external API calls
  let apiCallTime = 0;
  req.on('apiCall', (duration: number) => {
    apiCallTime += duration;
  });
  
  res.on('finish', () => {
    const totalTime = req.startTime ? Date.now() - req.startTime : 0;
    
    // Log performance metrics
    if (totalTime > 100) {
      logger.debug('Performance metrics', {
        requestId: req.id,
        route,
        method,
        totalTime: `${totalTime}ms`,
        dbQueryTime: `${dbQueryTime}ms`,
        apiCallTime: `${apiCallTime}ms`,
        processingTime: `${totalTime - dbQueryTime - apiCallTime}ms`,
      });
    }
  });
  
  next();
};