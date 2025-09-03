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
    validate(schemas.textToSpeech)(req, res, resolve)
  );

  const { text, voice, language, speed } = req.body;

  try {
    // Generate speech
    const audioBuffer = await voiceService.textToSpeech({
      text,
      voice,
      language,
      speed,
    });

    // Track usage (estimate duration based on text length)
    const estimatedDuration = Math.ceil(text.length / 15); // ~15 chars per second
    await voiceService.trackVoiceUsage(req.user!.id, 'tts', estimatedDuration);

    // Return audio file
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', audioBuffer.length.toString());
    res.status(200).send(audioBuffer);
  } catch (error: any) {
    res.status(500).json({
      error: {
        message: error.message || 'Text-to-speech failed',
      },
    });
  }
}

export default requireAuth(asyncHandler(handler));