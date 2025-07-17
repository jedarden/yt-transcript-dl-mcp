import { jest } from '@jest/globals';
import { YouTubeTranscriptMCPServer } from '../../src/server/mcp-server';
import { YouTubeTranscriptService } from '../../src/services/youtube-transcript.service';

// Mock external dependencies
jest.mock('youtube-captions-scraper');
jest.mock('../../src/utils/logger');

describe('End-to-End Integration Tests', () => {
  let mcpServer: YouTubeTranscriptMCPServer;
  let transcriptService: YouTubeTranscriptService;

  beforeEach(() => {
    jest.clearAllMocks();
    mcpServer = new YouTubeTranscriptMCPServer();
    transcriptService = new YouTubeTranscriptService();
  });

  describe('Complete workflow', () => {
    it('should handle complete single video transcript workflow', async () => {
      // Mock the YouTube API response
      const mockSubtitles = [
        { text: 'Welcome to our video', start: '0.0', dur: '3.0' },
        { text: 'Today we will discuss', start: '3.0', dur: '2.5' },
        { text: 'the importance of testing', start: '5.5', dur: '3.5' }
      ];

      const mockVideoDetails = {
        title: 'Testing Best Practices'
      };

      const { getSubtitles, getVideoDetails } = await import('youtube-captions-scraper');
      (getSubtitles as jest.MockedFunction<typeof getSubtitles>)
        .mockResolvedValue(mockSubtitles);
      (getVideoDetails as jest.MockedFunction<typeof getVideoDetails>)
        .mockResolvedValue(mockVideoDetails);

      // Test the service directly
      const result = await transcriptService.getTranscript('dQw4w9WgXcQ', 'en', 'json');

      expect(result).toEqual({
        videoId: 'dQw4w9WgXcQ',
        title: 'Testing Best Practices',
        language: 'en',
        transcript: [
          { text: 'Welcome to our video', start: 0.0, duration: 3.0 },
          { text: 'Today we will discuss', start: 3.0, duration: 2.5 },
          { text: 'the importance of testing', start: 5.5, duration: 3.5 }
        ],
        metadata: {
          extractedAt: expect.any(String),
          source: 'youtube-captions-scraper',
          duration: 9.0
        }
      });
    });

    it('should handle bulk processing workflow', async () => {
      const mockSubtitles = [
        { text: 'Test content', start: '0.0', dur: '2.0' }
      ];

      const mockVideoDetails = {
        title: 'Test Video'
      };

      const { getSubtitles, getVideoDetails } = await import('youtube-captions-scraper');
      (getSubtitles as jest.MockedFunction<typeof getSubtitles>)
        .mockResolvedValue(mockSubtitles);
      (getVideoDetails as jest.MockedFunction<typeof getVideoDetails>)
        .mockResolvedValue(mockVideoDetails);

      const request = {
        videoIds: ['dQw4w9WgXcQ', 'jNQXAC9IVRw'],
        outputFormat: 'json' as const,
        language: 'en'
      };

      const result = await transcriptService.getBulkTranscripts(request);

      expect(result.results).toHaveLength(2);
      expect(result.summary.total).toBe(2);
      expect(result.summary.successful).toBe(2);
      expect(result.summary.failed).toBe(0);
    });

    it('should handle different output formats', async () => {
      const mockSubtitles = [
        { text: 'Hello world', start: '0.0', dur: '2.5' },
        { text: 'Testing formats', start: '2.5', dur: '3.0' }
      ];

      const { getSubtitles } = await import('youtube-captions-scraper');
      (getSubtitles as jest.MockedFunction<typeof getSubtitles>)
        .mockResolvedValue(mockSubtitles);

      const transcript = [
        { text: 'Hello world', start: 0.0, duration: 2.5 },
        { text: 'Testing formats', start: 2.5, duration: 3.0 }
      ];

      // Test text format
      const textResult = transcriptService.formatTranscript(transcript, 'text');
      expect(textResult).toBe('Hello world Testing formats');

      // Test SRT format
      const srtResult = transcriptService.formatTranscript(transcript, 'srt');
      expect(srtResult).toContain('1\n00:00:00,000 --> 00:00:02,500\nHello world\n');
      expect(srtResult).toContain('2\n00:00:02,500 --> 00:00:05,500\nTesting formats\n');

      // Test JSON format
      const jsonResult = transcriptService.formatTranscript(transcript, 'json');
      const parsed = JSON.parse(jsonResult);
      expect(parsed).toHaveLength(2);
      expect(parsed[0].text).toBe('Hello world');
    });

    it('should handle error scenarios gracefully', async () => {
      // Mock API failure
      const { getSubtitles } = await import('youtube-captions-scraper');
      (getSubtitles as jest.MockedFunction<typeof getSubtitles>)
        .mockRejectedValue(new Error('Video not found'));

      const result = await transcriptService.getTranscript('invalid-video', 'en', 'json');

      expect(result.title).toBe('Error');
      expect(result.transcript).toHaveLength(0);
      expect(result.metadata?.error).toBe('Video not found');
    });

    it('should handle mixed success and failure in bulk processing', async () => {
      const mockSubtitles = [
        { text: 'Success video', start: '0.0', dur: '2.0' }
      ];

      const { getSubtitles, getVideoDetails } = await import('youtube-captions-scraper');
      (getSubtitles as jest.MockedFunction<typeof getSubtitles>)
        .mockResolvedValueOnce(mockSubtitles)
        .mockRejectedValueOnce(new Error('Video not found'));

      (getVideoDetails as jest.MockedFunction<typeof getVideoDetails>)
        .mockResolvedValue({ title: 'Success Video' });

      const request = {
        videoIds: ['valid-video', 'invalid-video'],
        outputFormat: 'json' as const,
        language: 'en'
      };

      const result = await transcriptService.getBulkTranscripts(request);

      expect(result.results).toHaveLength(1);
      expect(result.errors).toHaveLength(1);
      expect(result.summary.total).toBe(2);
      expect(result.summary.successful).toBe(1);
      expect(result.summary.failed).toBe(1);
    });
  });

  describe('Cache behavior', () => {
    it('should cache successful results', async () => {
      const mockSubtitles = [
        { text: 'Cached content', start: '0.0', dur: '2.0' }
      ];

      const { getSubtitles, getVideoDetails } = await import('youtube-captions-scraper');
      (getSubtitles as jest.MockedFunction<typeof getSubtitles>)
        .mockResolvedValue(mockSubtitles);
      (getVideoDetails as jest.MockedFunction<typeof getVideoDetails>)
        .mockResolvedValue({ title: 'Cached Video' });

      // First call should hit the API
      const result1 = await transcriptService.getTranscript('dQw4w9WgXcQ', 'en', 'json');
      
      // Second call should use cache (API won't be called again)
      const result2 = await transcriptService.getTranscript('dQw4w9WgXcQ', 'en', 'json');

      expect(result1).toEqual(result2);
      expect(getSubtitles).toHaveBeenCalledTimes(1);
    });

    it('should provide cache statistics', () => {
      const stats = transcriptService.getCacheStats();
      expect(stats).toBeDefined();
      expect(typeof stats).toBe('object');
    });

    it('should clear cache successfully', () => {
      expect(() => transcriptService.clearCache()).not.toThrow();
    });
  });

  describe('URL parsing', () => {
    it('should extract video IDs from various URL formats', async () => {
      const mockSubtitles = [
        { text: 'URL test', start: '0.0', dur: '1.0' }
      ];

      const { getSubtitles, getVideoDetails } = await import('youtube-captions-scraper');
      (getSubtitles as jest.MockedFunction<typeof getSubtitles>)
        .mockResolvedValue(mockSubtitles);
      (getVideoDetails as jest.MockedFunction<typeof getVideoDetails>)
        .mockResolvedValue({ title: 'URL Test' });

      const urls = [
        'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        'https://youtu.be/dQw4w9WgXcQ',
        'https://www.youtube.com/embed/dQw4w9WgXcQ',
        'dQw4w9WgXcQ'
      ];

      for (const url of urls) {
        const result = await transcriptService.getTranscript(url, 'en', 'json');
        expect(result.videoId).toBe('dQw4w9WgXcQ');
      }
    });
  });

  describe('Language support', () => {
    it('should handle different language codes', async () => {
      const mockSubtitles = [
        { text: 'Hola mundo', start: '0.0', dur: '2.0' }
      ];

      const { getSubtitles, getVideoDetails } = await import('youtube-captions-scraper');
      (getSubtitles as jest.MockedFunction<typeof getSubtitles>)
        .mockResolvedValue(mockSubtitles);
      (getVideoDetails as jest.MockedFunction<typeof getVideoDetails>)
        .mockResolvedValue({ title: 'Spanish Video' });

      const result = await transcriptService.getTranscript('dQw4w9WgXcQ', 'es', 'json');

      expect(result.language).toBe('es');
      expect(result.transcript[0].text).toBe('Hola mundo');
    });
  });
});