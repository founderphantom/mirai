/**
 * Sanitization Utilities
 * 
 * Provides comprehensive input sanitization to prevent XSS attacks
 * and other injection vulnerabilities.
 */

import DOMPurify from 'isomorphic-dompurify';
import { logger } from '@/utils/logger';

/**
 * DOMPurify configuration for different contexts
 */
const PURIFY_CONFIGS = {
  // Strict: Remove all HTML tags and dangerous content
  strict: {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true,
    RETURN_DOM: false,
    RETURN_DOM_FRAGMENT: false,
  },
  
  // Basic: Allow basic formatting tags only
  basic: {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'u', 'br', 'p'],
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true,
  },
  
  // Markdown: Allow tags commonly used in markdown rendering
  markdown: {
    ALLOWED_TAGS: [
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'p', 'br', 'hr',
      'strong', 'em', 'b', 'i', 'u', 's',
      'ul', 'ol', 'li',
      'blockquote', 'code', 'pre',
      'a', 'img',
      'table', 'thead', 'tbody', 'tr', 'th', 'td',
    ],
    ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class'],
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
  },
};

/**
 * Sanitize HTML content to prevent XSS attacks
 * 
 * @param input - The string to sanitize
 * @param mode - The sanitization mode ('strict', 'basic', or 'markdown')
 * @returns Sanitized string
 */
export function sanitizeHtml(
  input: string | null | undefined,
  mode: 'strict' | 'basic' | 'markdown' = 'strict'
): string | null {
  if (input === null || input === undefined) return null;
  if (input === '') return '';
  
  try {
    const config = PURIFY_CONFIGS[mode];
    const cleaned = DOMPurify.sanitize(input, config);
    
    // Log if content was modified (potential attack)
    if (cleaned !== input && cleaned.length < input.length) {
      logger.warn('Potentially malicious content sanitized', {
        originalLength: input.length,
        cleanedLength: cleaned.length,
        mode,
        sample: input.substring(0, 100),
      });
    }
    
    return cleaned.trim();
  } catch (error) {
    logger.error('HTML sanitization error', { error, inputLength: input?.length });
    // On error, return empty string for safety
    return '';
  }
}

/**
 * Sanitize plain text input (removes all HTML/script content)
 * 
 * @param input - The string to sanitize
 * @returns Sanitized string with no HTML
 */
export function sanitizeText(input: string | null | undefined): string | null {
  if (input === null || input === undefined) return null;
  if (input === '') return '';
  
  // Use strict mode to remove all HTML
  return sanitizeHtml(input, 'strict');
}

/**
 * Sanitize user-generated content that may contain markdown
 * 
 * @param input - The markdown string to sanitize
 * @returns Sanitized markdown-compatible HTML
 */
export function sanitizeMarkdown(input: string | null | undefined): string | null {
  if (!input) return null;
  
  return sanitizeHtml(input, 'markdown');
}

/**
 * Sanitize and validate email addresses
 * 
 * @param email - The email to sanitize
 * @returns Sanitized email or null if invalid
 */
export function sanitizeEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  
  // Remove any HTML/script content first
  const cleaned = sanitizeText(email);
  if (!cleaned) return null;
  
  // Basic email validation regex
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  
  // Convert to lowercase and trim
  const normalized = cleaned.toLowerCase().trim();
  
  // Validate email format
  if (!emailRegex.test(normalized)) {
    logger.warn('Invalid email format after sanitization', { 
      original: email.substring(0, 50),
    });
    return null;
  }
  
  return normalized;
}

/**
 * Sanitize URL to prevent javascript: and data: URLs
 * 
 * @param url - The URL to sanitize
 * @returns Sanitized URL or null if dangerous
 */
export function sanitizeUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  
  // Remove any HTML/script content first
  const cleaned = sanitizeText(url);
  if (!cleaned) return null;
  
  // Block dangerous protocols
  const dangerousProtocols = ['javascript:', 'data:', 'vbscript:', 'file:'];
  const lowerUrl = cleaned.toLowerCase().trim();
  
  for (const protocol of dangerousProtocols) {
    if (lowerUrl.startsWith(protocol)) {
      logger.warn('Dangerous URL protocol blocked', { 
        protocol,
        url: url.substring(0, 50),
      });
      return null;
    }
  }
  
  // Additional check for encoded dangerous protocols
  try {
    const decoded = decodeURIComponent(cleaned);
    const lowerDecoded = decoded.toLowerCase();
    
    for (const protocol of dangerousProtocols) {
      if (lowerDecoded.includes(protocol)) {
        logger.warn('Encoded dangerous URL protocol blocked', { 
          protocol,
          url: url.substring(0, 50),
        });
        return null;
      }
    }
  } catch {
    // If decoding fails, the URL might be malformed
    return null;
  }
  
  return cleaned;
}

/**
 * Sanitize JSON data recursively
 * 
 * @param data - The JSON data to sanitize
 * @param mode - The sanitization mode for string values
 * @returns Sanitized JSON data
 */
export function sanitizeJson(
  data: any,
  mode: 'strict' | 'basic' | 'markdown' = 'strict'
): any {
  if (data === null || data === undefined) {
    return data;
  }
  
  if (typeof data === 'string') {
    return sanitizeHtml(data, mode);
  }
  
  if (Array.isArray(data)) {
    return data.map(item => sanitizeJson(item, mode));
  }
  
  if (typeof data === 'object') {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(data)) {
      // Sanitize the key as well (in case of dynamic keys)
      // Note: If key contains only script tags, it will be empty after sanitization
      // In that case, we skip the property for security
      const cleanKey = sanitizeText(key);
      if (cleanKey) {
        sanitized[cleanKey] = sanitizeJson(value, mode);
      }
      // If cleanKey is empty/null, we skip this property entirely for security
    }
    return sanitized;
  }
  
  // For numbers, booleans, etc., return as-is
  return data;
}

/**
 * Sanitize SQL identifiers (table names, column names)
 * Note: This is a basic implementation. Use parameterized queries instead when possible.
 * 
 * @param identifier - The SQL identifier to sanitize
 * @returns Sanitized identifier or null if invalid
 */
export function sanitizeSqlIdentifier(identifier: string | null | undefined): string | null {
  if (!identifier) return null;
  
  // Only allow alphanumeric characters and underscores
  const cleaned = identifier.replace(/[^a-zA-Z0-9_]/g, '');
  
  // Must start with a letter or underscore
  if (!/^[a-zA-Z_]/.test(cleaned)) {
    logger.warn('Invalid SQL identifier', { identifier });
    return null;
  }
  
  // Limit length to prevent DoS
  if (cleaned.length > 64) {
    logger.warn('SQL identifier too long', { identifier, length: cleaned.length });
    return null;
  }
  
  return cleaned;
}

/**
 * Sanitize file names to prevent directory traversal attacks
 * 
 * @param filename - The filename to sanitize
 * @returns Sanitized filename or null if invalid
 */
export function sanitizeFilename(filename: string | null | undefined): string | null {
  if (!filename) return null;
  
  // Remove any path components
  const basename = filename.split(/[/\\]/).pop() || '';
  
  // Remove dangerous characters
  let cleaned = basename
    .replace(/[^a-zA-Z0-9._-]/g, '_')  // Replace special chars with underscore
    .replace(/\.{2,}/g, '_')            // Replace multiple dots
    .replace(/^\.+/, '_')               // Replace leading dots with underscore
    .trim();
  
  // Special case: if the original was exactly '..' return null
  if (basename === '..' || basename === '.') {
    logger.warn('Invalid filename after sanitization', { original: filename });
    return null;
  }
  
  // Ensure the filename is not empty after cleaning
  if (!cleaned) {
    logger.warn('Invalid filename after sanitization', { original: filename });
    return null;
  }
  
  // Limit length
  if (cleaned.length > 255) {
    // Preserve extension if possible
    const ext = cleaned.split('.').pop();
    const name = cleaned.substring(0, 250 - (ext ? ext.length + 1 : 0));
    cleaned = ext ? `${name}.${ext}` : name;
  }
  
  return cleaned;
}

/**
 * Sanitize a number value, ensuring it's within safe bounds
 * 
 * @param value - The value to sanitize
 * @param min - Minimum allowed value
 * @param max - Maximum allowed value
 * @param defaultValue - Default value if invalid
 * @returns Sanitized number
 */
export function sanitizeNumber(
  value: any,
  min: number = Number.MIN_SAFE_INTEGER,
  max: number = Number.MAX_SAFE_INTEGER,
  defaultValue: number = 0
): number {
  const num = Number(value);
  
  if (isNaN(num) || !isFinite(num)) {
    return defaultValue;
  }
  
  if (num < min) return min;
  if (num > max) return max;
  
  return num;
}

/**
 * Batch sanitize an object's string properties
 * 
 * @param obj - The object to sanitize
 * @param fields - Array of field names to sanitize
 * @param mode - The sanitization mode
 * @returns Object with sanitized fields
 */
export function sanitizeFields<T extends Record<string, any>>(
  obj: T,
  fields: (keyof T)[],
  mode: 'strict' | 'basic' | 'markdown' = 'strict'
): T {
  const sanitized = { ...obj };
  
  for (const field of fields) {
    if (typeof sanitized[field] === 'string') {
      sanitized[field] = sanitizeHtml(sanitized[field] as string, mode) as T[keyof T];
    }
  }
  
  return sanitized;
}

// Export all functions as default as well
export default {
  sanitizeHtml,
  sanitizeText,
  sanitizeMarkdown,
  sanitizeEmail,
  sanitizeUrl,
  sanitizeJson,
  sanitizeSqlIdentifier,
  sanitizeFilename,
  sanitizeNumber,
  sanitizeFields,
};