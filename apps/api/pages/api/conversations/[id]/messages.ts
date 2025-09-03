import { NextApiResponse } from 'next';
import { requireAuth, AuthenticatedRequest } from '@/middleware/auth';
import { validate, schemas } from '@/middleware/validation';
import { asyncHandler } from '@/middleware/error';
import { rateLimit } from '@/middleware/rateLimit';
import { supabaseAdmin, dbHelpers } from '@/lib/supabase';
import { llmService, ChatMessage } from '@/services/llm.service';
import { cacheService } from '@/lib/redis';

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  // Apply rate limiting
  await new Promise<void>((resolve) => rateLimit(req, res, resolve));

  const { id: conversationId } = req.query;

  // Verify conversation ownership
  const { data: conversation, error: convError } = await supabaseAdmin
    .from('conversations')
    .select('*')
    .eq('id', conversationId as string)
    .eq('user_id', req.user!.id)
    .single();

  if (convError || !conversation) {
    return res.status(404).json({ error: 'Conversation not found' });
  }

  switch (req.method) {
    case 'GET':
      return getMessages(req, res, conversationId as string);
    case 'POST':
      return sendMessage(req, res, conversation);
    default:
      return res.status(405).json({ error: 'Method not allowed' });
  }
}

async function getMessages(
  req: AuthenticatedRequest,
  res: NextApiResponse,
  conversationId: string
) {
  // Validate query parameters
  await new Promise<void>((resolve) => 
    validate(schemas.pagination)(req, res, resolve)
  );

  const { page = 1, limit = 50 } = req.query;
  const offset = ((page as number) - 1) * (limit as number);

  try {
    const { data: messages, error, count } = await supabaseAdmin
      .from('messages')
      .select('*', { count: 'exact' })
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .range(offset, offset + (limit as number) - 1);

    if (error) throw error;

    res.status(200).json({
      success: true,
      data: messages,
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
        message: error.message || 'Failed to fetch messages',
      },
    });
  }
}

async function sendMessage(
  req: AuthenticatedRequest,
  res: NextApiResponse,
  conversation: any
) {
  // Validate request body
  await new Promise<void>((resolve) => 
    validate(schemas.sendMessage)(req, res, resolve)
  );

  const { content, model, temperature, maxTokens, stream } = req.body;

  try {
    // Check content moderation
    const moderation = await llmService.moderateContent(content);
    if (moderation.flagged) {
      return res.status(400).json({
        error: {
          message: 'Content violates our usage policies',
          categories: moderation.categories,
        },
      });
    }

    // Save user message
    const userMessage = await dbHelpers.addMessage(
      conversation.id,
      'user',
      content
    );

    // Get conversation context from cache or database
    let messages: ChatMessage[] = [];
    
    const cachedContext = await cacheService.getConversationContext(conversation.id);
    if (cachedContext) {
      messages = cachedContext;
    } else {
      const previousMessages = await dbHelpers.getConversationMessages(conversation.id, 20);
      messages = previousMessages.map(msg => ({
        role: msg.role as 'system' | 'user' | 'assistant',
        content: msg.content,
      }));
      
      // Cache context for 30 minutes
      await cacheService.setConversationContext(conversation.id, messages, 1800);
    }

    // Add current message to context
    messages.push({ role: 'user', content });

    // Handle streaming response
    if (stream) {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      });

      const responseStream = await llmService.chatCompletion(messages, {
        model: model || conversation.ai_model,
        temperature,
        maxTokens,
        stream: true,
        userId: req.user!.id,
        conversationId: conversation.id,
      });

      let fullResponse = '';
      
      for await (const chunk of responseStream as AsyncGenerator<string>) {
        fullResponse += chunk;
        res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
      }

      // Save assistant response
      await dbHelpers.addMessage(conversation.id, 'assistant', fullResponse);

      // Update conversation
      await supabaseAdmin
        .from('conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', conversation.id);

      res.write('data: [DONE]\n\n');
      res.end();
    } else {
      // Non-streaming response
      const response = await llmService.chatCompletion(messages, {
        model: model || conversation.ai_model,
        temperature,
        maxTokens,
        cacheResponse: true,
        userId: req.user!.id,
        conversationId: conversation.id,
      });

      // Save assistant response
      const assistantMessage = await dbHelpers.addMessage(
        conversation.id,
        'assistant',
        response as string
      );

      // Update conversation
      await supabaseAdmin
        .from('conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', conversation.id);

      res.status(200).json({
        success: true,
        data: {
          userMessage,
          assistantMessage,
        },
      });
    }
  } catch (error: any) {
    console.error('Send message error:', error);
    res.status(500).json({
      error: {
        message: error.message || 'Failed to send message',
      },
    });
  }
}

export default requireAuth(asyncHandler(handler));