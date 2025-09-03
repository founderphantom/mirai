import { NextApiResponse } from 'next';
import { requireAuth, AuthenticatedRequest } from '@/middleware/auth';
import { asyncHandler } from '@/middleware/error';
import { gamingService } from '@/services/gaming.service';

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  const { id: sessionId } = req.query;

  switch (req.method) {
    case 'GET':
      return getSession(req, res, sessionId as string);
    case 'DELETE':
      return endSession(req, res, sessionId as string);
    default:
      return res.status(405).json({ error: 'Method not allowed' });
  }
}

async function getSession(
  req: AuthenticatedRequest,
  res: NextApiResponse,
  sessionId: string
) {
  try {
    const session = await gamingService.getSession(sessionId, req.user!.id);

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.status(200).json({
      success: true,
      data: session,
    });
  } catch (error: any) {
    res.status(500).json({
      error: {
        message: error.message || 'Failed to fetch session',
      },
    });
  }
}

async function endSession(
  req: AuthenticatedRequest,
  res: NextApiResponse,
  sessionId: string
) {
  try {
    const success = await gamingService.endSession(sessionId, req.user!.id);

    if (!success) {
      return res.status(404).json({ error: 'Session not found or already ended' });
    }

    res.status(200).json({
      success: true,
      message: 'Session ended successfully',
    });
  } catch (error: any) {
    res.status(500).json({
      error: {
        message: error.message || 'Failed to end session',
      },
    });
  }
}

export default requireAuth(asyncHandler(handler));