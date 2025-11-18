import { AudioChunkInterface } from '@inworld/runtime/common';

export enum EVENT_TYPE {
  TEXT = 'text',
  AUDIO = 'audio',
  AUDIO_SESSION_END = 'audioSessionEnd',
  NEW_INTERACTION = 'newInteraction',
}

export enum AUDIO_SESSION_STATE {
  PROCESSING = 'PROCESSING',
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

export interface ChatMessage {
  id: string;
  role: string;
  content: string;
}

export interface Agent {
  id: string;
  name: string;
  description: string;
  motivation: string;
  knowledge?: string[];
}

/**
 * Personality Configuration Interface (from database schema)
 * This is the new format used by the SaaS platform for character presets
 */
export interface PersonalityConfig {
  id?: string; // Generated at runtime in app.ts load() method
  motivations: string[];
  flaws: string[];
  dialogueStyle: string; // Contains the full system prompt with personality, emotes, etc.
  adjectives: string[];
  voiceConfig?: {
    voiceId?: string; // Inworld voice ID (e.g., 'Pixie', 'Stella', 'Atlas')
    pitch?: number;
    speed?: number;
    emotionRange?: 'low' | 'medium' | 'high';
  };
}

export interface TextInput {
  key: string;
  text: string;
  interactionId: string;
}

export interface AudioInput {
  key: string;
  audio: AudioChunkInterface;
  state: State;
  interactionId: string;
}

export interface State {
  agent: Agent | PersonalityConfig; // Support both legacy Agent and new PersonalityConfig
  userName: string;
  messages: ChatMessage[];
}

export interface Connection {
  state: State;
  ws: any;
}

export interface PromptInput {
  agent: Agent | PersonalityConfig; // Support both legacy Agent and new PersonalityConfig
  messages: ChatMessage[];
  userName: string;
  userQuery: string;
}

export interface CreateGraphPropsInterface {
  apiKey: string;
  llmModelName: string;
  llmProvider: string;
  voiceId: string;
  graphVisualizationEnabled: boolean;
  connections: {
    [key: string]: Connection;
  };
  withAudioInput?: boolean;
  ttsModelId: string;
}
