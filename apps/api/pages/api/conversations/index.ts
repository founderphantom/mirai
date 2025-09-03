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

  const { 
    page = 1, 
    limit = 20, 
    include_archived = false,
    starred_only = false,
  } = req.query;
  const offset = ((page as number) - 1) * (limit as number);

  try {
    // Use optimized RPC function to get conversations with last message
    const conversations: any[] = await dbHelpers.getConversationsWithLastMessage(
      req.user!.id,
      limit as number,
      offset,
      include_archived === 'true'
    );

    // If starred_only is requested, filter the results
    let filteredConversations = conversations;
    if (starred_only === 'true') {
      filteredConversations = conversations.filter((conv: any) => conv.is_starred);
    }

    // Get total count for pagination
    let countQuery = (supabaseAdmin
      .from('conversations') as any)
      .select('*', { count: 'exact', head: true })
      .eq('user_id', req.user!.id);
    
    if (include_archived !== 'true') {
      countQuery = countQuery.eq('is_archived', false);
    }
    
    const { count } = await countQuery;

    // Format the response with additional computed fields
    const formattedConversations = filteredConversations.map((conv: any) => ({
      id: conv.conversation_id,
      title: conv.title || 'Untitled Conversation',
      message_count: conv.message_count,
      is_starred: conv.is_starred,
      is_archived: conv.is_archived,
      created_at: conv.created_at,
      last_message: conv.last_message_content ? {
        content: conv.last_message_content,
        role: conv.last_message_role,
        created_at: conv.last_message_at,
      } : null,
      last_activity: conv.last_message_at,
    }));

    res.status(200).json({
      success: true,
      data: formattedConversations,
      pagination: {
        page: page as number,
        limit: limit as number,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / (limit as number)),
      },
    });
  } catch (error: any) {
    console.error('Get conversations error:', error);
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

  const { 
    title, 
    model_id,
    provider_id = 'openai',
    system_prompt,
    temperature,
    max_tokens,
    avatar_id,
    voice_id,
    personality_template,
    settings,
    metadata,
  } = req.body;

  try {
    // Create conversation with all optional parameters
    const conversation: any = await dbHelpers.createConversation(
      req.user!.id,
      title || 'New Conversation',
      model_id || 'gpt-3.5-turbo',
      provider_id,
      {
        systemPrompt: system_prompt || metadata?.personality ? 
          `You are ${metadata.personality}. Respond accordingly.` : undefined,
        temperature,
        maxTokens: max_tokens,
        avatarId: avatar_id,
        voiceId: voice_id,
        personalityTemplate: personality_template,
        settings: settings || metadata,
      }
    );

    // Add initial system message if provided
    if (system_prompt || metadata?.personality) {
      await dbHelpers.addMessage(
        conversation.id,
        'system',
        system_prompt || `You are ${metadata.personality}. Respond accordingly.`,
        req.user!.id,
        {
          modelId: model_id || 'gpt-3.5-turbo',
          providerId: provider_id,
        }
      );
    }

    // Log the conversation creation
    await dbHelpers.logApiRequest(
      req.user!.id,
      '/api/conversations',
      'POST',
      201
    );

    res.status(201).json({
      success: true,
      data: conversation,
    });
  } catch (error: any) {
    console.error('Create conversation error:', error);
    
    await dbHelpers.logApiRequest(
      req.user!.id,
      '/api/conversations',
      'POST',
      500
    );

    res.status(500).json({
      error: {
        message: error.message || 'Failed to create conversation',
      },
    });
  }
}

export default requireAuth(asyncHandler(handler));