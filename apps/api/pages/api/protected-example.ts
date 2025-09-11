/**
 * Protected API Endpoint Example
 * 
 * This demonstrates how to use CSRF protection on state-changing operations
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { withCsrf } from '@/middleware/csrf';
import { securityHeaders } from '@/middleware/security';
import { asyncHandler } from '@/middleware/error';
import { withAuth } from '@/middleware/auth';
import { validate, schemas } from '@/middleware/validation';
import { sanitizeJson } from '@/utils/sanitization';
import { logger } from '@/utils/logger';
import * as z from 'zod';

// Define schema for the request body
const updateDataSchema = z.object({
  data: z.string().min(1).max(1000),
  metadata: z.record(z.unknown()).optional(),
});

async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Apply security headers
    await new Promise<void>((resolve) => securityHeaders(req, res, resolve));

    // Validate and sanitize input
    const validation = updateDataSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        error: 'Invalid request data',
        details: validation.error.flatten(),
      });
    }

    // Sanitize the validated data
    const sanitizedData = await sanitizeJson(validation.data);

    // Log the secure operation
    logger.info('Protected operation executed', {
      userId: (req as any).user?.id,
      operation: 'update_data',
      ip: req.headers['x-forwarded-for'] || req.socket?.remoteAddress,
    });

    // Perform the protected operation here
    // This is where you would interact with your database or external services
    
    res.status(200).json({
      success: true,
      message: 'Data updated successfully',
      data: sanitizedData,
    });
  } catch (error: any) {
    logger.error('Protected operation failed', { error: error.message });
    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
}

// Apply middleware layers:
// 1. Error handling
// 2. Authentication (ensures user is logged in)
// 3. CSRF protection (validates CSRF token)
export default asyncHandler(
  withAuth(
    withCsrf(handler)
  )
);