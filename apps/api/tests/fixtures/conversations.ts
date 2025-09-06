import { nanoid } from 'nanoid';

export interface TestConversation {
  id: string;
  user_id: string;
  title: string;
  summary: string | null;
  model_id: string;
  provider_id: string;
  avatar_id: string | null;
  voice_id: string | null;
  personality_template: string | null;
  system_prompt: string | null;
  temperature: number;
  max_tokens: number;
  settings: Record<string, any>;
  tags: string[];
  is_archived: boolean;
  is_starred: boolean;
  last_message_at: string;
  message_count: number;
  total_tokens_used: number;
  created_at: string;
  updated_at: string;
}

export interface TestMessage {
  id: string;
  conversation_id: string;
  user_id: string;
  role: 'user' | 'assistant' | 'system' | 'function' | 'tool';
  content: string;
  content_type: string;
  attachments: any[];
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  model_id: string | null;
  provider_id: string | null;
  response_time_ms: number | null;
  finish_reason: string | null;
  flagged_for_moderation: boolean;
  moderation_results: Record<string, any>;
  function_call: any | null;
  tool_calls: any[] | null;
  rating: number | null;
  feedback: string | null;
  metadata: Record<string, any>;
  created_at: string;
  edited_at: string | null;
  deleted_at: string | null;
}

export function createTestConversation(userId: string, overrides?: Partial<TestConversation>): TestConversation {
  return {
    id: 'conv_' + nanoid(10),
    user_id: userId,
    title: 'Test Conversation',
    summary: null,
    model_id: 'gpt-3.5-turbo',
    provider_id: 'openai',
    avatar_id: null,
    voice_id: null,
    personality_template: null,
    system_prompt: 'You are a helpful assistant.',
    temperature: 0.7,
    max_tokens: 2048,
    settings: {},
    tags: [],
    is_archived: false,
    is_starred: false,
    last_message_at: new Date().toISOString(),
    message_count: 0,
    total_tokens_used: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

export function createTestMessage(
  conversationId: string,
  userId: string,
  overrides?: Partial<TestMessage>
): TestMessage {
  return {
    id: 'msg_' + nanoid(10),
    conversation_id: conversationId,
    user_id: userId,
    role: 'user',
    content: 'Test message content',
    content_type: 'text',
    attachments: [],
    prompt_tokens: 10,
    completion_tokens: 20,
    total_tokens: 30,
    model_id: 'gpt-3.5-turbo',
    provider_id: 'openai',
    response_time_ms: 250,
    finish_reason: 'stop',
    flagged_for_moderation: false,
    moderation_results: {},
    function_call: null,
    tool_calls: null,
    rating: null,
    feedback: null,
    metadata: {},
    created_at: new Date().toISOString(),
    edited_at: null,
    deleted_at: null,
    ...overrides,
  };
}

export const sampleConversations = {
  basic: {
    title: 'General Chat',
    model_id: 'gpt-3.5-turbo',
    provider_id: 'openai',
    system_prompt: 'You are a helpful assistant.',
    temperature: 0.7,
    max_tokens: 2048,
  },
  creative: {
    title: 'Creative Writing',
    model_id: 'gpt-4',
    provider_id: 'openai',
    system_prompt: 'You are a creative writing assistant. Help the user with storytelling, poetry, and creative content.',
    temperature: 0.9,
    max_tokens: 4096,
  },
  technical: {
    title: 'Technical Support',
    model_id: 'claude-2',
    provider_id: 'anthropic',
    system_prompt: 'You are a technical support specialist. Provide clear, accurate technical assistance.',
    temperature: 0.3,
    max_tokens: 2048,
  },
  gaming: {
    title: 'Gaming Session',
    model_id: 'gpt-3.5-turbo',
    provider_id: 'openai',
    system_prompt: 'You are a gaming companion AI. Engage in gaming-related discussions and strategies.',
    temperature: 0.8,
    max_tokens: 1024,
    settings: {
      gameMode: 'minecraft',
      difficulty: 'normal',
    },
  },
};

export const sampleMessages = [
  {
    role: 'user' as const,
    content: 'Hello, how are you?',
    prompt_tokens: 5,
    completion_tokens: 0,
  },
  {
    role: 'assistant' as const,
    content: 'Hello! I\'m doing well, thank you for asking. How can I assist you today?',
    prompt_tokens: 5,
    completion_tokens: 15,
  },
  {
    role: 'user' as const,
    content: 'Can you help me write a Python function?',
    prompt_tokens: 8,
    completion_tokens: 0,
  },
  {
    role: 'assistant' as const,
    content: 'Of course! I\'d be happy to help you write a Python function. What kind of function do you need?',
    prompt_tokens: 8,
    completion_tokens: 20,
  },
];

export const longMessage = {
  role: 'user' as const,
  content: 'Lorem ipsum '.repeat(500), // Creates a very long message
  prompt_tokens: 1000,
  completion_tokens: 0,
};

export const messageWithAttachments = {
  role: 'user' as const,
  content: 'Here is an image for analysis',
  attachments: [
    {
      type: 'image',
      url: 'https://example.com/image.jpg',
      name: 'test-image.jpg',
      size: 1024000,
    },
  ],
  prompt_tokens: 10,
  completion_tokens: 0,
};

export const messageWithFunctionCall = {
  role: 'assistant' as const,
  content: 'I\'ll search for that information.',
  function_call: {
    name: 'search_web',
    arguments: '{"query": "latest AI news"}',
  },
  prompt_tokens: 15,
  completion_tokens: 25,
};

export const messageWithToolCalls = {
  role: 'assistant' as const,
  content: 'Let me check multiple sources.',
  tool_calls: [
    {
      id: 'tool_1',
      type: 'function',
      function: {
        name: 'search_web',
        arguments: '{"query": "AI news"}',
      },
    },
    {
      id: 'tool_2',
      type: 'function',
      function: {
        name: 'get_weather',
        arguments: '{"location": "New York"}',
      },
    },
  ],
  prompt_tokens: 20,
  completion_tokens: 30,
};