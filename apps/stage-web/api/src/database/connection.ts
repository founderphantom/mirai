import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { Database } from '../types/database.types.js';

// Supabase clients
let supabaseAdmin: SupabaseClient<Database>;
let supabaseAnon: SupabaseClient<Database>;

/**
 * Initialize Supabase connections
 */
export const connectDatabase = async (): Promise<void> => {
  try {
    // Admin client with service key (for backend operations)
    supabaseAdmin = createClient<Database>(
      config.supabase.url,
      config.supabase.serviceKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
        db: {
          schema: 'public',
        },
      }
    );

    // Anon client (for client-facing operations with RLS)
    supabaseAnon = createClient<Database>(
      config.supabase.url,
      config.supabase.anonKey,
      {
        auth: {
          autoRefreshToken: true,
          persistSession: false,
        },
        db: {
          schema: 'public',
        },
      }
    );

    // Test connection
    const { error } = await supabaseAdmin.from('system_settings').select('key').limit(1).single();
    
    if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned"
      throw error;
    }

    logger.info('Supabase connection established successfully');
  } catch (error) {
    logger.error('Failed to connect to Supabase:', error);
    throw error;
  }
};

/**
 * Get Supabase admin client
 */
export const getAdminClient = (): SupabaseClient<Database> => {
  if (!supabaseAdmin) {
    throw new Error('Supabase admin client not initialized. Call connectDatabase() first.');
  }
  return supabaseAdmin;
};

/**
 * Get Supabase anon client
 */
export const getAnonClient = (): SupabaseClient<Database> => {
  if (!supabaseAnon) {
    throw new Error('Supabase anon client not initialized. Call connectDatabase() first.');
  }
  return supabaseAnon;
};

/**
 * Get Supabase client for a specific user (with their JWT)
 */
export const getUserClient = (accessToken: string): SupabaseClient<Database> => {
  return createClient<Database>(
    config.supabase.url,
    config.supabase.anonKey,
    {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      db: {
        schema: 'public',
      },
    }
  );
};

/**
 * Close database connections (for graceful shutdown)
 */
export const closeDatabase = async (): Promise<void> => {
  // Supabase clients don't have explicit close methods
  // but we can clean up references
  supabaseAdmin = null as any;
  supabaseAnon = null as any;
  logger.info('Database connections closed');
};

/**
 * Execute a database transaction
 */
export const withTransaction = async <T>(
  callback: (client: SupabaseClient<Database>) => Promise<T>
): Promise<T> => {
  const client = getAdminClient();
  
  try {
    // Note: Supabase doesn't support traditional transactions via the REST API
    // For complex transactions, you'd need to create a stored procedure
    // This is a simplified wrapper for consistency
    const result = await callback(client);
    return result;
  } catch (error) {
    logger.error('Transaction failed:', error);
    throw error;
  }
};

/**
 * Health check for database connection
 */
export const checkDatabaseHealth = async (): Promise<boolean> => {
  try {
    const client = getAdminClient();
    const { error } = await client.from('provider_health').select('id').limit(1);
    return !error;
  } catch (error) {
    logger.error('Database health check failed:', error);
    return false;
  }
};