import { NextApiResponse } from 'next';
import { requireAuth, AuthenticatedRequest } from '@/middleware/auth';
import { validate, schemas } from '@/middleware/validation';
import { asyncHandler } from '@/middleware/error';
import { rateLimit } from '@/middleware/rateLimit';
import { supabaseAdmin, dbHelpers } from '@/lib/supabase';

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  // Apply rate limiting
  await new Promise<void>((resolve) => rateLimit(req, res, resolve));

  switch (req.method) {
    case 'GET':
      return getConversations(req, res);
    case 'POST':
      return createConversation(req, res);
    default:
      return res.status(405).json({ error: 'Method not allowed' });
  }
}

async function getConversations(req: AuthenticatedRequest, res: NextApiResponse) {
  // Validate query parameters
  await new Promise<void>((resolve) => 
    validate(schemas.pagination)(req, res, resolve)
  );

  const { page = 1, limit = 20, sort = 'updated_at', order = 'desc' } = req.query;
  const offset = ((page as number) - 1) * (limit as number);

  try {
    // Get conversations for user
    const { data: conversations, error, count } = await supabaseAdmin
      .from('conversations')
      .select('*', { count: 'exact' })
      .eq('user_id', req.user!.id)
      .eq('is_archived', false)
      .order(sort as string, { ascending: order === 'asc' })
      .range(offset, offset + (limit as number) - 1);

    if (error) throw error;

    // Get message counts for each conversation
    const conversationsWithCounts = await Promise.all(
      (conversations || []).map(async (conv) => {
        const { count: messageCount } = await supabaseAdmin
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('conversation_id', conv.id);

        return {
          ...conv,
          message_count: messageCount || 0,
        };
      })
    );

    res.status(200).json({
      success: true,
      data: conversationsWithCounts,
      pagination: {
        page: page as number,
        limit: limit as number,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / (limit as number)),
      },
    });
  } catch (error: any) {
    res.status(500).json({
      error: {
        message: error.message || 'Failed to fetch conversations',
      },
    });
  }
}

async function createConversation(req: AuthenticatedRequest, res: NextApiResponse) {
  // Validate request body
  await new Promise<void>((resolve) => 
    validate(schemas.createConversation)(req, res, resolve)
  );

  const { title, aiModel, metadata } = req.body;

  try {
    const conversation = await dbHelpers.createConversation(
      req.user!.id,
      title,
      aiModel
    );

    // Add initial system message if metadata includes personality
    if (metadata?.personality) {
      await dbHelpers.addMessage(
        conversation.id,
        'system',
        `You are ${metadata.personality}. Respond accordingly.`
      );
    }

    res.status(201).json({
      success: true,
      data: conversation,
    });
  } catch (error: any) {
    res.status(500).json({
      error: {
        message: error.message || 'Failed to create conversation',
      },
    });
  }
}

export default requireAuth(asyncHandler(handler));