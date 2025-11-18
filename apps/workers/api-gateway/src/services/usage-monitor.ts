/**
 * Real-Time Usage Monitoring Service
 *
 * Monitors voice minute usage during active sessions and enforces
 * immediate quota limits by tracking accumulated session time.
 */

import { drizzle } from 'drizzle-orm/d1'
import { checkUsageQuota } from './usage'

export interface UsageMonitor {
  userId: string
  sessionId: string
  sessionStart: number
  lastCheck: number
  accumulatedSeconds: number
  isActive: boolean
}

// In-memory storage for active monitors (per-worker instance)
const activeMonitors = new Map<string, UsageMonitor>()

/**
 * Start monitoring a voice session
 */
export function startMonitoring(sessionId: string, userId: string): UsageMonitor {
  const monitor: UsageMonitor = {
    userId,
    sessionId,
    sessionStart: Date.now(),
    lastCheck: Date.now(),
    accumulatedSeconds: 0,
    isActive: true,
  }

  activeMonitors.set(sessionId, monitor)
  console.log('[USAGE_MONITOR] Started monitoring session:', {
    sessionId,
    userId,
  })

  return monitor
}

/**
 * Stop monitoring a voice session
 */
export function stopMonitoring(sessionId: string): number {
  const monitor = activeMonitors.get(sessionId)

  if (!monitor) {
    return 0
  }

  monitor.isActive = false
  const totalSeconds = monitor.accumulatedSeconds +
    Math.floor((Date.now() - monitor.lastCheck) / 1000)

  activeMonitors.delete(sessionId)

  console.log('[USAGE_MONITOR] Stopped monitoring session:', {
    sessionId,
    userId: monitor.userId,
    totalSeconds,
  })

  return totalSeconds
}

/**
 * Check quota and return warning level
 */
export async function checkQuotaStatus(
  db: ReturnType<typeof drizzle>,
  sessionId: string,
): Promise<{
  allowed: boolean
  warningLevel: 'none' | 'approaching' | 'exceeded'
  usage: any
  reason?: string
}> {
  const monitor = activeMonitors.get(sessionId)

  if (!monitor) {
    return {
      allowed: false,
      warningLevel: 'none',
      usage: null,
      reason: 'Session not being monitored',
    }
  }

  // Calculate current accumulated time
  const currentSeconds = monitor.accumulatedSeconds +
    Math.floor((Date.now() - monitor.lastCheck) / 1000)

  // Update monitor
  monitor.accumulatedSeconds = currentSeconds
  monitor.lastCheck = Date.now()

  // Check quota (account for the session time already used)
  const minutesUsed = Math.ceil(currentSeconds / 60)
  const quotaCheck = await checkUsageQuota(db, monitor.userId, 'voice_minutes', minutesUsed)

  // Determine warning level
  let warningLevel: 'none' | 'approaching' | 'exceeded' = 'none'

  if (quotaCheck.usage && quotaCheck.usage.voiceMinutes) {
    const { used, limit } = quotaCheck.usage.voiceMinutes

    // If unlimited, no warnings
    if (limit === -1) {
      warningLevel = 'none'
    } else {
      const percentUsed = (used / limit) * 100

      if (percentUsed >= 100) {
        warningLevel = 'exceeded'
      } else if (percentUsed >= 80) {
        warningLevel = 'approaching'
      }
    }
  }

  return {
    allowed: quotaCheck.allowed,
    warningLevel,
    usage: quotaCheck.usage,
    reason: quotaCheck.reason,
  }
}

/**
 * Get current usage for a session (without quota check)
 */
export function getSessionUsage(sessionId: string): { seconds: number; minutes: number } | null {
  const monitor = activeMonitors.get(sessionId)

  if (!monitor) {
    return null
  }

  const seconds = monitor.accumulatedSeconds +
    Math.floor((Date.now() - monitor.lastCheck) / 1000)
  const minutes = Math.ceil(seconds / 60)

  return { seconds, minutes }
}

/**
 * Get all active monitors (for debugging)
 */
export function getActiveMonitors(): UsageMonitor[] {
  return Array.from(activeMonitors.values())
}

/**
 * Periodic quota checker (call this every 60 seconds during WebSocket connection)
 */
export async function periodicQuotaCheck(
  db: ReturnType<typeof drizzle>,
  sessionId: string,
  onQuotaExceeded?: (reason: string, usage: any) => void,
  onWarning?: (warningLevel: 'approaching' | 'exceeded', usage: any) => void,
): Promise<boolean> {
  const status = await checkQuotaStatus(db, sessionId)

  // Handle warnings
  if (status.warningLevel === 'approaching' && onWarning) {
    onWarning('approaching', status.usage)
  }

  // Handle quota exceeded
  if (!status.allowed) {
    if (onQuotaExceeded) {
      onQuotaExceeded(status.reason || 'Quota exceeded', status.usage)
    }
    return false // Signal to disconnect
  }

  return true // Continue session
}
