import { NextApiResponse } from 'next';
import { requireAuth, AuthenticatedRequest } from '@/middleware/auth';
import { validate, schemas } from '@/middleware/validation';
import { asyncHandler } from '@/middleware/error';
import { rateLimit } from '@/middleware/rateLimit';
import { dbHelpers, getUserScopedClient } from '@/lib/supabase';

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  // Apply rate limiting
  await new Promise<void>((resolve) => rateLimit(req, res, resolve));

  switch (req.method) {
    case 'GET':
      return getUserProfile(req, res);
    case 'PUT':
      return updateUserProfile(req, res);
    default:
      return res.status(405).json({ error: 'Method not allowed' });
  }
}

async function getUserProfile(req: AuthenticatedRequest, res: NextApiResponse) {
  try {
    // Get user profile with subscription info
    const profile = await dbHelpers.getUserProfile(req.user!.id);
    
    if (!profile) {
      return res.status(404).json({
        error: {
          message: 'User profile not found',
        },
      });
    }

    // Get current subscription details
    const { data: subscription } = await dbHelpers.getUserSubscription(req.user!.id);

    // Get usage summary for current month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    
    const usageSummary = await dbHelpers.getUserUsageSummary(
      req.user!.id,
      startOfMonth,
      new Date()
    );

    // Combine all data
    const profileData = {
      ...profile,
      subscription: subscription || null,
      usage: usageSummary || null,
    };

    res.status(200).json({
      success: true,
      data: profileData,
    });
  } catch (error: any) {
    console.error('Get user profile error:', error);
    res.status(500).json({
      error: {
        message: error.message || 'Failed to fetch user profile',
      },
    });
  }
}

async function updateUserProfile(req: AuthenticatedRequest, res: NextApiResponse) {
  // Validate request body
  await new Promise<void>((resolve) => 
    validate(schemas.updateProfile)(req, res, resolve)
  );

  const {
    username,
    display_name,
    avatar_url,
    bio,
    preferences,
    metadata,
  } = req.body;

  try {
    // Build update object with only provided fields
    const updates: any = {};
    
    if (username !== undefined) updates.username = username;
    if (display_name !== undefined) updates.display_name = display_name;
    if (avatar_url !== undefined) updates.avatar_url = avatar_url;
    if (bio !== undefined) updates.bio = bio;
    if (preferences !== undefined) {
      // Merge preferences with existing ones
      const currentProfile = await dbHelpers.getUserProfile(req.user!.id);
      updates.preferences = {
        ...(currentProfile?.preferences || {}),
        ...preferences,
      };
    }
    if (metadata !== undefined) {
      // Merge metadata with existing ones
      const currentProfile = await dbHelpers.getUserProfile(req.user!.id);
      updates.metadata = {
        ...(currentProfile?.metadata || {}),
        ...metadata,
      };
    }

    // Check if username is already taken
    if (username) {
      const userClient = getUserScopedClient(req.user!.id, req.headers.authorization?.replace('Bearer ', '') || '');
      const { data: existingUser } = await userClient
        .from('user_profiles')
        .select('id')
        .eq('username', username)
        .neq('id', req.user!.id)
        .single();

      if (existingUser) {
        return res.status(400).json({
          error: {
            message: 'Username already taken',
            field: 'username',
          },
        });
      }
    }

    // Update the profile
    const updatedProfile = await dbHelpers.updateUserProfile(req.user!.id, updates);

    // Log the profile update
    await dbHelpers.logApiRequest(
      req.user!.id,
      '/api/users/profile',
      'PUT',
      200
    );

    res.status(200).json({
      success: true,
      data: updatedProfile,
    });
  } catch (error: any) {
    console.error('Update user profile error:', error);
    
    // Log the failed request
    await dbHelpers.logApiRequest(
      req.user!.id,
      '/api/users/profile',
      'PUT',
      500
    );

    res.status(500).json({
      error: {
        message: error.message || 'Failed to update user profile',
      },
    });
  }
}

export default requireAuth(asyncHandler(handler));