import { YouTubeTranscriptServer } from '../../src/server/YouTubeTranscriptServer.js';
import type { MCPServerConfig } from '../../src/types/config.js';

describe('YouTubeTranscriptServer', () => {
  let server: YouTubeTranscriptServer;
  
  beforeEach(() => {
    const config: MCPServerConfig = {
      name: 'test-server',
      version: '1.0.0',
      logLevel: 'error' // Suppress logs in tests
    };
    server = new YouTubeTranscriptServer(config);
  });

  afterEach(async () => {
    // Clean up
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  describe('handleListTools', () => {
    it('should return available tools', async () => {
      const result = await server['handleListTools']();
      
      expect(result).toHaveProperty('tools');
      expect(Array.isArray(result.tools)).toBe(true);
      expect(result.tools.length).toBe(3);
      
      const toolNames = result.tools.map((t: any) => t.name);
      expect(toolNames).toContain('get_transcript');
      expect(toolNames).toContain('search_transcript');
      expect(toolNames).toContain('get_video_metadata');
    });
  });

  describe('handleListResources', () => {
    it('should return available resources', async () => {
      const result = await server['handleListResources']();
      
      expect(result).toHaveProperty('resources');
      expect(Array.isArray(result.resources)).toBe(true);
      expect(result.resources.length).toBeGreaterThan(0);
      
      const resourceUris = result.resources.map((r: any) => r.uri);
      expect(resourceUris).toContain('transcript://recent');
      expect(resourceUris).toContain('transcript://cache');
    });
  });

  describe('extractVideoId', () => {
    const testCases = [
      {
        input: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        expected: 'dQw4w9WgXcQ'
      },
      {
        input: 'https://youtu.be/dQw4w9WgXcQ',
        expected: 'dQw4w9WgXcQ'
      },
      {
        input: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
        expected: 'dQw4w9WgXcQ'
      },
      {
        input: 'dQw4w9WgXcQ',
        expected: 'dQw4w9WgXcQ'
      }
    ];

    testCases.forEach(({ input, expected }) => {
      it(`should extract video ID from ${input}`, () => {
        const result = server['extractVideoId'](input);
        expect(result).toBe(expected);
      });
    });

    it('should throw error for invalid URL', () => {
      expect(() => {
        server['extractVideoId']('invalid-url');
      }).toThrow();
    });
  });
});