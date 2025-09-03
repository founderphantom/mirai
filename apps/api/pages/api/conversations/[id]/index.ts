import { NextApiResponse } from 'next';
import { requireAuth, AuthenticatedRequest } from '@/middleware/auth';
import { validate } from '@/middleware/validation';
import { asyncHandler } from '@/middleware/error';
import { rateLimit } from '@/middleware/rateLimit';
import { supabaseAdmin, dbHelpers, securityHelpers } from '@/lib/supabase';
import { z } from 'zod';

// Validation schema for updating conversation
const updateConversationSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  summary: z.string().max(500).optional(),
  is_archived: z.boolean().optional(),
  is_starred: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  temperature: z.number().min(0).max(2).optional(),
  max_tokens: z.number().min(1).max(32000).optional(),
  system_prompt: z.string().optional(),
  settings: z.record(z.any()).optional(),
});

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  // Apply rate limiting
  await new Promise<void>((resolve) => rateLimit(req, res, resolve));

  const { id: conversationId } = req.query;

  // Verify conversation ownership
  const isOwner = await securityHelpers.verifyConversationOwnership(
    conversationId as string,
    req.user!.id
  );

  if (!isOwner) {
    return res.status(404).json({ 
      error: 'Conversation not found or access denied' 
    });
  }

  switch (req.method) {
    case 'GET':
      return getConversation(req, res, conversationId as string);
    case 'PATCH':
    case 'PUT':
      return updateConversation(req, res, conversationId as string);
    case 'DELETE':
      return deleteConversation(req, res, conversationId as string);
    default:
      return res.status(405).json({ error: 'Method not allowed' });
  }
}

async function getConversation(
  req: AuthenticatedRequest,
  res: NextApiResponse,
  conversationId: string
) {
  try {
    // Get conversation details
    const { data: conversation, error } = await supabaseAdmin
      .from('conversations')
      .select('*')
      .eq('id', conversationId)
      .eq('user_id', req.user!.id)
      .single();

    if (error || !conversation) {
      return res.status(404).json({
        error: {
          message: 'Conversation not found',
        },
      });
    }

    // Get conversation summary with token usage
    const summary = await dbHelpers.getConversationSummary(
      conversationId,
      req.user!.id
    );

    // Get recent messages count
    const { count: messageCount } = await supabaseAdmin
      .from('chat_messages')
      .select('*', { count: 'exact', head: true })
      .eq('conversation_id', conversationId)
      .is('deleted_at', null);

    // Combine all data
    const fullConversation = {
      ...(conversation as object),
      message_count: messageCount || 0,
      usage_summary: summary,
    };

    res.status(200).json({
      success: true,
      data: fullConversation,
    });
  } catch (error: any) {
    console.error('Get conversation error:', error);
    res.status(500).json({
      error: {
        message: error.message || 'Failed to fetch conversation',
      },
    });
  }
}

async function updateConversation(
  req: AuthenticatedRequest,
  res: NextApiResponse,
  conversationId: string
) {
  // Validate request body
  await new Promise<void>((resolve) => 
    validate(updateConversationSchema)(req, res, resolve)
  );

  const updates = req.body;

  try {
    // Build update object
    const conversationUpdates: any = {
      updated_at: new Date().toISOString(),
    };

    // Add fields that can be updated
    if (updates.title !== undefined) conversationUpdates.title = updates.title;
    if (updates.summary !== undefined) conversationUpdates.summary = updates.summary;
    if (updates.is_archived !== undefined) conversationUpdates.is_archived = updates.is_archived;
    if (updates.is_starred !== undefined) conversationUpdates.is_starred = updates.is_starred;
    if (updates.tags !== undefined) conversationUpdates.tags = updates.tags;
    if (updates.temperature !== undefined) conversationUpdates.temperature = updates.temperature;
    if (updates.max_tokens !== undefined) conversationUpdates.max_tokens = updates.max_tokens;
    if (updates.system_prompt !== undefined) conversationUpdates.system_prompt = updates.system_prompt;
    if (updates.settings !== undefined) {
      // Merge settings with existing ones
      const { data: existing } = await supabaseAdmin
        .from('conversations')
        .select('settings')
        .eq('id', conversationId)
        .single();
      
      conversationUpdates.settings = {
        ...((existing as any)?.settings || {}),
        ...updates.settings,
      };
    }

    // Update the conversation
    const { data: updatedConversation, error } = await (supabaseAdmin
      .from('conversations') as any)
      .update(conversationUpdates)
      .eq('id', conversationId)
      .eq('user_id', req.user!.id)
      .select()
      .single();

    if (error) throw error;

    // Log the update
    await dbHelpers.logApiRequest(
      req.user!.id,
      `/api/conversations/${conversationId}`,
      req.method || 'PATCH',
      200
    );

    res.status(200).json({
      success: true,
      data: updatedConversation,
    });
  } catch (error: any) {
    console.error('Update conversation error:', error);
    
    await dbHelpers.logApiRequest(
      req.user!.id,
      `/api/conversations/${conversationId}`,
      req.method || 'PATCH',
      500
    );

    res.status(500).json({
      error: {
        message: error.message || 'Failed to update conversation',
      },
    });
  }
}

async function deleteConversation(
  req: AuthenticatedRequest,
  res: NextApiResponse,
  conversationId: string
) {
  try {
    // Instead of hard delete, we archive the conversation
    const { data: archivedConversation, error } = await (supabaseAdmin
      .from('conversations') as any)
      .update({
        is_archived: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', conversationId)
      .eq('user_id', req.user!.id)
      .select()
      .single();

    if (error) throw error;

    // Soft delete all messages in the conversation
    await (supabaseAdmin
      .from('chat_messages') as any)
      .update({
        deleted_at: new Date().toISOString(),
      })
      .eq('conversation_id', conversationId)
      .eq('user_id', req.user!.id);

    // Log the deletion
    await dbHelpers.logApiRequest(
      req.user!.id,
      `/api/conversations/${conversationId}`,
      'DELETE',
      200
    );

    res.status(200).json({
      success: true,
      message: 'Conversation archived successfully',
      data: {
        id: archivedConversation.id,
        is_archived: archivedConversation.is_archived,
      },
    });
  } catch (error: any) {
    console.error('Delete conversation error:', error);
    
    await dbHelpers.logApiRequest(
      req.user!.id,
      `/api/conversations/${conversationId}`,
      'DELETE',
      500
    );

    res.status(500).json({
      error: {
        message: error.message || 'Failed to delete conversation',
      },
    });
  }
}

export default requireAuth(asyncHandler(handler));