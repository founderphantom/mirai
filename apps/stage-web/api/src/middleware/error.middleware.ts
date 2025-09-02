import { Request, Response, NextFunction } from 'express';
import { AppError, formatErrorResponse, isOperationalError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { config } from '../config/index.js';

/**
 * Global error handler middleware
 */
export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Log the error
  if (!isOperationalError(err)) {
    // Log programming errors with full stack
    logger.error('Unexpected error:', {
      error: err.message,
      stack: err.stack,
      url: req.url,
      method: req.method,
      body: req.body,
      userId: req.user?.id,
    });
  } else {
    // Log operational errors without stack
    logger.warn('Operational error:', {
      error: err.message,
      code: (err as AppError).code,
      url: req.url,
      method: req.method,
      userId: req.user?.id,
    });
  }

  // Handle specific error types
  if (err instanceof AppError) {
    const errorResponse = formatErrorResponse(err);
    res.status(err.statusCode).json(errorResponse);
    return;
  }

  // Handle validation errors from express-validator
  if (err.name === 'ValidationError') {
    res.status(400).json({
      error: {
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        statusCode: 400,
        details: err.message,
      },
      timestamp: new Date().toISOString(),
    });
    return;
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    res.status(401).json({
      error: {
        message: 'Invalid token',
        code: 'INVALID_TOKEN',
        statusCode: 401,
      },
      timestamp: new Date().toISOString(),
    });
    return;
  }

  if (err.name === 'TokenExpiredError') {
    res.status(401).json({
      error: {
        message: 'Token expired',
        code: 'TOKEN_EXPIRED',
        statusCode: 401,
      },
      timestamp: new Date().toISOString(),
    });
    return;
  }

  // Handle body parser errors
  if (err.message?.includes('JSON')) {
    res.status(400).json({
      error: {
        message: 'Invalid JSON in request body',
        code: 'INVALID_JSON',
        statusCode: 400,
      },
      timestamp: new Date().toISOString(),
    });
    return;
  }

  // Default error response
  const isDevelopment = config.server.env === 'development';
  res.status(500).json({
    error: {
      message: isDevelopment ? err.message : 'An unexpected error occurred',
      code: 'INTERNAL_ERROR',
      statusCode: 500,
      ...(isDevelopment && { stack: err.stack }),
    },
    timestamp: new Date().toISOString(),
  });
};

/**
 * Handle 404 errors
 */
export const notFoundHandler = (req: Request, res: Response): void => {
  res.status(404).json({
    error: {
      message: `Endpoint ${req.method} ${req.path} not found`,
      code: 'ENDPOINT_NOT_FOUND',
      statusCode: 404,
    },
    timestamp: new Date().toISOString(),
  });
};

/**
 * Async error wrapper for route handlers
 */
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};