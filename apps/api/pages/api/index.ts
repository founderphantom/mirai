import { NextApiRequest, NextApiResponse } from 'next';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  res.status(200).json({
    name: 'AIRI API',
    version: '1.0.0',
    status: 'online',
    message: 'Welcome to AIRI API - Your AI Companion Platform',
    documentation: 'https://docs.airi.app',
    endpoints: {
      health: '/api/health',
      auth: {
        signup: 'POST /api/auth/signup',
        login: 'POST /api/auth/login',
        logout: 'POST /api/auth/logout',
        refresh: 'POST /api/auth/refresh',
        session: 'GET /api/auth/session',
      },
      conversations: {
        list: 'GET /api/conversations',
        create: 'POST /api/conversations',
        messages: 'GET /api/conversations/[id]/messages',
        sendMessage: 'POST /api/conversations/[id]/messages',
      },
      subscription: {
        current: 'GET /api/subscription/current',
        checkout: 'POST /api/subscription/create-checkout',
        cancel: 'POST /api/subscription/cancel',
      },
      voice: {
        tts: 'POST /api/voice/tts',
        stt: 'POST /api/voice/stt',
      },
      gaming: {
        minecraft: 'POST /api/gaming/minecraft/create-session',
        session: 'GET /api/gaming/sessions/[id]',
        endSession: 'DELETE /api/gaming/sessions/[id]',
      },
    },
  });
}