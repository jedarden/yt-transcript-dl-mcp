import { jest } from '@jest/globals';
import { YouTubeTranscriptService } from '../../src/services/youtube-transcript.service';
import { YoutubeTranscript } from 'youtube-transcript';
// Mock the dependencies
jest.mock('youtube-transcript');
jest.mock('../../src/utils/logger');
jest.mock('../../src/utils/cache');
const mockYoutubeTranscript = YoutubeTranscript;
describe('YouTubeTranscriptService', () => {
    let service;
    beforeEach(() => {
        jest.clearAllMocks();
        service = new YouTubeTranscriptService();
    });
    describe('getTranscript', () => {
        it('should successfully extract transcript from video ID', async () => {
            // Mock data
            const mockTranscriptData = [
                { text: 'Hello world', offset: 0, duration: 2500 },
                { text: 'This is a test', offset: 2500, duration: 3000 }
            ];
            mockYoutubeTranscript.fetchTranscript.mockResolvedValue(mockTranscriptData);
            const result = await service.getTranscript('dQw4w9WgXcQ', 'en', 'json');
            expect(result.videoId).toBe('dQw4w9WgXcQ');
            expect(result.title).toBe('YouTube Video');
            expect(result.language).toBe('en');
            expect(result.transcript).toHaveLength(2);
            expect(result.transcript[0].text).toBe('Hello world');
            expect(result.transcript[0].start).toBe(0.0);
            expect(result.transcript[0].duration).toBe(2.5);
            expect(result.metadata?.source).toBe('youtube-transcript');
        });
        it('should extract video ID from YouTube URL', async () => {
            const mockTranscriptData = [{ text: 'Test', offset: 0, duration: 1000 }];
            mockYoutubeTranscript.fetchTranscript.mockResolvedValue(mockTranscriptData);
            await service.getTranscript('https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'en', 'json');
            expect(mockYoutubeTranscript.fetchTranscript).toHaveBeenCalledWith('dQw4w9WgXcQ', {
                lang: 'en'
            });
        });
        it('should handle errors gracefully', async () => {
            mockYoutubeTranscript.fetchTranscript.mockRejectedValue(new Error('Video not found'));
            const result = await service.getTranscript('invalid-id', 'en', 'json');
            expect(result.videoId).toBe('invalid-id');
            expect(result.title).toBe('Error');
            expect(result.transcript).toHaveLength(0);
            expect(result.metadata?.error).toBe('Video not found');
        });
        it('should handle different languages', async () => {
            const mockTranscriptData = [{ text: 'Hola mundo', offset: 0, duration: 2000 }];
            mockYoutubeTranscript.fetchTranscript.mockResolvedValue(mockTranscriptData);
            await service.getTranscript('dQw4w9WgXcQ', 'es', 'json');
            expect(mockYoutubeTranscript.fetchTranscript).toHaveBeenCalledWith('dQw4w9WgXcQ', {
                lang: 'es'
            });
        });
    });
    describe('getBulkTranscripts', () => {
        it('should process multiple videos', async () => {
            const mockTranscriptData = [{ text: 'Test', offset: 0, duration: 1000 }];
            mockYoutubeTranscript.fetchTranscript.mockResolvedValue(mockTranscriptData);
            const request = {
                videoIds: ['dQw4w9WgXcQ', 'jNQXAC9IVRw'],
                outputFormat: 'json',
                language: 'en'
            };
            const result = await service.getBulkTranscripts(request);
            expect(result.results).toHaveLength(2);
            expect(result.errors).toHaveLength(0);
            expect(result.summary.total).toBe(2);
            expect(result.summary.successful).toBe(2);
            expect(result.summary.failed).toBe(0);
        });
        it('should handle mixed success and failure', async () => {
            mockYoutubeTranscript.fetchTranscript
                .mockResolvedValueOnce([{ text: 'Success', offset: 0, duration: 1000 }])
                .mockRejectedValueOnce(new Error('Video not found'));
            const request = {
                videoIds: ['valid-id', 'invalid-id'],
                outputFormat: 'json',
                language: 'en'
            };
            const result = await service.getBulkTranscripts(request);
            expect(result.results).toHaveLength(1);
            expect(result.errors).toHaveLength(1);
            expect(result.summary.total).toBe(2);
            expect(result.summary.successful).toBe(1);
            expect(result.summary.failed).toBe(1);
            expect(result.errors[0].videoId).toBe('invalid-id');
            expect(result.errors[0].error).toBe('Video not found');
        });
    });
    describe('formatTranscript', () => {
        const sampleTranscript = [
            { text: 'Hello world', start: 0.0, duration: 2.5 },
            { text: 'This is a test', start: 2.5, duration: 3.0 }
        ];
        it('should format transcript as text', () => {
            const result = service.formatTranscript(sampleTranscript, 'text');
            expect(result).toBe('Hello world This is a test');
        });
        it('should format transcript as JSON', () => {
            const result = service.formatTranscript(sampleTranscript, 'json');
            const parsed = JSON.parse(result);
            expect(parsed).toHaveLength(2);
            expect(parsed[0].text).toBe('Hello world');
        });
        it('should format transcript as SRT', () => {
            const result = service.formatTranscript(sampleTranscript, 'srt');
            expect(result).toContain('1\n00:00:00,000 --> 00:00:02,500\nHello world\n');
            expect(result).toContain('2\n00:00:02,500 --> 00:00:05,500\nThis is a test\n');
        });
    });
    describe('cache management', () => {
        it('should provide cache statistics', () => {
            const stats = service.getCacheStats();
            expect(stats).toBeDefined();
        });
        it('should clear cache', () => {
            expect(() => service.clearCache()).not.toThrow();
        });
        it('should return cache keys', () => {
            const keys = service.getCacheKeys();
            expect(Array.isArray(keys)).toBe(true);
        });
    });
    describe('URL parsing', () => {
        it('should extract video ID from various URL formats', async () => {
            const urls = [
                'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
                'https://youtu.be/dQw4w9WgXcQ',
                'https://www.youtube.com/embed/dQw4w9WgXcQ',
                'dQw4w9WgXcQ'
            ];
            const mockTranscriptData = [{ text: 'Test', offset: 0, duration: 1000 }];
            mockYoutubeTranscript.fetchTranscript.mockResolvedValue(mockTranscriptData);
            for (const url of urls) {
                await service.getTranscript(url, 'en', 'json');
                expect(mockYoutubeTranscript.fetchTranscript).toHaveBeenCalledWith('dQw4w9WgXcQ', {
                    lang: 'en'
                });
            }
        });
    });
});
//# sourceMappingURL=youtube-transcript.service.test.js.map