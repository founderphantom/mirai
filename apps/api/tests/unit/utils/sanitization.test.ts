/**
 * Sanitization Utilities Tests
 */

import {
  sanitizeHtml,
  sanitizeText,
  sanitizeMarkdown,
  sanitizeEmail,
  sanitizeUrl,
  sanitizeJson,
  sanitizeSqlIdentifier,
  sanitizeFilename,
  sanitizeNumber,
  sanitizeFields,
} from '@/utils/sanitization';

// Mock the logger
jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('Sanitization Utilities', () => {
  describe('sanitizeHtml', () => {
    it('should remove script tags in strict mode', () => {
      const input = 'Hello <script>alert("XSS")</script> World';
      const result = sanitizeHtml(input, 'strict');
      expect(result).toBe('Hello  World');
    });

    it('should remove all HTML tags in strict mode', () => {
      const input = '<h1>Title</h1><p>Paragraph</p><div>Content</div>';
      const result = sanitizeHtml(input, 'strict');
      expect(result).toBe('TitleParagraphContent');
    });

    it('should allow basic formatting tags in basic mode', () => {
      const input = '<b>Bold</b> <i>Italic</i> <script>alert("XSS")</script>';
      const result = sanitizeHtml(input, 'basic');
      expect(result).toBe('<b>Bold</b> <i>Italic</i>');
    });

    it('should allow markdown-compatible tags in markdown mode', () => {
      const input = '<h1>Title</h1><p>Paragraph with <a href="https://example.com">link</a></p>';
      const result = sanitizeHtml(input, 'markdown');
      expect(result).toBe('<h1>Title</h1><p>Paragraph with <a href="https://example.com">link</a></p>');
    });

    it('should remove dangerous attributes', () => {
      const input = '<div onclick="alert(\'XSS\')" onmouseover="alert(\'XSS\')">Content</div>';
      const result = sanitizeHtml(input, 'basic');
      expect(result).toBe('Content');
    });

    it('should handle null and undefined inputs', () => {
      expect(sanitizeHtml(null)).toBe(null);
      expect(sanitizeHtml(undefined)).toBe(null);
      expect(sanitizeHtml('')).toBe('');
    });

    it('should remove javascript: URLs in markdown mode', () => {
      const input = '<a href="javascript:alert(\'XSS\')">Click me</a>';
      const result = sanitizeHtml(input, 'markdown');
      expect(result).not.toContain('javascript:');
    });

    it('should remove data: URLs with HTML content', () => {
      const input = '<a href="data:text/html,<script>alert(\'XSS\')</script>">Click</a>';
      const result = sanitizeHtml(input, 'markdown');
      expect(result).not.toContain('data:text/html');
    });
  });

  describe('sanitizeText', () => {
    it('should remove all HTML content', () => {
      const input = '<h1>Title</h1><script>alert("XSS")</script><p>Text</p>';
      const result = sanitizeText(input);
      expect(result).toBe('TitleText');
    });

    it('should handle special characters', () => {
      const input = 'Hello & <World> "Test" \'Quote\'';
      const result = sanitizeText(input);
      expect(result).toBe('Hello &amp;  "Test" \'Quote\'');
    });
  });

  describe('sanitizeMarkdown', () => {
    it('should preserve markdown-compatible HTML', () => {
      const input = '# Title\n\n**Bold** *Italic* [Link](https://example.com)';
      const result = sanitizeMarkdown(input);
      expect(result).toBe('# Title\n\n**Bold** *Italic* [Link](https://example.com)');
    });

    it('should allow code blocks', () => {
      const input = '<pre><code>const x = 5;</code></pre>';
      const result = sanitizeMarkdown(input);
      expect(result).toBe('<pre><code>const x = 5;</code></pre>');
    });

    it('should remove script tags from markdown', () => {
      const input = '# Title <script>alert("XSS")</script>';
      const result = sanitizeMarkdown(input);
      expect(result).toBe('# Title');
    });
  });

  describe('sanitizeEmail', () => {
    it('should sanitize and validate email addresses', () => {
      expect(sanitizeEmail('user@example.com')).toBe('user@example.com');
      expect(sanitizeEmail('USER@EXAMPLE.COM')).toBe('user@example.com');
      expect(sanitizeEmail('  user@example.com  ')).toBe('user@example.com');
    });

    it('should reject invalid email formats', () => {
      expect(sanitizeEmail('notanemail')).toBe(null);
      expect(sanitizeEmail('user@')).toBe(null);
      expect(sanitizeEmail('@example.com')).toBe(null);
      expect(sanitizeEmail('user@.com')).toBe(null);
    });

    it('should remove HTML from email addresses', () => {
      const input = '<script>alert("XSS")</script>user@example.com';
      const result = sanitizeEmail(input);
      expect(result).toBe('user@example.com');
    });

    it('should handle null and undefined', () => {
      expect(sanitizeEmail(null)).toBe(null);
      expect(sanitizeEmail(undefined)).toBe(null);
      expect(sanitizeEmail('')).toBe(null);
    });
  });

  describe('sanitizeUrl', () => {
    it('should allow safe URLs', () => {
      expect(sanitizeUrl('https://example.com')).toBe('https://example.com');
      expect(sanitizeUrl('http://example.com/path?query=value')).toBe('http://example.com/path?query=value');
      expect(sanitizeUrl('/relative/path')).toBe('/relative/path');
    });

    it('should block javascript: URLs', () => {
      expect(sanitizeUrl('javascript:alert("XSS")')).toBe(null);
      expect(sanitizeUrl('JAVASCRIPT:alert("XSS")')).toBe(null);
      expect(sanitizeUrl('   javascript:alert("XSS")   ')).toBe(null);
    });

    it('should block data: URLs', () => {
      expect(sanitizeUrl('data:text/html,<script>alert("XSS")</script>')).toBe(null);
      expect(sanitizeUrl('DATA:text/html,content')).toBe(null);
    });

    it('should block vbscript: URLs', () => {
      expect(sanitizeUrl('vbscript:alert("XSS")')).toBe(null);
    });

    it('should block file: URLs', () => {
      expect(sanitizeUrl('file:///etc/passwd')).toBe(null);
    });

    it('should detect encoded dangerous protocols', () => {
      expect(sanitizeUrl('%6A%61%76%61%73%63%72%69%70%74%3A%61%6C%65%72%74%28%31%29')).toBe(null);
    });

    it('should handle null and undefined', () => {
      expect(sanitizeUrl(null)).toBe(null);
      expect(sanitizeUrl(undefined)).toBe(null);
      expect(sanitizeUrl('')).toBe(null);
    });
  });

  describe('sanitizeJson', () => {
    it('should sanitize string values in objects', () => {
      const input = {
        name: '<script>alert("XSS")</script>John',
        description: 'Normal text',
      };
      const result = sanitizeJson(input);
      expect(result.name).toBe('John');
      expect(result.description).toBe('Normal text');
    });

    it('should sanitize nested objects', () => {
      const input = {
        user: {
          name: '<b>John</b>',
          profile: {
            bio: '<script>alert("XSS")</script>Developer',
          },
        },
      };
      const result = sanitizeJson(input);
      expect(result.user.name).toBe('John');
      expect(result.user.profile.bio).toBe('Developer');
    });

    it('should sanitize arrays', () => {
      const input = [
        '<script>alert(1)</script>Item 1',
        'Item 2',
        '<img src=x onerror=alert(3)>',
      ];
      const result = sanitizeJson(input);
      expect(result[0]).toBe('Item 1');
      expect(result[1]).toBe('Item 2');
      expect(result[2]).toBe('');
    });

    it('should preserve non-string values', () => {
      const input = {
        string: 'text',
        number: 123,
        boolean: true,
        null: null,
        undefined: undefined,
      };
      const result = sanitizeJson(input);
      expect(result.number).toBe(123);
      expect(result.boolean).toBe(true);
      expect(result.null).toBe(null);
      expect(result.undefined).toBe(undefined);
    });

    it('should sanitize object keys', () => {
      const input = {
        '<script>key</script>': 'value',  // This will be removed entirely (script content is removed)
        'normal_key': 'value',
        '<b>bold_key</b>': 'value2',  // This will become 'bold_key'
      };
      const result = sanitizeJson(input);
      // Script key should be removed entirely for security
      expect(result['key']).toBeUndefined();
      expect(result['<script>key</script>']).toBeUndefined();
      // Normal key should remain
      expect(result['normal_key']).toBe('value');
      // Bold tag content should be preserved as key
      expect(result['bold_key']).toBe('value2');
    });
  });

  describe('sanitizeSqlIdentifier', () => {
    it('should allow valid SQL identifiers', () => {
      expect(sanitizeSqlIdentifier('table_name')).toBe('table_name');
      expect(sanitizeSqlIdentifier('column123')).toBe('column123');
      expect(sanitizeSqlIdentifier('_private')).toBe('_private');
    });

    it('should remove invalid characters', () => {
      expect(sanitizeSqlIdentifier('table-name')).toBe('tablename');
      expect(sanitizeSqlIdentifier('column.name')).toBe('columnname');
      expect(sanitizeSqlIdentifier('table name')).toBe('tablename');
    });

    it('should reject identifiers starting with numbers', () => {
      expect(sanitizeSqlIdentifier('123table')).toBe(null);
      expect(sanitizeSqlIdentifier('9column')).toBe(null);
    });

    it('should reject overly long identifiers', () => {
      const longName = 'a'.repeat(100);
      expect(sanitizeSqlIdentifier(longName)).toBe(null);
    });

    it('should handle null and undefined', () => {
      expect(sanitizeSqlIdentifier(null)).toBe(null);
      expect(sanitizeSqlIdentifier(undefined)).toBe(null);
      expect(sanitizeSqlIdentifier('')).toBe(null);
    });
  });

  describe('sanitizeFilename', () => {
    it('should allow valid filenames', () => {
      expect(sanitizeFilename('document.pdf')).toBe('document.pdf');
      expect(sanitizeFilename('image-001.jpg')).toBe('image-001.jpg');
      expect(sanitizeFilename('file_name.txt')).toBe('file_name.txt');
    });

    it('should remove path traversal attempts', () => {
      expect(sanitizeFilename('../../../etc/passwd')).toBe('passwd');
      expect(sanitizeFilename('..\\..\\windows\\system32\\config')).toBe('config');
      expect(sanitizeFilename('/etc/passwd')).toBe('passwd');
    });

    it('should remove dangerous characters', () => {
      expect(sanitizeFilename('file<script>.txt')).toBe('file_script_.txt');
      expect(sanitizeFilename('file|name.txt')).toBe('file_name.txt');
      expect(sanitizeFilename('file:name.txt')).toBe('file_name.txt');
    });

    it('should handle multiple dots', () => {
      expect(sanitizeFilename('file...txt')).toBe('file_txt');
      expect(sanitizeFilename('...hidden')).toBe('_hidden');
    });

    it('should limit filename length', () => {
      const longName = 'a'.repeat(300) + '.txt';
      const result = sanitizeFilename(longName);
      expect(result).toBeDefined();
      expect(result!.length).toBeLessThanOrEqual(255);
      expect(result?.endsWith('.txt')).toBe(true);
    });

    it('should reject invalid filenames', () => {
      expect(sanitizeFilename('.')).toBe(null);
      expect(sanitizeFilename('..')).toBe(null);
      expect(sanitizeFilename('')).toBe(null);
    });
  });

  describe('sanitizeNumber', () => {
    it('should return valid numbers within bounds', () => {
      expect(sanitizeNumber(42)).toBe(42);
      expect(sanitizeNumber('42')).toBe(42);
      expect(sanitizeNumber(3.14)).toBe(3.14);
      expect(sanitizeNumber(-10)).toBe(-10);
    });

    it('should enforce minimum bounds', () => {
      expect(sanitizeNumber(-100, 0, 100)).toBe(0);
      expect(sanitizeNumber(5, 10, 100)).toBe(10);
    });

    it('should enforce maximum bounds', () => {
      expect(sanitizeNumber(200, 0, 100)).toBe(100);
      expect(sanitizeNumber(1000, -100, 100)).toBe(100);
    });

    it('should return default for invalid values', () => {
      expect(sanitizeNumber('not a number', 0, 100, 50)).toBe(50);
      expect(sanitizeNumber(NaN, 0, 100, 25)).toBe(25);
      expect(sanitizeNumber(Infinity, 0, 100, 10)).toBe(10);
      expect(sanitizeNumber(null, 0, 100, 0)).toBe(0);
    });

    it('should use default bounds when not specified', () => {
      expect(sanitizeNumber(Number.MAX_SAFE_INTEGER + 1)).toBe(Number.MAX_SAFE_INTEGER);
      expect(sanitizeNumber(Number.MIN_SAFE_INTEGER - 1)).toBe(Number.MIN_SAFE_INTEGER);
    });
  });

  describe('sanitizeFields', () => {
    it('should sanitize specified fields only', () => {
      const input = {
        name: '<script>alert("XSS")</script>John',
        email: 'user@example.com',
        age: 25,
        bio: '<b>Developer</b>',
      };
      
      const result = sanitizeFields(input, ['name', 'bio'], 'strict');
      
      expect(result.name).toBe('John');
      expect(result.email).toBe('user@example.com'); // Unchanged
      expect(result.age).toBe(25); // Unchanged
      expect(result.bio).toBe('Developer');
    });

    it('should handle different sanitization modes', () => {
      const input = {
        title: '<h1>Title</h1>',
        content: '<p>Paragraph with <b>bold</b></p>',
      };
      
      const strictResult = sanitizeFields(input, ['title', 'content'], 'strict');
      expect(strictResult.title).toBe('Title');
      expect(strictResult.content).toBe('Paragraph with bold');
      
      const basicResult = sanitizeFields(input, ['title', 'content'], 'basic');
      expect(basicResult.title).toBe('Title');
      expect(basicResult.content).toBe('<p>Paragraph with <b>bold</b></p>');
    });

    it('should skip non-string fields', () => {
      const input = {
        text: 'normal text',
        number: 123,
        boolean: true,
        object: { nested: 'value' },
        array: [1, 2, 3],
      };
      
      const result = sanitizeFields(input, ['text', 'number', 'boolean', 'object', 'array']);
      
      expect(result.text).toBe('normal text');
      expect(result.number).toBe(123);
      expect(result.boolean).toBe(true);
      expect(result.object).toEqual({ nested: 'value' });
      expect(result.array).toEqual([1, 2, 3]);
    });
  });
});