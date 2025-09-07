// Mock implementation of OpenAI for testing
class MockOpenAI {
  constructor(config) {
    this.apiKey = config?.apiKey || 'mock-api-key';
  }

  moderations = {
    create: jest.fn().mockResolvedValue({
      id: 'test-moderation-id',
      model: 'text-moderation-latest',
      results: [{
        flagged: false,
        categories: {
          'hate': false,
          'hate/threatening': false,
          'harassment': false,
          'harassment/threatening': false,
          'self-harm': false,
          'self-harm/intent': false,
          'self-harm/instructions': false,
          'sexual': false,
          'sexual/minors': false,
          'violence': false,
          'violence/graphic': false
        },
        category_scores: {
          'hate': 0.001,
          'hate/threatening': 0.001,
          'harassment': 0.001,
          'harassment/threatening': 0.001,
          'self-harm': 0.001,
          'self-harm/intent': 0.001,
          'self-harm/instructions': 0.001,
          'sexual': 0.001,
          'sexual/minors': 0.001,
          'violence': 0.001,
          'violence/graphic': 0.001
        }
      }]
    })
  };

  // Add other OpenAI methods as needed
  chat = {
    completions: {
      create: jest.fn().mockResolvedValue({
        id: 'test-chat-completion',
        object: 'chat.completion',
        created: Date.now(),
        model: 'gpt-3.5-turbo',
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: 'Test response'
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

module.exports = MockOpenAI;
module.exports.default = MockOpenAI;