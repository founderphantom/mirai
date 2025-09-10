/**
 * API Key Management
 * Secure API key generation and validation for service-to-service authentication
 */

import crypto from 'crypto';
import { supabaseAdmin } from './supabase';
import { getConfig } from './config';

// API key prefix for identification
const API_KEY_PREFIX = 'mri_';
const API_KEY_LENGTH = 32;

/**
 * Generate a secure API key
 */
export function generateApiKey(): string {
  const randomBytes = crypto.randomBytes(API_KEY_LENGTH);
  const key = randomBytes.toString('base64url');
  return `${API_KEY_PREFIX}${key}`;
}

/**
 * Hash an API key for storage
 */
export function hashApiKey(apiKey: string): string {
  return crypto
    .createHash('sha256')
    .update(apiKey)
    .digest('hex');
}

/**
 * Validate API key format
 */
export function isValidApiKeyFormat(apiKey: string): boolean {
  if (!apiKey || typeof apiKey !== 'string') {
    return false;
  }
  
  // Check prefix and minimum length
  if (!apiKey.startsWith(API_KEY_PREFIX)) {
    return false;
  }
  
  const keyPart = apiKey.slice(API_KEY_PREFIX.length);
  if (keyPart.length < 32) {
    return false;
  }
  
  // Check for valid base64url characters
  const base64urlRegex = /^[A-Za-z0-9_-]+$/;
  return base64urlRegex.test(keyPart);
}

/**
 * Create a new API key for a user
 */
export async function createApiKey(
  userId: string,
  name: string,
  scopes: string[] = ['read', 'write'],
  expiresInDays: number = 365
) {
  // Generate new API key
  const apiKey = generateApiKey();
  const hashedKey = hashApiKey(apiKey);
  
  // Calculate expiration
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expiresInDays);
  
  // Store in database (you'll need to create an api_keys table)
  const { data, error } = await supabaseAdmin
    .from('api_keys')
    .insert({
      user_id: userId,
      name,
      key_hash: hashedKey,
      key_prefix: apiKey.slice(0, 10), // Store prefix for identification
      scopes,
      expires_at: expiresAt.toISOString(),
      last_used_at: null,
      created_at: new Date().toISOString(),
    })
    .select()
    .single();
  
  if (error) {
    throw new Error(`Failed to create API key: ${error.message}`);
  }
  
  // Return the key only once (won't be retrievable later)
  return {
    id: data.id,
    key: apiKey, // Only returned on creation
    name: data.name,
    scopes: data.scopes,
    expires_at: data.expires_at,
    created_at: data.created_at,
  };
}

/**
 * Validate an API key and return associated user/scopes
 */
export async function validateApiKey(apiKey: string) {
  // Validate format
  if (!isValidApiKeyFormat(apiKey)) {
    return { valid: false, error: 'Invalid API key format' };
  }
  
  // Hash the key for lookup
  const hashedKey = hashApiKey(apiKey);
  const keyPrefix = apiKey.slice(0, 10);
  
  // Look up the key
  const { data, error } = await supabaseAdmin
    .from('api_keys')
    .select('*, user_profiles(*)')
    .eq('key_hash', hashedKey)
    .eq('key_prefix', keyPrefix)
    .single();
  
  if (error || !data) {
    return { valid: false, error: 'Invalid API key' };
  }
  
  // Check if key is expired
  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    return { valid: false, error: 'API key expired' };
  }
  
  // Check if key is revoked
  if (data.revoked_at) {
    return { valid: false, error: 'API key revoked' };
  }
  
  // Update last used timestamp
  await supabaseAdmin
    .from('api_keys')
    .update({ 
      last_used_at: new Date().toISOString(),
      usage_count: (data.usage_count || 0) + 1,
    })
    .eq('id', data.id);
  
  return {
    valid: true,
    userId: data.user_id,
    keyId: data.id,
    scopes: data.scopes,
    user: data.user_profiles,
  };
}

/**
 * Revoke an API key
 */
export async function revokeApiKey(keyId: string, userId: string) {
  const { error } = await supabaseAdmin
    .from('api_keys')
    .update({ 
      revoked_at: new Date().toISOString(),
    })
    .eq('id', keyId)
    .eq('user_id', userId);
  
  if (error) {
    throw new Error(`Failed to revoke API key: ${error.message}`);
  }
  
  return { success: true };
}

/**
 * List API keys for a user (without the actual keys)
 */
export async function listApiKeys(userId: string) {
  const { data, error } = await supabaseAdmin
    .from('api_keys')
    .select('id, name, key_prefix, scopes, expires_at, last_used_at, created_at, revoked_at')
    .eq('user_id', userId)
    .is('revoked_at', null)
    .order('created_at', { ascending: false });
  
  if (error) {
    throw new Error(`Failed to list API keys: ${error.message}`);
  }
  
  return data;
}

/**
 * Rotate an API key (revoke old, create new)
 */
export async function rotateApiKey(
  keyId: string,
  userId: string
) {
  // Get existing key details
  const { data: existingKey, error: fetchError } = await supabaseAdmin
    .from('api_keys')
    .select('name, scopes')
    .eq('id', keyId)
    .eq('user_id', userId)
    .single();
  
  if (fetchError || !existingKey) {
    throw new Error('API key not found');
  }
  
  // Revoke old key
  await revokeApiKey(keyId, userId);
  
  // Create new key with same settings
  const newKey = await createApiKey(
    userId,
    `${existingKey.name} (rotated)`,
    existingKey.scopes || ['read', 'write']
  );
  
  return newKey;
}

/**
 * Check if a scope is allowed for an API key
 */
export function hasScope(allowedScopes: string[], requiredScope: string): boolean {
  // Check for wildcard scope
  if (allowedScopes.includes('*')) {
    return true;
  }
  
  // Check for exact match
  if (allowedScopes.includes(requiredScope)) {
    return true;
  }
  
  // Check for hierarchical scopes (e.g., 'conversations:*' allows 'conversations:read')
  const scopeParts = requiredScope.split(':');
  for (let i = scopeParts.length; i > 0; i--) {
    const partialScope = scopeParts.slice(0, i).join(':') + ':*';
    if (allowedScopes.includes(partialScope)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Middleware to validate API key in request
 */
export async function requireApiKey(
  req: any,
  requiredScopes: string[] = []
) {
  // Get API key from header
  const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
  
  if (!apiKey) {
    throw new Error('API key required');
  }
  
  // Validate the key
  const validation = await validateApiKey(apiKey);
  
  if (!validation.valid) {
    throw new Error(validation.error || 'Invalid API key');
  }
  
  // Check required scopes
  for (const scope of requiredScopes) {
    if (!hasScope(validation.scopes || [], scope)) {
      throw new Error(`Missing required scope: ${scope}`);
    }
  }
  
  // Attach user info to request
  req.apiKey = {
    id: validation.keyId,
    userId: validation.userId,
    scopes: validation.scopes,
    user: validation.user,
  };
  
  return validation;
}

export default {
  generateApiKey,
  hashApiKey,
  isValidApiKeyFormat,
  createApiKey,
  validateApiKey,
  revokeApiKey,
  listApiKeys,
  rotateApiKey,
  hasScope,
  requireApiKey,
};