// Mock implementation of Anthropic for testing
class MockAnthropic {
  constructor(config) {
    this.apiKey = config?.apiKey || 'mock-api-key';
  }

  messages = {
    create: jest.fn().mockResolvedValue({
      id: 'test-anthropic-message',
      type: 'message',
      role: 'assistant',
      content: [{
        type: 'text',
        text: 'Test response from Anthropic'
      }],
      model: 'claude-3-haiku-20240307',
      stop_reason: 'end_turn',
      stop_sequence: null,
      usage: {
        input_tokens: 10,
        output_tokens: 10
      }
    })
  };
}

module.exports = MockAnthropic;
module.exports.default = MockAnthropic;