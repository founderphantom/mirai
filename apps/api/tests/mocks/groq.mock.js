// Mock implementation of Groq for testing
class MockGroq {
  constructor(config) {
    this.apiKey = config?.apiKey || 'mock-api-key';
  }

  chat = {
    completions: {
      create: jest.fn().mockResolvedValue({
        id: 'test-groq-completion',
        object: 'chat.completion',
        created: Date.now(),
        model: 'mixtral-8x7b-32768',
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: 'Test response from Groq'
          },
          finish_reason: 'stop'
        }],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 10,
          total_tokens: 20
        }
      })
    }
  };
}

module.exports = MockGroq;
module.exports.default = MockGroq;