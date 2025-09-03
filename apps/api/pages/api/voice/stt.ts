import { NextApiResponse } from 'next';
import { requireAuth, AuthenticatedRequest } from '@/middleware/auth';
import { validate, schemas } from '@/middleware/validation';
import { asyncHandler } from '@/middleware/error';
import { rateLimit } from '@/middleware/rateLimit';
import { voiceService } from '@/services/voice.service';

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Apply rate limiting
  await new Promise<void>((resolve) => rateLimit(req, res, resolve));

  // Validate request body
  await new Promise<void>((resolve) => 
    validate(schemas.speechToText)(req, res, resolve)
  );

  const { audio, language } = req.body;

  try {
    // Convert speech to text
    const text = await voiceService.speechToText({
      audio,
      language,
    });

    // Track usage (estimate duration - would be more accurate with actual audio duration)
    const estimatedDuration = 10; // Default 10 seconds
    await voiceService.trackVoiceUsage(req.user!.id, 'stt', estimatedDuration);

    res.status(200).json({
      success: true,
      data: {
        text,
        language,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      error: {
        message: error.message || 'Speech-to-text failed',
      },
    });
  }
}

export default requireAuth(asyncHandler(handler));