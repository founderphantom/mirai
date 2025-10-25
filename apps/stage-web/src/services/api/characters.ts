/**
 * Character API Service
 * Handles all character-related API calls to the API Gateway
 */

// Get API base URL from environment
const API_BASE_URL = import.meta.env.VITE_API_URL || window.location.origin

// Character interfaces

/**
 * PersonalityConfig for Inworld Runtime
 * Runtime creates characters on-the-fly from this configuration
 * during conversations, without needing pre-created characters
 */
export interface PersonalityConfig {
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

/**
 * Character entity
 * Stores configuration for Inworld Runtime characters
 * Characters are created on-the-fly during conversations using this config
 */
export interface Character {
  id: string
  displayName: string
  description?: string
  avatarThumbnail?: string
  live2dModelKey?: string
  live2dModelPath?: string
  personalityConfig: PersonalityConfig
  totalConversations: number
  isPreset?: boolean
  createdAt: string
  updatedAt: string
}

export interface GetCharactersResponse {
  characters: Character[]
  total: number
}

/**
 * Get all characters for the authenticated user
 */
export async function getCharacters(): Promise<GetCharactersResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/characters`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include', // Include cookies for authentication
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch characters: ${response.statusText}`)
    }

    return await response.json()
  }
  catch (error) {
    console.error('Error fetching characters:', error)
    throw error
  }
}

/**
 * Get a specific character by ID
 */
export async function getCharacter(characterId: string): Promise<Character> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/characters/${characterId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch character: ${response.statusText}`)
    }

    return await response.json()
  }
  catch (error) {
    console.error('Error fetching character:', error)
    throw error
  }
}

/**
 * Get all preset characters (available to all users)
 * These are fetched from the database where they're seeded via Runtime approach
 */
export async function getPresetCharacters(): Promise<GetCharactersResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/characters/presets`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch preset characters: ${response.statusText}`)
    }

    const data = await response.json() as GetCharactersResponse
    return {
      characters: data.characters || [],
      total: data.characters?.length || 0,
    }
  }
  catch (error) {
    console.error('Error fetching preset characters:', error)
    throw error
  }
}

/**
 * Get all characters (preset + user's own characters)
 */
export async function getAllCharacters(): Promise<GetCharactersResponse> {
  try {
    // Fetch both preset and user characters in parallel
    const [presetsResponse, userCharactersResponse] = await Promise.all([
      getPresetCharacters(),
      getCharacters().catch(() => ({ characters: [], total: 0 })), // Fallback if user not authenticated
    ])

    // Combine and return
    const allCharacters = [
      ...presetsResponse.characters,
      ...userCharactersResponse.characters,
    ]

    return {
      characters: allCharacters,
      total: allCharacters.length,
    }
  }
  catch (error) {
    console.error('Error fetching all characters:', error)
    throw error
  }
}
