import winston from 'winston';
import path from 'path';
import { config } from '../config/index.js';

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : '';
    return `${timestamp} [${level.toUpperCase()}]: ${message} ${metaStr}`;
  })
);

// Create the logger instance
export const logger = winston.createLogger({
  level: config.logging.level,
  format: logFormat,
  defaultMeta: { service: 'api-server' },
  transports: [
    // Console transport
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
  ],
});

// Add file transport in production
if (config.server.env === 'production') {
  const logDir = path.dirname(config.logging.filePath);
  
  logger.add(
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    })
  );
  
  logger.add(
    new winston.transports.File({
      filename: config.logging.filePath,
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    })
  );
}

// Create a stream object for Morgan
export const stream = {
  write: (message: string) => {
    logger.info(message.trim());
  },
};

// Helper functions for structured logging
export const logRequest = (req: any, additionalInfo?: any) => {
  logger.info('API Request', {
    method: req.method,
    url: req.url,
    ip: req.ip,
    userId: req.user?.id,
    ...additionalInfo,
  });
};

export const logResponse = (req: any, res: any, responseTime: number) => {
  logger.info('API Response', {
    method: req.method,
    url: req.url,
    statusCode: res.statusCode,
    responseTime: `${responseTime}ms`,
    userId: req.user?.id,
  });
};

export const logError = (error: Error, req?: any, additionalInfo?: any) => {
  logger.error('API Error', {
    message: error.message,
    stack: error.stack,
    method: req?.method,
    url: req?.url,
    userId: req?.user?.id,
    ...additionalInfo,
  });
};

export const logDatabaseQuery = (query: string, params?: any[], duration?: number) => {
  logger.debug('Database Query', {
    query,
    params,
    duration: duration ? `${duration}ms` : undefined,
  });
};

export const logAIRequest = (provider: string, model: string, tokens: number, duration: number) => {
  logger.info('AI Provider Request', {
    provider,
    model,
    tokens,
    duration: `${duration}ms`,
  });
};

export const logPayment = (userId: string, amount: number, status: string, metadata?: any) => {
  logger.info('Payment Event', {
    userId,
    amount,
    status,
    ...metadata,
  });
};

export const logSecurityEvent = (event: string, userId?: string, details?: any) => {
  logger.warn('Security Event', {
    event,
    userId,
    ...details,
  });
};