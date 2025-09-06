/**
 * Test to verify nanoid mock is working correctly
 */

describe('nanoid mock', () => {
  // Clear all mocks
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should be able to import and use nanoid mock', () => {
    const { nanoid } = require('nanoid');
    
    // Test that nanoid function exists
    expect(nanoid).toBeDefined();
    expect(typeof nanoid).toBe('function');
    
    // Test that it returns a string
    const id1 = nanoid();
    expect(typeof id1).toBe('string');
    expect(id1.length).toBe(21); // Default size
    
    // Test that it generates different IDs
    const id2 = nanoid();
    expect(id2).not.toBe(id1);
    
    // Test custom size
    const id3 = nanoid(10);
    expect(id3.length).toBe(10);
  });

  it('should generate deterministic IDs for testing', () => {
    const { nanoid, resetCounter } = require('../../mocks/nanoid.mock');
    
    // Reset counter
    resetCounter();
    
    // Should generate predictable IDs
    const id1 = nanoid();
    expect(id1).toContain('test-id-1');
    
    const id2 = nanoid();
    expect(id2).toContain('test-id-2');
    
    // Reset again
    resetCounter();
    
    // Should start from 1 again
    const id3 = nanoid();
    expect(id3).toContain('test-id-1');
  });

  it('should work with customAlphabet', () => {
    const { customAlphabet } = require('../../mocks/nanoid.mock');
    
    const customNanoid = customAlphabet('ABC', 5);
    expect(customNanoid).toBeDefined();
    expect(typeof customNanoid).toBe('function');
    
    const id = customNanoid();
    expect(typeof id).toBe('string');
    expect(id.length).toBe(5);
  });
});