/**
 * Character Management Schema
 *
 * Tables for user-owned AI characters and their configurations
 */

import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { user } from './auth'

/**
 * Characters table
 * User-owned AI characters with personality configurations
 */
export const characters = sqliteTable('characters', {
  id: text('id').primaryKey(), // UUID
  userId: text('user_id')
    .references(() => user.id, { onDelete: 'cascade' }), // Nullable for preset characters
  inworldCharacterId: text('inworld_character_id').notNull(), // Inworld Studio API character ID
  displayName: text('display_name').notNull(),
  live2dModelKey: text('live2d_model_key'), // R2 key for Live2D model
  avatarThumbnail: text('avatar_thumbnail'), // R2 URL for avatar image
  description: text('description'), // Character description for display

  // Personality configuration stored as JSON
  // Schema: { motivations, flaws, dialogue_style, adjectives, voice_config }
  personalityConfig: text('personality_config', { mode: 'json' }).notNull(),

  // Live2D model configuration for auto-scaling and positioning
  // Schema: { baseScale, offsetX, offsetY }
  live2dModelConfig: text('live2d_model_config', { mode: 'json' }),

  // Metadata
  isPreset: integer('is_preset', { mode: 'boolean' }).default(false), // System preset characters
  isPublic: integer('is_public', { mode: 'boolean' }).default(false), // For marketplace
  totalConversations: integer('total_conversations').default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
}, (table) => ({
  userIdIdx: index('idx_user_id').on(table.userId),
  inworldIdIdx: index('idx_inworld_id').on(table.inworldCharacterId),
  presetIdx: index('idx_preset').on(table.isPreset),
}))

/**
 * Conversations table
 * Metadata for conversations (actual messages stored in Inworld)
 */
export const conversations = sqliteTable('conversations', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  characterId: text('character_id')
    .notNull()
    .references(() => characters.id, { onDelete: 'cascade' }),
  inworldSessionId: text('inworld_session_id'), // Inworld session ID
  startedAt: integer('started_at', { mode: 'timestamp' }).notNull(),
  endedAt: integer('ended_at', { mode: 'timestamp' }),
  durationSeconds: integer('duration_seconds'),
  messageCount: integer('message_count').default(0),
}, (table) => ({
  userConversationsIdx: index('idx_user_conversations').on(table.userId, table.startedAt),
  characterConversationsIdx: index('idx_character_conversations').on(table.characterId, table.startedAt),
}))

/**
 * Voice sessions table
 * WebRTC/WebSocket state tracking
 */
export const voiceSessions = sqliteTable('voice_sessions', {
  id: text('id').primaryKey(),
  conversationId: text('conversation_id')
    .notNull()
    .references(() => conversations.id, { onDelete: 'cascade' }),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  characterId: text('character_id')
    .notNull()
    .references(() => characters.id, { onDelete: 'cascade' }),

  // Session state
  status: text('status', {
    enum: ['active', 'paused', 'ended']
  }).notNull(),
  websocketUrl: text('websocket_url'), // Cloudflare Container WS endpoint

  // Metrics
  totalAudioSeconds: integer('total_audio_seconds').default(0),
  startedAt: integer('started_at', { mode: 'timestamp' }).notNull(),
  endedAt: integer('ended_at', { mode: 'timestamp' }),
}, (table) => ({
  activeSessionsIdx: index('idx_active_sessions').on(table.status, table.userId),
}))

/**
 * Type exports
 */
export type Character = typeof characters.$inferSelect
export type NewCharacter = typeof characters.$inferInsert

export type Conversation = typeof conversations.$inferSelect
export type NewConversation = typeof conversations.$inferInsert

export type VoiceSession = typeof voiceSessions.$inferSelect
export type NewVoiceSession = typeof voiceSessions.$inferInsert

/**
 * Personality Configuration Interface
 */
export interface PersonalityConfig {
  motivations: string[]
  flaws: string[]
  dialogueStyle: string
  adjectives: string[]
  voiceConfig?: {
    voiceId?: string // Inworld voice ID (e.g., 'Pixie', 'Stella', 'Atlas')
    pitch?: number
    speed?: number
    emotionRange?: 'low' | 'medium' | 'high'
  }
}

/**
 * Live2D Model Configuration Interface
 * Used for auto-scaling and positioning models to ensure consistent visual size
 */
export interface Live2DModelConfig {
  baseScale?: number // Model-specific scale multiplier (default: 1.0)
  offsetX?: number // Horizontal offset in percentage (default: 0)
  offsetY?: number // Vertical offset in percentage (default: 0)
}
