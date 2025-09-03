import { NextApiResponse } from 'next';
import { requireAuth, AuthenticatedRequest } from '@/middleware/auth';
import { asyncHandler } from '@/middleware/error';
import { rateLimit } from '@/middleware/rateLimit';
import { dbHelpers, securityHelpers, supabaseAdmin } from '@/lib/supabase';

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  // Apply rate limiting
  await new Promise<void>((resolve) => rateLimit(req, res, resolve));

  const { id: conversationId, messageId } = req.query;

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
      return getMessage(req, res, messageId as string);
    case 'PUT':
      return updateMessage(req, res, messageId as string);
    case 'DELETE':
      return softDeleteMessage(req, res, messageId as string);
    default:
      return res.status(405).json({ error: 'Method not allowed' });
  }
}

async function getMessage(
  req: AuthenticatedRequest,
  res: NextApiResponse,
  messageId: string
) {
  try {
    // Get the message
    const { data: message, error } = await supabaseAdmin
      .from('chat_messages')
      .select('*')
      .eq('id', messageId)
      .eq('user_id', req.user!.id)
      .single();

    if (error || !message) {
      return res.status(404).json({
        error: {
          message: 'Message not found',
        },
      });
    }

    res.status(200).json({
      success: true,
      data: message,
    });
  } catch (error: any) {
    console.error('Get message error:', error);
    res.status(500).json({
      error: {
        message: error.message || 'Failed to fetch message',
      },
    });
  }
}

async function updateMessage(
  req: AuthenticatedRequest,
  res: NextApiResponse,
  messageId: string
) {
  const { rating, feedback } = req.body;

  try {
    // Verify message ownership
    const isOwner = await securityHelpers.verifyMessageOwnership(messageId, req.user!.id);
    
    if (!isOwner) {
      return res.status(404).json({
        error: {
          message: 'Message not found or access denied',
        },
      });
    }

    // Build update object
    const updates: any = {
      edited_at: new Date().toISOString(),
    };

    if (rating !== undefined) {
      if (rating < 1 || rating > 5) {
        return res.status(400).json({
          error: {
            message: 'Rating must be between 1 and 5',
            field: 'rating',
          },
        });
      }
      updates.rating = rating;
    }

    if (feedback !== undefined) {
      updates.feedback = feedback;
    }

    // Update the message
    const { data: updatedMessage, error } = await supabaseAdmin
      .from('chat_messages')
      .update(updates)
      .eq('id', messageId)
      .eq('user_id', req.user!.id)
      .select()
      .single();

    if (error) throw error;

    // Log the update
    await dbHelpers.logApiRequest(
      req.user!.id,
      `/api/conversations/${req.query.id}/messages/${messageId}`,
      'PUT',
      200
    );

    res.status(200).json({
      success: true,
      data: updatedMessage,
    });
  } catch (error: any) {
    console.error('Update message error:', error);
    
    await dbHelpers.logApiRequest(
      req.user!.id,
      `/api/conversations/${req.query.id}/messages/${messageId}`,
      'PUT',
      500
    );

    res.status(500).json({
      error: {
        message: error.message || 'Failed to update message',
      },
    });
  }
}

async function softDeleteMessage(
  req: AuthenticatedRequest,
  res: NextApiResponse,
  messageId: string
) {
  try {
    // Verify message ownership
    const isOwner = await securityHelpers.verifyMessageOwnership(messageId, req.user!.id);
    
    if (!isOwner) {
      return res.status(404).json({
        error: {
          message: 'Message not found or access denied',
        },
      });
    }

    // Soft delete the message
    const deletedMessage = await dbHelpers.softDeleteMessage(messageId, req.user!.id);

    // Log the deletion
    await dbHelpers.logApiRequest(
      req.user!.id,
      `/api/conversations/${req.query.id}/messages/${messageId}`,
      'DELETE',
      200
    );

    res.status(200).json({
      success: true,
      message: 'Message deleted successfully',
      data: {
        id: deletedMessage.id,
        deleted_at: deletedMessage.deleted_at,
      },
    });
  } catch (error: any) {
    console.error('Soft delete message error:', error);
    
    await dbHelpers.logApiRequest(
      req.user!.id,
      `/api/conversations/${req.query.id}/messages/${messageId}`,
      'DELETE',
      500
    );

    res.status(500).json({
      error: {
        message: error.message || 'Failed to delete message',
      },
    });
  }
}

export default requireAuth(asyncHandler(handler));