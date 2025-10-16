/**
 * Metrics Tracker for Voice Agent
 *
 * Tracks streaming response metrics for production debugging:
 * - Time to First Audio Chunk (TTFA)
 * - Average chunk latency
 * - STT accuracy
 */

export interface InteractionMetrics {
  interactionId: string;
  sessionKey: string;

  // Timing metrics
  startTime: number;
  firstAudioChunkTime?: number;
  endTime?: number;

  // Audio chunk metrics
  audioChunks: {
    chunkIndex: number;
    timestamp: number;
    latency: number; // Time since last chunk (or start for first chunk)
    textLength: number;
    audioLength: number; // In samples or bytes
  }[];

  // STT metrics
  sttStartTime?: number;
  sttEndTime?: number;
  sttSuccess: boolean;
  sttError?: string;
  sttText?: string;

  // LLM metrics
  llmStartTime?: number;
  llmEndTime?: number;
  llmTokenCount?: number;

  // Computed metrics
  ttfa?: number; // Time to First Audio in ms
  totalDuration?: number; // Total interaction duration in ms
  avgChunkLatency?: number; // Average latency between chunks in ms
}

export interface SessionMetrics {
  sessionKey: string;
  startTime: number;
  endTime?: number;

  // Interaction history
  interactions: InteractionMetrics[];

  // Aggregate metrics
  totalInteractions: number;
  successfulInteractions: number;
  failedInteractions: number;

  // Average metrics across all interactions
  avgTTFA?: number;
  avgChunkLatency?: number;
  avgInteractionDuration?: number;

  // STT metrics
  totalSTTAttempts: number;
  successfulSTTAttempts: number;
  sttAccuracy: number; // Percentage
}

export class MetricsTracker {
  private sessions: Map<string, SessionMetrics> = new Map();
  private currentInteractions: Map<string, InteractionMetrics> = new Map();

  /**
   * Initialize a new session
   */
  initSession(sessionKey: string): void {
    if (!this.sessions.has(sessionKey)) {
      this.sessions.set(sessionKey, {
        sessionKey,
        startTime: Date.now(),
        interactions: [],
        totalInteractions: 0,
        successfulInteractions: 0,
        failedInteractions: 0,
        totalSTTAttempts: 0,
        successfulSTTAttempts: 0,
        sttAccuracy: 0,
      });
      console.log(`[MetricsTracker] Session initialized: ${sessionKey}`);
    }
  }

  /**
   * Start tracking a new interaction
   */
  startInteraction(sessionKey: string, interactionId: string): void {
    this.initSession(sessionKey); // Ensure session exists

    const metrics: InteractionMetrics = {
      interactionId,
      sessionKey,
      startTime: Date.now(),
      audioChunks: [],
      sttSuccess: true, // Default to true, set to false if error occurs
    };

    this.currentInteractions.set(interactionId, metrics);
    console.log(`[MetricsTracker] Interaction started: ${interactionId}`);
  }

  /**
   * Record STT start
   */
  recordSTTStart(interactionId: string): void {
    const metrics = this.currentInteractions.get(interactionId);
    if (metrics) {
      metrics.sttStartTime = Date.now();
    }
  }

  /**
   * Record STT completion
   */
  recordSTTComplete(interactionId: string, text: string, success: boolean = true): void {
    const metrics = this.currentInteractions.get(interactionId);
    if (metrics) {
      metrics.sttEndTime = Date.now();
      metrics.sttSuccess = success;
      metrics.sttText = text;

      const session = this.sessions.get(metrics.sessionKey);
      if (session) {
        session.totalSTTAttempts++;
        if (success) {
          session.successfulSTTAttempts++;
        }
      }

      console.log(`[MetricsTracker] STT completed: ${interactionId}, success: ${success}, text length: ${text.length}`);
    }
  }

  /**
   * Record STT error
   */
  recordSTTError(interactionId: string, error: string): void {
    const metrics = this.currentInteractions.get(interactionId);
    if (metrics) {
      metrics.sttEndTime = Date.now();
      metrics.sttSuccess = false;
      metrics.sttError = error;

      const session = this.sessions.get(metrics.sessionKey);
      if (session) {
        session.totalSTTAttempts++;
      }

      console.log(`[MetricsTracker] STT error: ${interactionId}, error: ${error}`);
    }
  }

  /**
   * Record LLM start
   */
  recordLLMStart(interactionId: string): void {
    const metrics = this.currentInteractions.get(interactionId);
    if (metrics) {
      metrics.llmStartTime = Date.now();
    }
  }

  /**
   * Record LLM completion
   */
  recordLLMComplete(interactionId: string, tokenCount?: number): void {
    const metrics = this.currentInteractions.get(interactionId);
    if (metrics) {
      metrics.llmEndTime = Date.now();
      metrics.llmTokenCount = tokenCount;
    }
  }

  /**
   * Record an audio chunk being sent
   */
  recordAudioChunk(
    interactionId: string,
    chunkIndex: number,
    textLength: number,
    audioLength: number
  ): void {
    const metrics = this.currentInteractions.get(interactionId);
    if (!metrics) {
      console.warn(`[MetricsTracker] Interaction not found: ${interactionId}`);
      return;
    }

    const now = Date.now();

    // Calculate latency (time since last chunk or start)
    const lastTimestamp = metrics.audioChunks.length > 0
      ? metrics.audioChunks[metrics.audioChunks.length - 1].timestamp
      : metrics.startTime;
    const latency = now - lastTimestamp;

    // Record first audio chunk time (TTFA)
    if (chunkIndex === 0) {
      metrics.firstAudioChunkTime = now;
      metrics.ttfa = now - metrics.startTime;
      console.log(`[MetricsTracker] TTFA for ${interactionId}: ${metrics.ttfa}ms`);
    }

    metrics.audioChunks.push({
      chunkIndex,
      timestamp: now,
      latency,
      textLength,
      audioLength,
    });
  }

  /**
   * Complete an interaction and calculate final metrics
   */
  endInteraction(interactionId: string, success: boolean = true): void {
    const metrics = this.currentInteractions.get(interactionId);
    if (!metrics) {
      console.warn(`[MetricsTracker] Interaction not found for completion: ${interactionId}`);
      return;
    }

    metrics.endTime = Date.now();
    metrics.totalDuration = metrics.endTime - metrics.startTime;

    // Calculate average chunk latency
    if (metrics.audioChunks.length > 0) {
      const totalLatency = metrics.audioChunks.reduce((sum, chunk) => sum + chunk.latency, 0);
      metrics.avgChunkLatency = totalLatency / metrics.audioChunks.length;
    }

    // Add to session history
    const session = this.sessions.get(metrics.sessionKey);
    if (session) {
      session.interactions.push(metrics);
      session.totalInteractions++;

      if (success) {
        session.successfulInteractions++;
      } else {
        session.failedInteractions++;
      }

      // Update session aggregates
      this.updateSessionAggregates(session);

      // Update STT accuracy
      if (session.totalSTTAttempts > 0) {
        session.sttAccuracy = (session.successfulSTTAttempts / session.totalSTTAttempts) * 100;
      }
    }

    // Log summary
    console.log(`[MetricsTracker] Interaction completed: ${interactionId}`, {
      ttfa: metrics.ttfa,
      avgChunkLatency: metrics.avgChunkLatency,
      totalDuration: metrics.totalDuration,
      chunks: metrics.audioChunks.length,
      sttSuccess: metrics.sttSuccess,
    });

    // Remove from current interactions
    this.currentInteractions.delete(interactionId);
  }

  /**
   * Update session-level aggregate metrics
   */
  private updateSessionAggregates(session: SessionMetrics): void {
    const recentInteractions = session.interactions.slice(-20); // Last 20 interactions

    if (recentInteractions.length === 0) return;

    // Calculate average TTFA
    const ttfaValues = recentInteractions
      .map(i => i.ttfa)
      .filter((v): v is number => v !== undefined);
    if (ttfaValues.length > 0) {
      session.avgTTFA = ttfaValues.reduce((sum, v) => sum + v, 0) / ttfaValues.length;
    }

    // Calculate average chunk latency
    const chunkLatencies = recentInteractions
      .map(i => i.avgChunkLatency)
      .filter((v): v is number => v !== undefined);
    if (chunkLatencies.length > 0) {
      session.avgChunkLatency = chunkLatencies.reduce((sum, v) => sum + v, 0) / chunkLatencies.length;
    }

    // Calculate average interaction duration
    const durations = recentInteractions
      .map(i => i.totalDuration)
      .filter((v): v is number => v !== undefined);
    if (durations.length > 0) {
      session.avgInteractionDuration = durations.reduce((sum, v) => sum + v, 0) / durations.length;
    }
  }

  /**
   * End a session
   */
  endSession(sessionKey: string): void {
    const session = this.sessions.get(sessionKey);
    if (session) {
      session.endTime = Date.now();
      console.log(`[MetricsTracker] Session ended: ${sessionKey}`, {
        totalInteractions: session.totalInteractions,
        avgTTFA: session.avgTTFA,
        avgChunkLatency: session.avgChunkLatency,
        sttAccuracy: session.sttAccuracy,
      });
    }
  }

  /**
   * Get metrics for a specific session
   */
  getSessionMetrics(sessionKey: string): SessionMetrics | undefined {
    return this.sessions.get(sessionKey);
  }

  /**
   * Get metrics for a specific interaction
   */
  getInteractionMetrics(interactionId: string): InteractionMetrics | undefined {
    // Check current interactions first
    const current = this.currentInteractions.get(interactionId);
    if (current) return current;

    // Search in session history
    for (const session of this.sessions.values()) {
      const interaction = session.interactions.find(i => i.interactionId === interactionId);
      if (interaction) return interaction;
    }

    return undefined;
  }

  /**
   * Get aggregate metrics across all sessions
   */
  getAggregateMetrics(): {
    totalSessions: number;
    totalInteractions: number;
    avgTTFA?: number;
    avgChunkLatency?: number;
    avgInteractionDuration?: number;
    overallSTTAccuracy: number;
  } {
    const sessions = Array.from(this.sessions.values());

    if (sessions.length === 0) {
      return {
        totalSessions: 0,
        totalInteractions: 0,
        overallSTTAccuracy: 0,
      };
    }

    const totalInteractions = sessions.reduce((sum, s) => sum + s.totalInteractions, 0);

    // Calculate overall averages
    const ttfaValues = sessions
      .map(s => s.avgTTFA)
      .filter((v): v is number => v !== undefined);
    const avgTTFA = ttfaValues.length > 0
      ? ttfaValues.reduce((sum, v) => sum + v, 0) / ttfaValues.length
      : undefined;

    const chunkLatencies = sessions
      .map(s => s.avgChunkLatency)
      .filter((v): v is number => v !== undefined);
    const avgChunkLatency = chunkLatencies.length > 0
      ? chunkLatencies.reduce((sum, v) => sum + v, 0) / chunkLatencies.length
      : undefined;

    const durations = sessions
      .map(s => s.avgInteractionDuration)
      .filter((v): v is number => v !== undefined);
    const avgInteractionDuration = durations.length > 0
      ? durations.reduce((sum, v) => sum + v, 0) / durations.length
      : undefined;

    // Calculate overall STT accuracy
    const totalSTTAttempts = sessions.reduce((sum, s) => sum + s.totalSTTAttempts, 0);
    const successfulSTTAttempts = sessions.reduce((sum, s) => sum + s.successfulSTTAttempts, 0);
    const overallSTTAccuracy = totalSTTAttempts > 0
      ? (successfulSTTAttempts / totalSTTAttempts) * 100
      : 0;

    return {
      totalSessions: sessions.length,
      totalInteractions,
      avgTTFA,
      avgChunkLatency,
      avgInteractionDuration,
      overallSTTAccuracy,
    };
  }

  /**
   * Clean up old sessions (keep only recent sessions)
   */
  cleanup(maxSessions: number = 100): void {
    if (this.sessions.size <= maxSessions) return;

    // Sort by start time and keep only the most recent sessions
    const sessions = Array.from(this.sessions.entries())
      .sort(([, a], [, b]) => b.startTime - a.startTime)
      .slice(0, maxSessions);

    this.sessions = new Map(sessions);
    console.log(`[MetricsTracker] Cleaned up old sessions, kept ${sessions.length}`);
  }

  /**
   * Get a summary for logging/debugging
   */
  getSummary(): string {
    const aggregate = this.getAggregateMetrics();
    return JSON.stringify({
      totalSessions: aggregate.totalSessions,
      totalInteractions: aggregate.totalInteractions,
      avgTTFA: aggregate.avgTTFA ? `${aggregate.avgTTFA.toFixed(0)}ms` : 'N/A',
      avgChunkLatency: aggregate.avgChunkLatency ? `${aggregate.avgChunkLatency.toFixed(0)}ms` : 'N/A',
      sttAccuracy: `${aggregate.overallSTTAccuracy.toFixed(1)}%`,
    }, null, 2);
  }
}

// Singleton instance
let instance: MetricsTracker | null = null;

export function getMetricsTracker(): MetricsTracker {
  if (!instance) {
    instance = new MetricsTracker();
  }
  return instance;
}
