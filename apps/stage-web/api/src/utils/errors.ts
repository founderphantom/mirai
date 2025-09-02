/**
 * Custom error classes for the application
 */

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;
  public readonly details?: any;

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = 'INTERNAL_ERROR',
    isOperational: boolean = true,
    details?: any
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    this.details = details;

    Object.setPrototypeOf(this, AppError.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 400, 'VALIDATION_ERROR', true, details);
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication failed') {
    super(message, 401, 'AUTH_ERROR', true);
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Insufficient permissions') {
    super(message, 403, 'AUTHORIZATION_ERROR', true);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} not found`, 404, 'NOT_FOUND', true);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, 'CONFLICT', true);
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = 'Rate limit exceeded', resetAt?: Date) {
    super(message, 429, 'RATE_LIMIT_EXCEEDED', true, { resetAt });
  }
}

export class ExternalServiceError extends AppError {
  constructor(service: string, originalError?: any) {
    super(
      `External service error: ${service}`,
      503,
      'EXTERNAL_SERVICE_ERROR',
      true,
      { service, originalError: originalError?.message }
    );
  }
}

export class DatabaseError extends AppError {
  constructor(operation: string, originalError?: any) {
    super(
      `Database operation failed: ${operation}`,
      500,
      'DATABASE_ERROR',
      false,
      { operation, originalError: originalError?.message }
    );
  }
}

export class PaymentError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 402, 'PAYMENT_ERROR', true, details);
  }
}

export class AIProviderError extends AppError {
  constructor(provider: string, message: string, details?: any) {
    super(
      `AI Provider Error (${provider}): ${message}`,
      503,
      'AI_PROVIDER_ERROR',
      true,
      { provider, ...details }
    );
  }
}

export class WebSocketError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 400, 'WEBSOCKET_ERROR', true, details);
  }
}

/**
 * Error response formatter
 */
export const formatErrorResponse = (error: AppError | Error) => {
  if (error instanceof AppError) {
    return {
      error: {
        message: error.message,
        code: error.code,
        statusCode: error.statusCode,
        details: error.details,
      },
      timestamp: new Date().toISOString(),
    };
  }

  // Generic error
  return {
    error: {
      message: 'An unexpected error occurred',
      code: 'INTERNAL_ERROR',
      statusCode: 500,
    },
    timestamp: new Date().toISOString(),
  };
};

/**
 * Check if error is operational (expected) or programming error
 */
export const isOperationalError = (error: Error): boolean => {
  if (error instanceof AppError) {
    return error.isOperational;
  }
  return false;
};

/**
 * Handle Supabase errors and convert to AppError
 */
export const handleSupabaseError = (error: any): AppError => {
  // Common Supabase error codes
  const errorMap: Record<string, () => AppError> = {
    '23505': () => new ConflictError('Resource already exists'),
    '23503': () => new ValidationError('Referenced resource does not exist'),
    '23502': () => new ValidationError('Required field is missing'),
    '22P02': () => new ValidationError('Invalid input syntax'),
    'PGRST116': () => new NotFoundError('Resource'),
    'PGRST301': () => new AuthenticationError('Invalid credentials'),
    '42501': () => new AuthorizationError('Insufficient permissions'),
  };

  const errorCode = error.code || error.error_code;
  const errorFactory = errorMap[errorCode];

  if (errorFactory) {
    return errorFactory();
  }

  // Default database error
  return new DatabaseError('Operation failed', error);
};

/**
 * Handle AI provider errors
 */
export const handleAIProviderError = (provider: string, error: any): AppError => {
  // OpenAI errors
  if (error.response?.status === 429) {
    return new RateLimitError(`${provider} rate limit exceeded`);
  }
  
  if (error.response?.status === 401) {
    return new AIProviderError(provider, 'Invalid API key');
  }
  
  if (error.response?.status === 503) {
    return new AIProviderError(provider, 'Service temporarily unavailable');
  }
  
  // Generic provider error
  return new AIProviderError(
    provider,
    error.message || 'Unknown error',
    { originalError: error.response?.data }
  );
};

/**
 * Handle Stripe errors
 */
export const handleStripeError = (error: any): AppError => {
  const stripeErrorMap: Record<string, () => AppError> = {
    'card_declined': () => new PaymentError('Card was declined'),
    'expired_card': () => new PaymentError('Card has expired'),
    'insufficient_funds': () => new PaymentError('Insufficient funds'),
    'payment_intent_authentication_failure': () => new PaymentError('Authentication failed'),
    'subscription_payment_failed': () => new PaymentError('Subscription payment failed'),
  };

  const errorFactory = stripeErrorMap[error.code];
  
  if (errorFactory) {
    return errorFactory();
  }

  return new PaymentError(
    error.message || 'Payment processing failed',
    { stripeError: error.code }
  );
};