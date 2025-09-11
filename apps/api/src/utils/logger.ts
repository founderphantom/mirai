/**
 * Logger Utility
 * 
 * Provides structured logging for the API with different log levels
 * and proper formatting for production and development environments.
 */

import winston from 'winston';
import { getConfig } from '@/lib/config';

const config = getConfig();
const isProduction = config.NODE_ENV === 'production';
const isDevelopment = config.NODE_ENV === 'development';

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  verbose: 4,
  debug: 5,
  silly: 6,
};

// Define colors for each level
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  verbose: 'cyan',
  debug: 'blue',
  silly: 'gray',
};

// Tell winston about our colors
winston.addColors(colors);

// Define format for development
const devFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    ({ timestamp, level, message, ...metadata }) => {
      let msg = `${timestamp} [${level}]: ${message}`;
      if (Object.keys(metadata).length > 0) {
        msg += ` ${JSON.stringify(metadata, null, 2)}`;
      }
      return msg;
    }
  )
);

// Define format for production
const prodFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Create the logger instance
const logger = winston.createLogger({
  level: isProduction ? 'info' : 'debug',
  levels,
  format: isProduction ? prodFormat : devFormat,
  transports: [
    // Console transport
    new winston.transports.Console({
      stderrLevels: ['error'],
    }),
  ],
});

// Add file transport in production
if (isProduction) {
  // Error logs
  logger.add(
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    })
  );

  // Combined logs
  logger.add(
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    })
  );
}

// Create a stream object for Morgan HTTP logger
export const stream = {
  write: (message: string) => {
    logger.http(message.trim());
  },
};

/**
 * Log security events with additional context
 */
export function logSecurityEvent(
  eventType: string,
  details: Record<string, any>,
  level: 'info' | 'warn' | 'error' = 'info'
) {
  const securityLog = {
    type: 'SECURITY_EVENT',
    event: eventType,
    timestamp: new Date().toISOString(),
    ...details,
  };

  logger[level]('Security Event', securityLog);

  // In production, you might want to send critical security events to a monitoring service
  if (isProduction && level === 'error') {
    // TODO: Send to monitoring service (e.g., Sentry, DataDog, etc.)
  }
}

/**
 * Log API requests with relevant details
 */
export function logApiRequest(
  req: any,
  res: any,
  responseTime: number,
  error?: Error
) {
  const logData = {
    method: req.method,
    url: req.url,
    status: res.statusCode,
    responseTime: `${responseTime}ms`,
    ip: req.headers['x-forwarded-for'] || req.socket?.remoteAddress,
    userAgent: req.headers['user-agent'],
    userId: req.user?.id,
  };

  if (error) {
    logger.error('API Request Error', { ...logData, error: error.message, stack: error.stack });
  } else if (res.statusCode >= 400) {
    logger.warn('API Request Failed', logData);
  } else {
    logger.http('API Request', logData);
  }
}

/**
 * Log database queries (for debugging)
 */
export function logDatabaseQuery(
  operation: string,
  table: string,
  duration: number,
  error?: Error
) {
  if (!isDevelopment && !error) return; // Only log in development unless there's an error

  const logData = {
    operation,
    table,
    duration: `${duration}ms`,
  };

  if (error) {
    logger.error('Database Query Error', { ...logData, error: error.message });
  } else {
    logger.debug('Database Query', logData);
  }
}

/**
 * Log rate limit events
 */
export function logRateLimit(
  userId: string | undefined,
  ip: string,
  endpoint: string,
  limit: number
) {
  logger.warn('Rate Limit Exceeded', {
    type: 'RATE_LIMIT',
    userId,
    ip,
    endpoint,
    limit,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Log authentication events
 */
export function logAuthEvent(
  eventType: 'login' | 'logout' | 'signup' | 'token_refresh' | 'failed_login',
  userId?: string,
  details?: Record<string, any>
) {
  const level = eventType === 'failed_login' ? 'warn' : 'info';
  
  logger[level]('Authentication Event', {
    type: 'AUTH_EVENT',
    event: eventType,
    userId,
    timestamp: new Date().toISOString(),
    ...details,
  });
}

// Export the logger instance
export { logger };

// Default export for convenience
export default logger;