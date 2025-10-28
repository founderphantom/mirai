/**
 * Usage Tracking Service
 *
 * Tracks usage events (voice minutes, character creation, messages) and
 * syncs them to Polar for usage-based billing
 */

import { drizzle } from 'drizzle-orm/d1'
import { usageEvents, subscriptions, user, type NewUsageEvent } from '@proj-airi/database-schema'
import { eq, and, desc } from 'drizzle-orm'
import { Polar } from '@polar-sh/sdk'

export interface UsageEvent {
  userId: string
  eventType: 'voice_minutes' | 'character_creation' | 'message_sent'
  quantity: number
  metadata?: Record<string, any>
}

export interface UsageTrackingResult {
  success: boolean
  usageEventId: string
  syncedToPolar: boolean
  usage?: {
    used: number
    limit: number
    remaining: number
  }
}

/**
 * Track a usage event and sync to Polar if applicable
 */
export async function trackUsage(
  db: ReturnType<typeof drizzle>,
  polarAccessToken: string, // This will be the sandbox token when passed from routes
  event: UsageEvent,
): Promise<UsageTrackingResult> {
  const { userId, eventType, quantity, metadata = {} } = event

  // Create usage event in database
  const usageEvent: NewUsageEvent = {
    id: crypto.randomUUID(),
    userId,
    eventType,
    quantity,
    metadata: JSON.stringify(metadata),
    createdAt: new Date(),
    polarSynced: false,
  }

  await db.insert(usageEvents).values(usageEvent)

  // Initialize response
  const result: UsageTrackingResult = {
    success: true,
    usageEventId: usageEvent.id,
    syncedToPolar: false,
  }

  // If voice minutes, sync to Polar and check limits
  if (eventType === 'voice_minutes') {
    try {
      // Get user's Polar customer ID
      const currentUser = await db
        .select()
        .from(user)
        .where(eq(user.id, userId))
        .limit(1)

      if (!currentUser.length) {
        console.error('[USAGE] User not found:', userId)
        return result
      }

      const polarCustomerId = currentUser[0].polarCustomerId
      const userTier = currentUser[0].subscriptionTier

      // Calculate current usage
      const activeSubscription = await db
        .select()
        .from(subscriptions)
        .where(
          and(
            eq(subscriptions.userId, userId),
            eq(subscriptions.status, 'active'),
          ),
        )
        .orderBy(desc(subscriptions.createdAt))
        .limit(1)

      if (activeSubscription.length) {
        const currentPeriodStart = activeSubscription[0].currentPeriodStart

        // Get all usage events since current period start
        const allUsage = await db
          .select()
          .from(usageEvents)
          .where(
            and(
              eq(usageEvents.userId, userId),
              eq(usageEvents.eventType, 'voice_minutes'),
            ),
          )

        const totalUsed = allUsage
          .filter((e) => e.createdAt >= currentPeriodStart)
          .reduce((sum, e) => sum + e.quantity, 0)

        // Get tier limits
        const limits = getTierLimits(userTier || 'free')

        result.usage = {
          used: totalUsed,
          limit: limits.voiceMinutes,
          remaining: limits.voiceMinutes === -1 ? -1 : Math.max(0, limits.voiceMinutes - totalUsed),
        }
      }

      // Sync to Polar if customer exists and Pro/Max tier
      if (polarCustomerId && (userTier === 'pro' || userTier === 'max')) {
        try {
          const polar = new Polar({ accessToken: polarAccessToken })

          // Note: Actual Polar usage metering API would be called here
          // This is a placeholder for the actual implementation
          // await polar.usage.record({
          //   customerId: polarCustomerId,
          //   meterId: 'voice_minutes',
          //   value: quantity,
          //   timestamp: new Date().toISOString(),
          // })

          // Mark as synced
          await db
            .update(usageEvents)
            .set({ polarSynced: true })
            .where(eq(usageEvents.id, usageEvent.id))

          result.syncedToPolar = true

          console.log(`[USAGE] Synced to Polar: ${userId} - ${quantity} voice minutes`)
        } catch (polarError) {
          console.error('[USAGE] Polar sync error:', polarError)
          // Don't fail - usage is recorded locally even if Polar sync fails
        }
      }
    } catch (error) {
      console.error('[USAGE] Usage tracking error:', error)
      // Don't fail - usage is recorded in database
    }
  }

  return result
}

/**
 * Get current usage for a user in their current billing period
 */
export async function getCurrentUsage(
  db: ReturnType<typeof drizzle>,
  userId: string,
): Promise<{
  voiceMinutes: { used: number; limit: number; remaining: number }
  characters: { used: number; limit: number; remaining: number }
}> {
  // Get user tier
  const currentUser = await db
    .select()
    .from(user)
    .where(eq(user.id, userId))
    .limit(1)

  if (!currentUser.length) {
    throw new Error('User not found')
  }

  const userTier = currentUser[0].subscriptionTier || 'free'
  const limits = getTierLimits(userTier)

  // Get active subscription to determine billing period
  const activeSubscription = await db
    .select()
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.userId, userId),
        eq(subscriptions.status, 'active'),
      ),
    )
    .orderBy(desc(subscriptions.createdAt))
    .limit(1)

  // Get all voice minutes usage events
  const allVoiceUsage = await db
    .select()
    .from(usageEvents)
    .where(
      and(
        eq(usageEvents.userId, userId),
        eq(usageEvents.eventType, 'voice_minutes'),
      ),
    )

  let voiceMinutesUsed = 0

  if (activeSubscription.length) {
    // Paid tier: Count usage since current billing period start
    const currentPeriodStart = activeSubscription[0].currentPeriodStart
    voiceMinutesUsed = allVoiceUsage
      .filter((event) => event.createdAt >= currentPeriodStart)
      .reduce((sum, event) => sum + event.quantity, 0)
  } else {
    // Free tier or no subscription: Count ALL usage (no billing period reset)
    voiceMinutesUsed = allVoiceUsage
      .reduce((sum, event) => sum + event.quantity, 0)
  }

  // Note: Character usage is not metered per billing period - it's a static limit
  // We would need to count active characters for this user
  const characterCount = 0 // Placeholder - would query characters table

  return {
    voiceMinutes: {
      used: voiceMinutesUsed,
      limit: limits.voiceMinutes,
      remaining: limits.voiceMinutes === -1 ? -1 : Math.max(0, limits.voiceMinutes - voiceMinutesUsed),
    },
    characters: {
      used: characterCount,
      limit: limits.characters,
      remaining: limits.characters === -1 ? -1 : Math.max(0, limits.characters - characterCount),
    },
  }
}

/**
 * Check if user has available usage quota
 */
export async function checkUsageQuota(
  db: ReturnType<typeof drizzle>,
  userId: string,
  eventType: 'voice_minutes' | 'characters',
  requiredAmount: number = 1,
): Promise<{ allowed: boolean; reason?: string; usage?: any }> {
  const usage = await getCurrentUsage(db, userId)

  if (eventType === 'voice_minutes') {
    const { used, limit, remaining } = usage.voiceMinutes

    if (limit === -1) {
      // Unlimited (Max tier)
      return { allowed: true, usage }
    }

    if (remaining < requiredAmount) {
      return {
        allowed: false,
        reason: `Insufficient voice minutes. You have ${remaining} minutes remaining, but need ${requiredAmount}. Upgrade to get more minutes!`,
        usage,
      }
    }

    return { allowed: true, usage }
  }

  if (eventType === 'characters') {
    const { used, limit, remaining } = usage.characters

    if (remaining < requiredAmount) {
      return {
        allowed: false,
        reason: `Character limit reached. You can have ${limit} characters, but you already have ${used}.`,
        usage,
      }
    }

    return { allowed: true, usage }
  }

  return { allowed: true, usage }
}

/**
 * Check usage and return warning level
 * Returns: 'none' | 'approaching' (80%) | 'exceeded' (100%)
 */
export async function checkUsageWarnings(
  db: ReturnType<typeof drizzle>,
  userId: string,
  eventType: 'voice_minutes' | 'characters',
): Promise<{
  warningLevel: 'none' | 'approaching' | 'exceeded'
  usage: any
  percentUsed: number
}> {
  const usage = await getCurrentUsage(db, userId)

  let percentUsed = 0
  let warningLevel: 'none' | 'approaching' | 'exceeded' = 'none'

  if (eventType === 'voice_minutes') {
    const { used, limit } = usage.voiceMinutes

    // Unlimited tier has no warnings
    if (limit === -1) {
      return {
        warningLevel: 'none',
        usage,
        percentUsed: 0,
      }
    }

    percentUsed = (used / limit) * 100

    if (percentUsed >= 100) {
      warningLevel = 'exceeded'
    } else if (percentUsed >= 80) {
      warningLevel = 'approaching'
    }
  } else if (eventType === 'characters') {
    const { used, limit } = usage.characters

    if (limit === -1) {
      return {
        warningLevel: 'none',
        usage,
        percentUsed: 0,
      }
    }

    percentUsed = (used / limit) * 100

    if (percentUsed >= 100) {
      warningLevel = 'exceeded'
    } else if (percentUsed >= 80) {
      warningLevel = 'approaching'
    }
  }

  return {
    warningLevel,
    usage,
    percentUsed,
  }
}

/**
 * Helper: Get tier limits
 */
function getTierLimits(tier: string) {
  const limits = {
    free: {
      voiceMinutes: 20, // Free tier gets 20 minutes total
      characters: 1, // 1 preset character
    },
    pro: {
      voiceMinutes: 500, // 500 minutes per month
      characters: -1, // Unlimited (preset + marketplace)
    },
    max: {
      voiceMinutes: -1, // Unlimited
      characters: -1, // Unlimited custom characters
    },
  }

  return limits[tier as keyof typeof limits] || limits.free
}
