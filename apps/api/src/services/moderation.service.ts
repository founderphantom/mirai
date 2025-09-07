import { supabase } from '../lib/supabase';
import {
  ModerationLog,
  UserViolation,
  Json
} from '../types/database';
import OpenAI from 'openai';

// Lazy initialization of OpenAI client
let openaiClient: OpenAI | null = null;

/**
 * Get or create OpenAI client instance
 * Uses lazy initialization to avoid issues during testing
 */
function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    // Only initialize if we have an API key and not in test environment
    if (process.env.NODE_ENV === 'test') {
      // Return a mock client for tests
      return {
        moderations: {
          create: async () => ({
            id: 'test-moderation-id',
            model: 'text-moderation-latest',
            results: [{
              flagged: false,
              categories: {
                'hate': false,
                'hate/threatening': false,
                'harassment': false,
                'harassment/threatening': false,
                'self-harm': false,
                'self-harm/intent': false,
                'self-harm/instructions': false,
                'sexual': false,
                'sexual/minors': false,
                'violence': false,
                'violence/graphic': false
              },
              category_scores: {
                'hate': 0.001,
                'hate/threatening': 0.001,
                'harassment': 0.001,
                'harassment/threatening': 0.001,
                'self-harm': 0.001,
                'self-harm/intent': 0.001,
                'self-harm/instructions': 0.001,
                'sexual': 0.001,
                'sexual/minors': 0.001,
                'violence': 0.001,
                'violence/graphic': 0.001
              }
            }]
          })
        }
      } as any;
    }
    
    if (!process.env.OPENAI_API_KEY) {
      console.warn('OPENAI_API_KEY is not set. Moderation service will use fallback behavior.');
      // Return a mock client that always passes content
      return {
        moderations: {
          create: async () => ({
            id: 'fallback-moderation-id',
            model: 'text-moderation-latest',
            results: [{
              flagged: false,
              categories: {
                'hate': false,
                'hate/threatening': false,
                'harassment': false,
                'harassment/threatening': false,
                'self-harm': false,
                'self-harm/intent': false,
                'self-harm/instructions': false,
                'sexual': false,
                'sexual/minors': false,
                'violence': false,
                'violence/graphic': false
              },
              category_scores: {
                'hate': 0,
                'hate/threatening': 0,
                'harassment': 0,
                'harassment/threatening': 0,
                'self-harm': 0,
                'self-harm/intent': 0,
                'self-harm/instructions': 0,
                'sexual': 0,
                'sexual/minors': 0,
                'violence': 0,
                'violence/graphic': 0
              }
            }]
          })
        }
      } as any;
    }
    
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }
  
  return openaiClient;
}

export type ModerationAction = 'none' | 'warning' | 'blocked' | 'deleted';
export type ViolationType = 'content' | 'rate_limit' | 'abuse' | 'payment' | 'other';
export type ViolationSeverity = 'low' | 'medium' | 'high' | 'critical';
export type ViolationActionTaken = 'warning' | 'temporary_ban' | 'permanent_ban' | 'none';

interface ModerationResult {
  flagged: boolean;
  categories: string[];
  scores: Record<string, number>;
  action: ModerationAction;
  reason?: string;
}

interface ModerationThresholds {
  hate: number;
  'hate/threatening': number;
  harassment: number;
  'harassment/threatening': number;
  'self-harm': number;
  'self-harm/intent': number;
  'self-harm/instructions': number;
  sexual: number;
  'sexual/minors': number;
  violence: number;
  'violence/graphic': number;
}

const DEFAULT_THRESHOLDS: ModerationThresholds = {
  hate: 0.7,
  'hate/threatening': 0.5,
  harassment: 0.7,
  'harassment/threatening': 0.5,
  'self-harm': 0.5,
  'self-harm/intent': 0.3,
  'self-harm/instructions': 0.3,
  sexual: 0.8,
  'sexual/minors': 0.1,
  violence: 0.7,
  'violence/graphic': 0.7
};

export class ModerationService {
  /**
   * Check content for violations using OpenAI moderation
   */
  async checkContent(
    content: string,
    userId: string,
    messageId?: string
  ): Promise<ModerationResult> {
    try {
      // Use OpenAI's moderation API with lazy-initialized client
      const openai = getOpenAIClient();
      const moderation = await openai.moderations.create({
        input: content
      });

      const result = moderation.results[0];
      const flaggedCategories: string[] = [];
      const scores: Record<string, number> = {};

      // Check each category against thresholds
      for (const [category, score] of Object.entries(result.category_scores)) {
        scores[category] = score;
        
        const threshold = DEFAULT_THRESHOLDS[category as keyof ModerationThresholds];
        if (threshold && score >= threshold) {
          flaggedCategories.push(category);
        }
      }

      // Determine action based on flagged categories
      let action: ModerationAction = 'none';
      let reason: string | undefined;

      if (flaggedCategories.includes('sexual/minors')) {
        action = 'blocked';
        reason = 'Content violates child safety policies';
      } else if (
        flaggedCategories.includes('self-harm/intent') ||
        flaggedCategories.includes('self-harm/instructions')
      ) {
        action = 'blocked';
        reason = 'Content contains self-harm content';
      } else if (
        flaggedCategories.includes('hate/threatening') ||
        flaggedCategories.includes('harassment/threatening')
      ) {
        action = 'blocked';
        reason = 'Content contains threatening language';
      } else if (flaggedCategories.length > 0) {
        action = 'warning';
        reason = `Content flagged for: ${flaggedCategories.join(', ')}`;
      }

      // Log the moderation check
      await this.logModeration({
        user_id: userId,
        message_id: messageId || null,
        content: content.substring(0, 1000), // Truncate for storage
        flagged: flaggedCategories.length > 0,
        categories: flaggedCategories as Json,
        scores: scores as Json,
        action_taken: action
      });

      // Create violation record if needed
      if (action === 'blocked') {
        await this.createViolation(
          userId,
          'content',
          'high',
          reason || 'Content violated community guidelines',
          'warning'
        );
      }

      return {
        flagged: flaggedCategories.length > 0,
        categories: flaggedCategories,
        scores,
        action,
        reason
      };
    } catch (error) {
      console.error('Moderation check failed:', error);
      // On error, allow content but log the issue
      return {
        flagged: false,
        categories: [],
        scores: {},
        action: 'none'
      };
    }
  }

  /**
   * Log moderation check
   */
  async logModeration(data: {
    user_id: string;
    message_id: string | null;
    content: string;
    flagged: boolean;
    categories: Json;
    scores: Json;
    action_taken: ModerationAction;
  }): Promise<ModerationLog> {
    const { data: log, error } = await (supabase
      .from('moderation_logs') as any)
      .insert({
        ...data,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to log moderation: ${error.message}`);
    }

    return log;
  }

  /**
   * Create a violation record
   */
  async createViolation(
    userId: string,
    type: ViolationType,
    severity: ViolationSeverity,
    description: string,
    actionTaken: ViolationActionTaken,
    expiresAt?: Date
  ): Promise<UserViolation> {
    const { data: violation, error } = await (supabase
      .from('user_violations') as any)
      .insert({
        user_id: userId,
        type,
        severity,
        description,
        action_taken: actionTaken,
        expires_at: expiresAt?.toISOString() || null,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create violation: ${error.message}`);
    }

    // Apply the action
    await this.applyViolationAction(userId, actionTaken, expiresAt);

    return violation;
  }

  /**
   * Apply violation action to user
   */
  private async applyViolationAction(
    userId: string,
    action: ViolationActionTaken,
    expiresAt?: Date
  ): Promise<void> {
    switch (action) {
      case 'temporary_ban':
        // Update user profile to reflect temporary ban
        await (supabase
      .from('user_profiles') as any)
          .update({
            settings: {
              banned: true,
              ban_expires_at: expiresAt?.toISOString() || null
            } as Json,
            updated_at: new Date().toISOString()
          })
          .eq('id', userId);
        break;

      case 'permanent_ban':
        // Update user profile to reflect permanent ban
        await (supabase
      .from('user_profiles') as any)
          .update({
            settings: {
              banned: true,
              ban_permanent: true
            } as Json,
            updated_at: new Date().toISOString()
          })
          .eq('id', userId);
        break;

      case 'warning':
        // Just log the warning, no immediate action
        break;
    }
  }

  /**
   * Check if user is banned
   */
  async isUserBanned(userId: string): Promise<{
    banned: boolean;
    reason?: string;
    expiresAt?: Date;
  }> {
    const { data: profile } = await (supabase
      .from('user_profiles') as any)
      .select('settings')
      .eq('id', userId)
      .single();

    if (!profile || !profile.settings) {
      return { banned: false };
    }

    const settings = profile.settings as any;
    
    if (settings.banned) {
      // Check if temporary ban has expired
      if (settings.ban_expires_at && !settings.ban_permanent) {
        const expiresAt = new Date(settings.ban_expires_at);
        if (expiresAt < new Date()) {
          // Ban has expired, remove it
          await (supabase
      .from('user_profiles') as any)
            .update({
              settings: {
                ...settings,
                banned: false,
                ban_expires_at: null
              } as Json,
              updated_at: new Date().toISOString()
            })
            .eq('id', userId);
          
          return { banned: false };
        }
        
        return {
          banned: true,
          reason: 'Temporarily banned for policy violations',
          expiresAt
        };
      }
      
      return {
        banned: true,
        reason: settings.ban_permanent 
          ? 'Permanently banned for severe policy violations'
          : 'Banned for policy violations'
      };
    }

    return { banned: false };
  }

  /**
   * Get user violations
   */
  async getUserViolations(
    userId: string,
    includeExpired: boolean = false
  ): Promise<UserViolation[]> {
    let query = (supabase
      .from('user_violations') as any)
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (!includeExpired) {
      query = query.or('expires_at.is.null,expires_at.gt.' + new Date().toISOString());
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch violations: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get moderation logs for a user
   */
  async getUserModerationLogs(
    userId: string,
    limit: number = 50
  ): Promise<ModerationLog[]> {
    const { data, error } = await (supabase
      .from('moderation_logs') as any)
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to fetch moderation logs: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Review a moderation decision
   */
  async reviewModeration(
    moderationLogId: string,
    reviewerId: string,
    newAction: ModerationAction
  ): Promise<ModerationLog> {
    const { data, error } = await (supabase
      .from('moderation_logs') as any)
      .update({
        action_taken: newAction,
        reviewed_by: reviewerId,
        reviewed_at: new Date().toISOString()
      })
      .eq('id', moderationLogId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to review moderation: ${error.message}`);
    }

    return data;
  }

  /**
   * Get moderation statistics
   */
  async getModerationStats(
    startDate: string,
    endDate: string
  ): Promise<{
    totalChecks: number;
    flaggedContent: number;
    blockedContent: number;
    warningsIssued: number;
    byCategory: Record<string, number>;
    byAction: Record<string, number>;
  }> {
    const { data, error } = await (supabase
      .from('moderation_logs') as any)
      .select('flagged, categories, action_taken')
      .gte('created_at', startDate)
      .lte('created_at', endDate);

    if (error) {
      throw new Error(`Failed to fetch moderation stats: ${error.message}`);
    }

    const stats = {
      totalChecks: data?.length || 0,
      flaggedContent: 0,
      blockedContent: 0,
      warningsIssued: 0,
      byCategory: {} as Record<string, number>,
      byAction: {} as Record<string, number>
    };

    if (data) {
      for (const log of data) {
        if (log.flagged) stats.flaggedContent++;
        if (log.action_taken === 'blocked') stats.blockedContent++;
        if (log.action_taken === 'warning') stats.warningsIssued++;

        // Count by action
        stats.byAction[log.action_taken] = (stats.byAction[log.action_taken] || 0) + 1;

        // Count by category
        if (log.categories && Array.isArray(log.categories)) {
          for (const category of log.categories as string[]) {
            stats.byCategory[category] = (stats.byCategory[category] || 0) + 1;
          }
        }
      }
    }

    return stats;
  }

  /**
   * Check for abuse patterns (rate limiting, spam, etc.)
   */
  async checkAbusePatterns(userId: string): Promise<{
    isAbusive: boolean;
    patterns: string[];
  }> {
    const patterns: string[] = [];
    
    // Check for rapid-fire messages (more than 10 in 1 minute)
    const oneMinuteAgo = new Date(Date.now() - 60000);
    const { data: recentMessages } = await (supabase
      .from('chat_messages') as any)
      .select('id')
      .eq('role', 'user')
      .gte('created_at', oneMinuteAgo.toISOString())
      .eq('conversation_id', userId); // This needs fixing - should check by user_id through conversations

    if (recentMessages && recentMessages.length > 10) {
      patterns.push('rapid_messaging');
    }

    // Check for repeated content
    const { data: last10Messages } = await (supabase
      .from('chat_messages') as any)
      .select('content')
      .eq('role', 'user')
      .order('created_at', { ascending: false })
      .limit(10);

    if (last10Messages) {
      const contents = last10Messages.map((m: any) => m.content);
      const uniqueContents = new Set(contents);
      if (uniqueContents.size < contents.length / 2) {
        patterns.push('repeated_content');
      }
    }

    // Check for previous violations
    const { data: violations } = await (supabase
      .from('user_violations') as any)
      .select('type')
      .eq('user_id', userId)
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

    if (violations && violations.length > 3) {
      patterns.push('multiple_violations');
    }

    return {
      isAbusive: patterns.length > 0,
      patterns
    };
  }

  /**
   * Clean up old moderation logs (maintenance task)
   */
  async cleanupOldLogs(daysToKeep: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const { data, error } = await (supabase
      .from('moderation_logs') as any)
      .delete()
      .lt('created_at', cutoffDate.toISOString())
      .eq('action_taken', 'none')
      .select();

    if (error) {
      throw new Error(`Failed to cleanup moderation logs: ${error.message}`);
    }

    return data?.length || 0;
  }
}

// Export singleton instance
export const moderationService = new ModerationService();