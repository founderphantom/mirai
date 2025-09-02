import { AxiosError } from 'axios';
import { toast } from 'vue-sonner';

export interface ApiError {
  message: string;
  code?: string;
  status?: number;
  details?: any;
}

export class ApiErrorHandler {
  /**
   * Handle API errors with appropriate user feedback
   */
  static handle(error: any, customMessage?: string): ApiError {
    console.error('API Error:', error);
    
    if (error instanceof AxiosError) {
      return this.handleAxiosError(error, customMessage);
    }
    
    if (error instanceof Error) {
      return this.handleGenericError(error, customMessage);
    }
    
    return {
      message: customMessage || 'An unexpected error occurred',
      code: 'UNKNOWN_ERROR',
    };
  }
  
  /**
   * Handle Axios errors
   */
  private static handleAxiosError(error: AxiosError, customMessage?: string): ApiError {
    const response = error.response;
    const data = response?.data as any;
    
    const apiError: ApiError = {
      message: customMessage || data?.message || this.getDefaultMessage(response?.status),
      code: data?.code || this.getErrorCode(response?.status),
      status: response?.status,
      details: data?.details,
    };
    
    // Handle specific error codes
    switch (apiError.code) {
      case 'SUBSCRIPTION_REQUIRED':
        apiError.message = 'This feature requires a subscription upgrade';
        break;
      case 'MESSAGE_LIMIT_EXCEEDED':
        apiError.message = 'You have reached your daily message limit';
        break;
      case 'INVALID_API_KEY':
        apiError.message = 'Invalid API key. Please check your provider settings';
        break;
      case 'RATE_LIMIT_EXCEEDED':
        apiError.message = 'Too many requests. Please wait a moment and try again';
        break;
    }
    
    return apiError;
  }
  
  /**
   * Handle generic errors
   */
  private static handleGenericError(error: Error, customMessage?: string): ApiError {
    return {
      message: customMessage || error.message || 'An error occurred',
      code: 'ERROR',
    };
  }
  
  /**
   * Get default message for HTTP status code
   */
  private static getDefaultMessage(status?: number): string {
    switch (status) {
      case 400:
        return 'Invalid request. Please check your input';
      case 401:
        return 'Authentication required. Please log in';
      case 403:
        return 'You do not have permission to perform this action';
      case 404:
        return 'The requested resource was not found';
      case 409:
        return 'A conflict occurred. Please refresh and try again';
      case 422:
        return 'Invalid data provided';
      case 429:
        return 'Too many requests. Please slow down';
      case 500:
        return 'Server error. Please try again later';
      case 502:
        return 'Service temporarily unavailable';
      case 503:
        return 'Service is under maintenance. Please try again later';
      default:
        return 'An error occurred. Please try again';
    }
  }
  
  /**
   * Get error code from HTTP status
   */
  private static getErrorCode(status?: number): string {
    switch (status) {
      case 400:
        return 'BAD_REQUEST';
      case 401:
        return 'UNAUTHORIZED';
      case 403:
        return 'FORBIDDEN';
      case 404:
        return 'NOT_FOUND';
      case 409:
        return 'CONFLICT';
      case 422:
        return 'VALIDATION_ERROR';
      case 429:
        return 'RATE_LIMIT';
      case 500:
        return 'SERVER_ERROR';
      case 502:
        return 'BAD_GATEWAY';
      case 503:
        return 'SERVICE_UNAVAILABLE';
      default:
        return 'UNKNOWN_ERROR';
    }
  }
  
  /**
   * Show error toast
   */
  static showError(error: any, customMessage?: string): void {
    const apiError = this.handle(error, customMessage);
    toast.error(apiError.message);
  }
  
  /**
   * Check if error is network related
   */
  static isNetworkError(error: any): boolean {
    return error instanceof AxiosError && !error.response && !!error.request;
  }
  
  /**
   * Check if error is authentication related
   */
  static isAuthError(error: any): boolean {
    return error instanceof AxiosError && error.response?.status === 401;
  }
  
  /**
   * Check if error is rate limit
   */
  static isRateLimitError(error: any): boolean {
    return error instanceof AxiosError && error.response?.status === 429;
  }
  
  /**
   * Check if error is subscription required
   */
  static isSubscriptionError(error: any): boolean {
    if (error instanceof AxiosError) {
      const code = (error.response?.data as any)?.code;
      return code === 'SUBSCRIPTION_REQUIRED' || error.response?.status === 402;
    }
    return false;
  }
}

// Export convenience functions
export const handleApiError = ApiErrorHandler.handle.bind(ApiErrorHandler);
export const showApiError = ApiErrorHandler.showError.bind(ApiErrorHandler);
export const isNetworkError = ApiErrorHandler.isNetworkError.bind(ApiErrorHandler);
export const isAuthError = ApiErrorHandler.isAuthError.bind(ApiErrorHandler);
export const isRateLimitError = ApiErrorHandler.isRateLimitError.bind(ApiErrorHandler);
export const isSubscriptionError = ApiErrorHandler.isSubscriptionError.bind(ApiErrorHandler);