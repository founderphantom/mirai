import { Request, Response, NextFunction } from 'express';
import { validationResult, ValidationError as ExpressValidationError } from 'express-validator';
import { ValidationError } from '../utils/errors.js';

/**
 * Validate request using express-validator
 */
export const validateRequest = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const extractedErrors: Record<string, string[]> = {};
    
    errors.array().forEach((err: ExpressValidationError) => {
      const field = err.type === 'field' ? err.path : 'general';
      
      if (!extractedErrors[field]) {
        extractedErrors[field] = [];
      }
      
      extractedErrors[field].push(err.msg);
    });
    
    throw new ValidationError('Validation failed', extractedErrors);
  }
  
  next();
};

/**
 * Custom validators
 */
export const customValidators = {
  /**
   * Validate email format
   */
  isValidEmail: (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  },
  
  /**
   * Validate password strength
   */
  isStrongPassword: (password: string): boolean => {
    // At least 8 characters, one uppercase, one lowercase, one number
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
    return passwordRegex.test(password);
  },
  
  /**
   * Validate UUID format
   */
  isValidUUID: (uuid: string): boolean => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  },
  
  /**
   * Validate URL format
   */
  isValidURL: (url: string): boolean => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  },
  
  /**
   * Validate JSON string
   */
  isValidJSON: (jsonString: string): boolean => {
    try {
      JSON.parse(jsonString);
      return true;
    } catch {
      return false;
    }
  },
  
  /**
   * Validate date format
   */
  isValidDate: (date: string): boolean => {
    const parsed = new Date(date);
    return !isNaN(parsed.getTime());
  },
  
  /**
   * Validate phone number (basic)
   */
  isValidPhone: (phone: string): boolean => {
    const phoneRegex = /^\+?[\d\s-()]+$/;
    return phoneRegex.test(phone) && phone.replace(/\D/g, '').length >= 10;
  },
  
  /**
   * Validate hex color
   */
  isValidHexColor: (color: string): boolean => {
    const hexColorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
    return hexColorRegex.test(color);
  },
  
  /**
   * Validate file extension
   */
  isValidFileExtension: (filename: string, allowedExtensions: string[]): boolean => {
    const ext = filename.split('.').pop()?.toLowerCase();
    return ext ? allowedExtensions.includes(ext) : false;
  },
  
  /**
   * Validate file size (in bytes)
   */
  isValidFileSize: (sizeInBytes: number, maxSizeInBytes: number): boolean => {
    return sizeInBytes > 0 && sizeInBytes <= maxSizeInBytes;
  },
};

/**
 * Sanitization helpers
 */
export const sanitizers = {
  /**
   * Sanitize HTML to prevent XSS
   */
  sanitizeHTML: (html: string): string => {
    // Basic HTML sanitization - in production, use a library like DOMPurify
    return html
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/&/g, '&amp;');
  },
  
  /**
   * Sanitize filename
   */
  sanitizeFilename: (filename: string): string => {
    return filename
      .replace(/[^a-zA-Z0-9.-]/g, '_')
      .replace(/\.{2,}/g, '.')
      .substring(0, 255);
  },
  
  /**
   * Trim and normalize whitespace
   */
  normalizeWhitespace: (str: string): string => {
    return str.trim().replace(/\s+/g, ' ');
  },
  
  /**
   * Remove null bytes
   */
  removeNullBytes: (str: string): string => {
    return str.replace(/\0/g, '');
  },
  
  /**
   * Sanitize SQL identifier (table/column names)
   */
  sanitizeSQLIdentifier: (identifier: string): string => {
    return identifier.replace(/[^a-zA-Z0-9_]/g, '');
  },
};