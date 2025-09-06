import { jest } from '@jest/globals';

// Create a chainable mock object for database queries
export function createChainableMock(defaultData: any = null, defaultError: any = null) {
  const chainable: any = {
    select: jest.fn().mockImplementation(() => chainable),
    insert: jest.fn().mockImplementation(() => chainable),
    update: jest.fn().mockImplementation(() => chainable),
    delete: jest.fn().mockImplementation(() => chainable),
    upsert: jest.fn().mockImplementation(() => chainable),
    eq: jest.fn().mockImplementation(() => chainable),
    neq: jest.fn().mockImplementation(() => chainable),
    gt: jest.fn().mockImplementation(() => chainable),
    gte: jest.fn().mockImplementation(() => chainable),
    lt: jest.fn().mockImplementation(() => chainable),
    lte: jest.fn().mockImplementation(() => chainable),
    like: jest.fn().mockImplementation(() => chainable),
    ilike: jest.fn().mockImplementation(() => chainable),
    is: jest.fn().mockImplementation(() => chainable),
    in: jest.fn().mockImplementation(() => chainable),
    contains: jest.fn().mockImplementation(() => chainable),
    containedBy: jest.fn().mockImplementation(() => chainable),
    order: jest.fn().mockImplementation(() => chainable),
    limit: jest.fn().mockImplementation(() => chainable),
    range: jest.fn().mockImplementation(() => chainable),
    single: jest.fn().mockImplementation(() => 
      Promise.resolve({ data: defaultData, error: defaultError })
    ),
    maybeSingle: jest.fn().mockImplementation(() => 
      Promise.resolve({ data: defaultData, error: defaultError })
    ),
    count: jest.fn().mockImplementation(() => 
      Promise.resolve({ count: 0, error: defaultError })
    ),
    // Make the chainable object itself resolve as a promise
    then: (resolve: Function) => {
      return Promise.resolve({ data: defaultData, error: defaultError }).then(resolve);
    },
  };
  
  return chainable;
}

export class MockSupabaseClient {
  auth = {
    signUp: jest.fn().mockImplementation(() => 
      Promise.resolve({ data: null, error: null })
    ),
    signInWithPassword: jest.fn().mockImplementation(() => 
      Promise.resolve({ data: null, error: null })
    ),
    signOut: jest.fn().mockImplementation(() => 
      Promise.resolve({ error: null })
    ),
    resetPasswordForEmail: jest.fn().mockImplementation(() => 
      Promise.resolve({ data: null, error: null })
    ),
    getSession: jest.fn().mockImplementation(() => 
      Promise.resolve({ data: null, error: null })
    ),
    refreshSession: jest.fn().mockImplementation(() => 
      Promise.resolve({ data: null, error: null })
    ),
    updateUser: jest.fn().mockImplementation(() => 
      Promise.resolve({ data: null, error: null })
    ),
    getUser: jest.fn().mockImplementation(() => 
      Promise.resolve({ data: null, error: null })
    ),
    admin: {
      createUser: jest.fn().mockImplementation(() => 
        Promise.resolve({ data: mockAuthUser, error: null })
      ),
      deleteUser: jest.fn().mockImplementation(() => 
        Promise.resolve({ data: null, error: null })
      ),
      getUserById: jest.fn().mockImplementation(() => 
        Promise.resolve({ data: mockAuthUser, error: null })
      ),
      updateUserById: jest.fn().mockImplementation(() => 
        Promise.resolve({ data: mockAuthUser, error: null })
      ),
      signOut: jest.fn().mockImplementation(() => 
        Promise.resolve({ error: null })
      ),
    },
  };

  from = jest.fn().mockImplementation((table: string) => {
    // Return a new chainable mock for each from() call
    return createChainableMock();
  });

  rpc = jest.fn().mockImplementation((functionName: string, params?: any) => 
    Promise.resolve({ data: null, error: null })
  );

  channel = jest.fn().mockImplementation((name: string) => ({
    on: jest.fn().mockReturnThis(),
    subscribe: jest.fn().mockImplementation(() => 
      Promise.resolve({
        status: 'SUBSCRIBED',
        error: null,
      })
    ),
    unsubscribe: jest.fn().mockImplementation(() => 
      Promise.resolve({
        status: 'UNSUBSCRIBED',
        error: null,
      })
    ),
  }));

  removeChannel = jest.fn().mockImplementation(() => 
    Promise.resolve({ error: null })
  );

  storage = {
    from: jest.fn().mockImplementation((bucket: string) => ({
      upload: jest.fn().mockImplementation(() => 
        Promise.resolve({ data: { path: 'test/path' }, error: null })
      ),
      download: jest.fn().mockImplementation(() => 
        Promise.resolve({ data: new Blob(), error: null })
      ),
      remove: jest.fn().mockImplementation(() => 
        Promise.resolve({ data: null, error: null })
      ),
      getPublicUrl: jest.fn().mockReturnValue({
        data: { publicUrl: 'https://storage.example.com/test/path' },
      }),
      list: jest.fn().mockImplementation(() => 
        Promise.resolve({ data: [], error: null })
      ),
    })),
  };
}

export function createMockSupabaseClient(overrides?: Partial<MockSupabaseClient>) {
  const client = new MockSupabaseClient();
  
  if (overrides) {
    Object.assign(client, overrides);
  }
  
  return client;
}

export function mockSupabaseResponse<T>(data: T | null, error: any = null) {
  return { data, error };
}

export function mockSupabaseError(message: string, code?: string) {
  return {
    data: null,
    error: {
      message,
      code: code || 'MOCK_ERROR',
    },
  };
}

export const mockAuthUser = {
  id: 'mock-user-id',
  email: 'test@example.com',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  user_metadata: {},
  app_metadata: {},
  aud: 'authenticated',
  role: 'authenticated',
};

export const mockUserProfile = {
  id: 'mock-user-id',
  email: 'test@example.com',
  full_name: 'Test User',
  avatar_url: null,
  subscription_tier: 'free',
  subscription_status: 'active',
  stripe_customer_id: null,
  daily_message_count: 0,
  total_message_count: 0,
  last_message_at: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

export const mockConversation = {
  id: 'mock-conversation-id',
  user_id: 'mock-user-id',
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
};

export const mockMessage = {
  id: 'mock-message-id',
  conversation_id: 'mock-conversation-id',
  user_id: 'mock-user-id',
  role: 'user',
  content: 'Test message',
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
};