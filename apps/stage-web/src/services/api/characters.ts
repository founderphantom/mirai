/**
 * Characters API Service
 *
 * Handles all character-related API requests
 */

import { authClient } from '@/lib/auth'

/**
 * Character type matching database schema
 */
export interface Character {
  id: string
  userId: string
  inworldCharacterId: string
  displayName: string
  live2dModelKey?: string
  avatarThumbnail?: string
  personalityConfig: {
    motivations: string[]
    flaws: string[]
    dialogueStyle: string
    adjectives: string[]
    voiceConfig?: {
      pitch?: number
      speed?: number
      emotionRange?: 'low' | 'medium' | 'high'
    }
  }
  isPublic: boolean
  totalConversations: number
  createdAt: string
  updatedAt: string
}

export interface CharactersResponse {
  characters: Character[]
}

export interface CreateCharacterRequest {
  displayName: string
  personalityConfig: {
    motivations: string[]
    flaws: string[]
    dialogueStyle: string
    adjectives: string[]
    voiceConfig?: {
      pitch?: number
      speed?: number
      emotionRange?: 'low' | 'medium' | 'high'
    }
  }
  live2dModelKey?: string
}

/**
 * Get all characters for the current user
 */
export async function getCharacters(): Promise<CharactersResponse> {
  const session = await authClient.getSession()
  if (!session) {
    throw new Error('Not authenticated')
  }

  const response = await fetch('/api/characters', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({
      message: 'Failed to fetch characters',
    })) as { message?: string }
    throw new Error(error.message || 'Failed to fetch characters')
  }

  return response.json()
}

/**
 * Get a single character by ID
 */
export async function getCharacter(characterId: string): Promise<Character> {
  const session = await authClient.getSession()
  if (!session) {
    throw new Error('Not authenticated')
  }

  const response = await fetch(`/api/characters/${characterId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
  })

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Character not found')
    }
    const error = await response.json().catch(() => ({
      message: 'Failed to fetch character',
    })) as { message?: string }
    throw new Error(error.message || 'Failed to fetch character')
  }

  return response.json()
}

/**
 * Create a new character
 */
export async function createCharacter(
  data: CreateCharacterRequest
): Promise<Character> {
  const session = await authClient.getSession()
  if (!session) {
    throw new Error('Not authenticated')
  }

  const response = await fetch('/api/characters', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(data),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({
      message: 'Failed to create character',
    })) as { message?: string }
    throw new Error(error.message || 'Failed to create character')
  }

  return response.json()
}

/**
 * Update an existing character
 */
export async function updateCharacter(
  characterId: string,
  data: Partial<CreateCharacterRequest>
): Promise<Character> {
  const session = await authClient.getSession()
  if (!session) {
    throw new Error('Not authenticated')
  }

  const response = await fetch(`/api/characters/${characterId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(data),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({
      message: 'Failed to update character',
    })) as { message?: string }
    throw new Error(error.message || 'Failed to update character')
  }

  return response.json()
}

/**
 * Delete a character
 */
export async function deleteCharacter(characterId: string): Promise<void> {
  const session = await authClient.getSession()
  if (!session) {
    throw new Error('Not authenticated')
  }

  const response = await fetch(`/api/characters/${characterId}`, {
    method: 'DELETE',
    credentials: 'include',
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({
      message: 'Failed to delete character',
    })) as { message?: string }
    throw new Error(error.message || 'Failed to delete character')
  }
}
