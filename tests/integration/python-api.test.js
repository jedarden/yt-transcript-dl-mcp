// Integration test for Python YouTube Transcript API
// Tests the real Python API integration without mocking

import { describe, it, expect } from '@jest/globals';
import { YouTubeTranscriptService } from '../../src/services/youtube-transcript.service.js';

describe('YouTube Transcript Python API Integration', () => {
  let service;
  
  beforeAll(() => {
    service = new YouTubeTranscriptService();
  });
  
  afterAll(() => {
    // Clean up cache
    service.clearCache();
  });

  it('should extract transcript from real YouTube video', async () => {
    const result = await service.getTranscript('dQw4w9WgXcQ', 'en', 'json');
    
    expect(result).toBeDefined();
    expect(result.videoId).toBe('dQw4w9WgXcQ');
    expect(result.language).toBe('en');
    expect(result.transcript).toBeInstanceOf(Array);
    expect(result.transcript.length).toBeGreaterThan(0);
    expect(result.metadata.source).toBe('youtube-transcript-api');
    expect(result.metadata.extractedAt).toBeDefined();
    expect(result.metadata.duration).toBeGreaterThan(0);
    
    // Check transcript structure
    const firstItem = result.transcript[0];
    expect(firstItem).toHaveProperty('text');
    expect(firstItem).toHaveProperty('start');
    expect(firstItem).toHaveProperty('duration');
    expect(typeof firstItem.text).toBe('string');
    expect(typeof firstItem.start).toBe('number');
    expect(typeof firstItem.duration).toBe('number');
  }, 30000);

  it('should list available transcripts for video', async () => {
    const result = await service.listTranscripts('dQw4w9WgXcQ');
    
    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.videoId).toBe('dQw4w9WgXcQ');
    expect(result.transcripts).toBeInstanceOf(Array);
    expect(result.transcripts.length).toBeGreaterThan(0);
    
    // Check transcript listing structure
    const firstTranscript = result.transcripts[0];
    expect(firstTranscript).toHaveProperty('language');
    expect(firstTranscript).toHaveProperty('language_code');
    expect(firstTranscript).toHaveProperty('is_generated');
    expect(firstTranscript).toHaveProperty('is_translatable');
    expect(typeof firstTranscript.language).toBe('string');
    expect(typeof firstTranscript.language_code).toBe('string');
    expect(typeof firstTranscript.is_generated).toBe('boolean');
    expect(typeof firstTranscript.is_translatable).toBe('boolean');
  }, 30000);

  it('should handle invalid video ID gracefully', async () => {
    const result = await service.getTranscript('invalid-video-id', 'en', 'json');
    
    expect(result).toBeDefined();
    expect(result.videoId).toBe('invalid-video-id');
    expect(result.title).toBe('Error');
    expect(result.transcript).toEqual([]);
    expect(result.metadata.error).toBeDefined();
    expect(typeof result.metadata.error).toBe('string');
  }, 30000);

  it('should format transcript correctly', () => {
    const sampleTranscript = [
      { text: 'Hello world', start: 0, duration: 2 },
      { text: 'This is a test', start: 2, duration: 3 }
    ];
    
    // Test text format
    const textResult = service.formatTranscript(sampleTranscript, 'text');
    expect(textResult).toBe('Hello world This is a test');
    
    // Test JSON format
    const jsonResult = service.formatTranscript(sampleTranscript, 'json');
    const parsed = JSON.parse(jsonResult);
    expect(parsed).toEqual(sampleTranscript);
    
    // Test SRT format
    const srtResult = service.formatTranscript(sampleTranscript, 'srt');
    expect(srtResult).toContain('00:00:00,000 --> 00:00:02,000');
    expect(srtResult).toContain('Hello world');
    expect(srtResult).toContain('00:00:02,000 --> 00:00:05,000');
    expect(srtResult).toContain('This is a test');
  });

  it('should use cache for repeated requests', async () => {
    const result1 = await service.getTranscript('dQw4w9WgXcQ', 'en', 'json');
    const result2 = await service.getTranscript('dQw4w9WgXcQ', 'en', 'json');
    
    expect(result1).toEqual(result2);
    
    // Verify cache is being used by checking that both results have the same timestamp
    expect(result1.metadata.extractedAt).toBe(result2.metadata.extractedAt);
  }, 30000);

  it('should provide cache statistics', () => {
    const stats = service.getCacheStats();
    expect(stats).toBeDefined();
    expect(typeof stats).toBe('object');
  });

  it('should clear cache successfully', () => {
    expect(() => service.clearCache()).not.toThrow();
  });
});