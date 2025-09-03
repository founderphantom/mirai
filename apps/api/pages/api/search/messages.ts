import { NextApiResponse } from 'next';
import { requireAuth, AuthenticatedRequest } from '@/middleware/auth';
import { validate, schemas } from '@/middleware/validation';
import { asyncHandler } from '@/middleware/error';
import { rateLimit } from '@/middleware/rateLimit';
import { dbHelpers } from '@/lib/supabase';

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  // Apply rate limiting
  await new Promise<void>((resolve) => rateLimit(req, res, resolve));

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  return searchMessages(req, res);
}

async function searchMessages(req: AuthenticatedRequest, res: NextApiResponse) {
  // Validate query parameters
  await new Promise<void>((resolve) => 
    validate(schemas.searchMessages)(req, res, resolve)
  );

  const { 
    q, 
    query,
    limit = 20, 
    offset = 0,
    conversation_id,
    include_context = true,
    highlight = true,
  } = req.query;

  const searchQuery = (q || query) as string;

  if (!searchQuery || searchQuery.trim().length < 2) {
    return res.status(400).json({
      error: {
        message: 'Search query must be at least 2 characters long',
        field: 'query',
      },
    });
  }

  try {
    // Use the RPC function for full-text search
    const searchResults = await dbHelpers.searchMessages(
      req.user!.id,
      searchQuery,
      Number(limit),
      Number(offset)
    );

    // Filter by conversation if specified
    let filteredResults = searchResults;
    if (conversation_id) {
      filteredResults = searchResults.filter(
        (result: any) => result.conversation_id === conversation_id
      );
    }

    // Format results with optional context
    const formattedResults = await Promise.all(
      filteredResults.map(async (result: any) => {
        const formatted: any = {
          message_id: result.message_id,
          conversation_id: result.conversation_id,
          conversation_title: result.conversation_title,
          role: result.role,
          created_at: result.created_at,
          rank: result.rank,
        };

        // Add highlighted content if requested
        if (highlight === 'true' || highlight === true) {
          // Simple highlighting - wrap search terms in <mark> tags
          const searchTerms = searchQuery.toLowerCase().split(' ');
          let highlightedContent = result.content;
          
          searchTerms.forEach(term => {
            if (term.length > 1) {
              const regex = new RegExp(`(${term})`, 'gi');
              highlightedContent = highlightedContent.replace(
                regex, 
                '<mark>$1</mark>'
              );
            }
          });
          
          formatted.content = highlightedContent;
          formatted.content_preview = highlightedContent.substring(0, 300) + 
            (highlightedContent.length > 300 ? '...' : '');
        } else {
          formatted.content_preview = result.content.substring(0, 300) + 
            (result.content.length > 300 ? '...' : '');
        }

        // Add context messages if requested
        if ((include_context === 'true' || include_context === true) && result.conversation_id) {
          try {
            // Get 2 messages before and after the matched message
            const contextMessages = await dbHelpers.getConversationMessagesRPC(
              result.conversation_id,
              req.user!.id,
              5
            );
            
            // Find the index of the current message
            const currentIndex = contextMessages.findIndex(
              (msg: any) => msg.message_id === result.message_id
            );
            
            if (currentIndex >= 0) {
              formatted.context = {
                before: contextMessages.slice(
                  Math.max(0, currentIndex - 2), 
                  currentIndex
                ),
                after: contextMessages.slice(
                  currentIndex + 1, 
                  Math.min(contextMessages.length, currentIndex + 3)
                ),
              };
            }
          } catch (contextError) {
            // If context retrieval fails, continue without it
            console.error('Failed to get message context:', contextError);
          }
        }

        return formatted;
      })
    );

    // Log the search request
    await dbHelpers.logApiRequest(
      req.user!.id,
      '/api/search/messages',
      'GET',
      200
    );

    res.status(200).json({
      success: true,
      data: {
        query: searchQuery,
        results: formattedResults,
        total: formattedResults.length,
        pagination: {
          limit: Number(limit),
          offset: Number(offset),
          has_more: formattedResults.length === Number(limit),
        },
      },
    });
  } catch (error: any) {
    console.error('Search messages error:', error);
    
    await dbHelpers.logApiRequest(
      req.user!.id,
      '/api/search/messages',
      'GET',
      500
    );

    res.status(500).json({
      error: {
        message: error.message || 'Failed to search messages',
      },
    });
  }
}

export default requireAuth(asyncHandler(handler));