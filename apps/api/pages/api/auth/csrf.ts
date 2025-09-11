/**
 * CSRF Token Endpoint
 * 
 * GET /api/auth/csrf
 * 
 * Returns a CSRF token for the client to use in subsequent requests
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { getCsrfToken } from '@/middleware/csrf';
import { securityHeaders } from '@/middleware/security';
import { asyncHandler } from '@/middleware/error';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Apply security headers
  await new Promise<void>((resolve) => securityHeaders(req, res, resolve));

  // Generate and return CSRF token
  getCsrfToken(req, res);
}

export default asyncHandler(handler);