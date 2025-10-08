/**
 * Character API Service
 * Handles all character-related API calls to the API Gateway
 */

// Character interfaces
export interface PersonalityConfig {
  dialogueStyle: string
  adjectives: string[]
  tone: string
}

export interface Character {
  id: string
  displayName: string
  avatarThumbnail?: string
  live2dModelPath?: string
  personalityConfig: PersonalityConfig
  totalConversations: number
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
    const response = await fetch('/api/characters', {
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
    const response = await fetch(`/api/characters/${characterId}`, {
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
 * For MVP: Get hardcoded Hiyori character
 * This is a mock function until the backend character system is fully implemented
 */
export function getMVPCharacter(): Character {
  return {
    id: 'hiyori_pro_zh',
    displayName: 'Hiyori',
    avatarThumbnail: '/assets/live2d/models/hiyori_pro_zh/thumbnail.png',
    live2dModelPath: '/assets/live2d/models/hiyori_pro_zh.zip',
    personalityConfig: {
      dialogueStyle: 'Friendly and supportive',
      adjectives: ['Cheerful', 'Caring', 'Energetic'],
      tone: 'warm',
    },
    totalConversations: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

/**
 * For MVP: Get characters list (currently just Hiyori)
 * This is a mock function until the backend character system is fully implemented
 */
export function getMVPCharacters(): GetCharactersResponse {
  const hiyori = getMVPCharacter()
  return {
    characters: [hiyori],
    total: 1,
  }
}
