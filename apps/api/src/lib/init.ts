/**
 * Application Initialization Module
 * This module should be imported at the top of API routes to ensure
 * environment variables are validated before any other code runs.
 */

import { getConfig } from './config';

// Validate environment variables on module load
const config = getConfig();

// Export the validated config for use in other modules
export { config };

// Initialize any other required services here
export function initialize() {
  console.log('🚀 Application initialized successfully');
  return config;
}

// Auto-initialize on module load
if (process.env.NODE_ENV !== 'test') {
  initialize();
}