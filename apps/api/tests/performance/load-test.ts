import {
  measurePerformance,
  runConcurrent,
  runSequential,
} from '@tests/helpers/test-helpers';
import { authService } from '@/services/auth.service';
import { conversationService } from '@/services/conversation.service';
import { supabaseAdmin, dbHelpers } from '@/lib/supabase';
import { createTestUser } from '@tests/fixtures/users';
import { createTestConversation, createTestMessage } from '@tests/fixtures/conversations';

// Mock external dependencies for performance testing
jest.mock('@/lib/supabase');
jest.mock('@/lib/redis');
jest.mock('@/lib/stripe');

describe('Performance Tests', () => {
  beforeAll(() => {
    // Setup mock responses for performance testing
    setupMockResponses();
  });

  describe('Authentication Performance', () => {
    it('should handle concurrent login requests efficiently', async () => {
      const concurrentUsers = 100;
      
      const { duration } = await measurePerformance(
        async () => {
          return runConcurrent(
            async () => {
              const user = createTestUser();
              return authService.signIn(user.email, user.password);
            },
            concurrentUsers
          );
        },
        `${concurrentUsers} concurrent logins`
      );
      
      // Should complete 100 concurrent logins in under 5 seconds
      expect(duration).toBeLessThan(5000);
    });

    it('should maintain performance with token validation', async () => {
      const iterations = 1000;
      const tokens: string[] = [];
      
      // Generate tokens
      for (let i = 0; i < 10; i++) {
        const user = createTestUser();
        tokens.push(generateMockToken(user));
      }
      
      const { duration } = await measurePerformance(
        async () => {
          for (let i = 0; i < iterations; i++) {
            const token = tokens[i % tokens.length];
            await validateMockToken(token);
          }
        },
        `${iterations} token validations`
      );
      
      // Should validate 1000 tokens in under 2 seconds
      expect(duration).toBeLessThan(2000);
      
      // Calculate average time per validation
      const avgTime = duration / iterations;
      expect(avgTime).toBeLessThan(2); // Less than 2ms per validation
    });

    it('should handle rate limiting efficiently', async () => {
      const requests = 500;
      const rateLimitWindow = 60000; // 1 minute
      const maxRequestsPerWindow = 100;
      
      const mockRateLimiter = createMockRateLimiter(maxRequestsPerWindow, rateLimitWindow);
      
      const { duration } = await measurePerformance(
        async () => {
          const results = [];
          for (let i = 0; i < requests; i++) {
            results.push(await mockRateLimiter.check('test-user'));
          }
          return results;
        },
        `${requests} rate limit checks`
      );
      
      // Should process 500 rate limit checks in under 1 second
      expect(duration).toBeLessThan(1000);
    });
  });

  describe('Database Query Performance', () => {
    it('should fetch user profiles efficiently', async () => {
      const userIds = Array(100).fill(null).map(() => `user_${Math.random()}`);
      
      const { duration } = await measurePerformance(
        async () => {
          return Promise.all(
            userIds.map(id => dbHelpers.getUserProfile(id))
          );
        },
        '100 user profile fetches'
      );
      
      // Should fetch 100 profiles in under 3 seconds
      expect(duration).toBeLessThan(3000);
    });

    it('should handle conversation queries efficiently', async () => {
      const userId = 'test-user-id';
      
      const { duration } = await measurePerformance(
        async () => {
          return dbHelpers.getConversationsWithLastMessage(userId, 50, 0);
        },
        'Fetch 50 conversations with last message'
      );
      
      // Should fetch in under 500ms
      expect(duration).toBeLessThan(500);
    });

    it('should handle message pagination efficiently', async () => {
      const conversationId = 'test-conversation-id';
      const userId = 'test-user-id';
      
      const { duration } = await measurePerformance(
        async () => {
          const pages = [];
          let beforeId: string | undefined;
          
          for (let i = 0; i < 10; i++) {
            const messages = await dbHelpers.getConversationMessagesRPC(
              conversationId,
              userId,
              50,
              beforeId
            );
            pages.push(messages);
            
            if (messages.length > 0) {
              beforeId = messages[messages.length - 1].id;
            } else {
              break;
            }
          }
          
          return pages;
        },
        'Paginate through 10 pages of messages'
      );
      
      // Should paginate through 10 pages in under 2 seconds
      expect(duration).toBeLessThan(2000);
    });

    it('should handle search operations efficiently', async () => {
      const userId = 'test-user-id';
      const searchQueries = [
        'machine learning',
        'how to code',
        'python tutorial',
        'javascript async',
        'database optimization',
      ];
      
      const { duration } = await measurePerformance(
        async () => {
          return Promise.all(
            searchQueries.map(query => 
              dbHelpers.searchMessages(userId, query, 20, 0)
            )
          );
        },
        '5 concurrent search queries'
      );
      
      // Should complete 5 searches in under 3 seconds
      expect(duration).toBeLessThan(3000);
    });
  });

  describe('Message Processing Performance', () => {
    it('should handle message creation with token counting', async () => {
      const conversationId = 'test-conversation-id';
      const userId = 'test-user-id';
      const messages = 100;
      
      const { duration } = await measurePerformance(
        async () => {
          const results = [];
          for (let i = 0; i < messages; i++) {
            const message = createTestMessage(conversationId, userId, {
              content: `Test message ${i} with some content to count tokens`,
              prompt_tokens: Math.floor(Math.random() * 100),
              completion_tokens: Math.floor(Math.random() * 200),
            });
            
            results.push(
              await dbHelpers.addMessage(
                conversationId,
                message.role as any,
                message.content,
                userId,
                {
                  promptTokens: message.prompt_tokens,
                  completionTokens: message.completion_tokens,
                  totalTokens: message.total_tokens,
                }
              )
            );
          }
          return results;
        },
        `Create ${messages} messages with token counting`
      );
      
      // Should create 100 messages in under 5 seconds
      expect(duration).toBeLessThan(5000);
      
      // Calculate average time per message
      const avgTime = duration / messages;
      expect(avgTime).toBeLessThan(50); // Less than 50ms per message
    });

    it('should update usage metrics efficiently', async () => {
      const userId = 'test-user-id';
      const updates = 200;
      
      const { duration } = await measurePerformance(
        async () => {
          const results = [];
          for (let i = 0; i < updates; i++) {
            results.push(
              await dbHelpers.updateUsageMetrics(
                userId,
                Math.floor(Math.random() * 100),
                Math.floor(Math.random() * 200),
                'gpt-3.5-turbo',
                'openai',
                '/api/chat',
                {
                  responseTimeMs: Math.floor(Math.random() * 1000),
                  statusCode: 200,
                }
              )
            );
          }
          return results;
        },
        `Update usage metrics ${updates} times`
      );
      
      // Should update 200 usage metrics in under 3 seconds
      expect(duration).toBeLessThan(3000);
    });
  });

  describe('Concurrent User Simulation', () => {
    it('should handle realistic user load', async () => {
      const concurrentUsers = 50;
      const actionsPerUser = 10;
      
      const { duration } = await measurePerformance(
        async () => {
          return runConcurrent(
            async () => {
              const user = createTestUser();
              const userId = user.id;
              
              // Simulate user session
              const actions = [];
              
              // 1. Login
              actions.push(await authService.signIn(user.email, user.password));
              
              // 2. Create conversation
              const conversation = await dbHelpers.createConversation(
                userId,
                'Test Conversation',
                'gpt-3.5-turbo'
              );
              
              // 3. Send messages
              for (let i = 0; i < actionsPerUser; i++) {
                await dbHelpers.addMessage(
                  conversation.id,
                  i % 2 === 0 ? 'user' : 'assistant',
                  `Message ${i}`,
                  userId,
                  {
                    promptTokens: 10,
                    completionTokens: 20,
                  }
                );
              }
              
              // 4. Get conversation list
              actions.push(
                await dbHelpers.getConversationsWithLastMessage(userId)
              );
              
              // 5. Search messages
              actions.push(
                await dbHelpers.searchMessages(userId, 'test', 10, 0)
              );
              
              return actions;
            },
            concurrentUsers
          );
        },
        `${concurrentUsers} concurrent users with ${actionsPerUser} actions each`
      );
      
      // Should handle 50 concurrent users in under 30 seconds
      expect(duration).toBeLessThan(30000);
      
      // Calculate throughput
      const totalActions = concurrentUsers * (actionsPerUser + 4); // messages + other actions
      const throughput = totalActions / (duration / 1000); // actions per second
      
      console.log(`Throughput: ${throughput.toFixed(2)} actions/second`);
      expect(throughput).toBeGreaterThan(10); // At least 10 actions per second
    });
  });

  describe('Memory and Resource Usage', () => {
    it('should not leak memory during extended operations', async () => {
      const iterations = 1000;
      const memorySnapshots: number[] = [];
      
      // Take initial memory snapshot
      if (global.gc) global.gc();
      const initialMemory = process.memoryUsage().heapUsed;
      
      for (let i = 0; i < iterations; i++) {
        // Perform operations
        const user = createTestUser();
        const conversation = createTestConversation(user.id);
        const message = createTestMessage(conversation.id, user.id);
        
        // Simulate processing
        await processMessage(message);
        
        // Take memory snapshot every 100 iterations
        if (i % 100 === 0) {
          if (global.gc) global.gc();
          memorySnapshots.push(process.memoryUsage().heapUsed);
        }
      }
      
      // Final memory snapshot
      if (global.gc) global.gc();
      const finalMemory = process.memoryUsage().heapUsed;
      
      // Memory growth should be minimal (less than 50MB)
      const memoryGrowth = (finalMemory - initialMemory) / 1024 / 1024;
      expect(memoryGrowth).toBeLessThan(50);
      
      // Check for steady memory growth pattern (potential leak)
      const avgGrowthRate = calculateAverageGrowthRate(memorySnapshots);
      expect(avgGrowthRate).toBeLessThan(0.1); // Less than 0.1MB per 100 iterations
    });
  });
});

// Helper functions for performance tests
function setupMockResponses() {
  (supabaseAdmin.from as jest.Mock).mockImplementation((table: string) => ({
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: {}, error: null }),
    limit: jest.fn().mockReturnThis(),
    order: jest.fn().mockResolvedValue({ data: [], error: null }),
  }));
  
  (supabaseAdmin.auth.signInWithPassword as jest.Mock).mockResolvedValue({
    data: { user: { id: 'user-id' } },
    error: null,
  });
  
  (supabaseAdmin.rpc as jest.Mock).mockResolvedValue({
    data: [],
    error: null,
  });
}

function generateMockToken(user: any): string {
  return `mock-token-${user.id}`;
}

async function validateMockToken(token: string): Promise<boolean> {
  // Simulate token validation delay
  await new Promise(resolve => setImmediate(resolve));
  return token.startsWith('mock-token-');
}

function createMockRateLimiter(limit: number, window: number) {
  const requests = new Map<string, number[]>();
  
  return {
    async check(key: string): Promise<boolean> {
      const now = Date.now();
      const userRequests = requests.get(key) || [];
      
      // Remove old requests outside window
      const validRequests = userRequests.filter(time => now - time < window);
      
      if (validRequests.length >= limit) {
        return false;
      }
      
      validRequests.push(now);
      requests.set(key, validRequests);
      return true;
    },
  };
}

async function processMessage(message: any): Promise<void> {
  // Simulate message processing
  await new Promise(resolve => setImmediate(resolve));
}

function calculateAverageGrowthRate(snapshots: number[]): number {
  if (snapshots.length < 2) return 0;
  
  let totalGrowth = 0;
  for (let i = 1; i < snapshots.length; i++) {
    totalGrowth += (snapshots[i] - snapshots[i - 1]) / 1024 / 1024;
  }
  
  return totalGrowth / (snapshots.length - 1);
}