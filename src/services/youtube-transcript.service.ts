import { YoutubeTranscript } from 'youtube-transcript';
import { Logger } from '../utils/logger.js';
import { Cache } from '../utils/cache.js';
import { 
  TranscriptItem, 
  TranscriptResponse, 
  BulkTranscriptRequest, 
  BulkTranscriptResponse,
  PlaylistTranscriptRequest 
} from '../types/index.js';

export class YouTubeTranscriptService {
  private cache: Cache;
  private logger: typeof Logger;

  constructor(
    cacheConfig: { ttl: number; maxSize: number; enabled: boolean } = {
      ttl: 3600,
      maxSize: 1000,
      enabled: true
    }
  ) {
    this.cache = new Cache(cacheConfig.ttl, cacheConfig.maxSize, cacheConfig.enabled);
    this.logger = Logger;
  }

  public async getTranscript(
    videoId: string,
    language: string = 'en',
    format: 'text' | 'json' | 'srt' = 'json'
  ): Promise<TranscriptResponse> {
    try {
      // Clean video ID from URL if needed
      const cleanVideoId = this.extractVideoId(videoId);
      const cacheKey = `transcript:${cleanVideoId}:${language}:${format}`;

      // Check cache first
      const cached = this.cache.get<TranscriptResponse>(cacheKey);
      if (cached) {
        this.logger.debug(`Cache hit for video ${cleanVideoId}`);
        return cached;
      }

      this.logger.info(`Fetching transcript for video: ${cleanVideoId}`);

      // Try to get transcript using youtube-transcript
      const transcriptData = await YoutubeTranscript.fetchTranscript(cleanVideoId, {
        lang: language
      });

      // Convert to our format
      const transcript: TranscriptItem[] = transcriptData.map((item: any) => ({
        text: item.text,
        start: item.offset / 1000, // Convert ms to seconds
        duration: item.duration / 1000 // Convert ms to seconds
      }));

      const response: TranscriptResponse = {
        videoId: cleanVideoId,
        title: 'YouTube Video', // youtube-transcript doesn't provide title
        language,
        transcript,
        metadata: {
          extractedAt: new Date().toISOString(),
          source: 'youtube-transcript',
          duration: transcript.reduce((acc, item) => acc + item.duration, 0)
        }
      };

      // Cache the response
      this.cache.set(cacheKey, response);

      this.logger.info(`Successfully extracted transcript for video ${cleanVideoId}`);
      return response;

    } catch (error) {
      this.logger.error(`Failed to extract transcript for video ${videoId}:`, error);
      
      // Return structured error response
      return {
        videoId: this.extractVideoId(videoId),
        title: 'Error',
        language,
        transcript: [],
        metadata: {
          extractedAt: new Date().toISOString(),
          source: 'youtube-transcript',
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }

  public async getBulkTranscripts(
    request: BulkTranscriptRequest
  ): Promise<BulkTranscriptResponse> {
    const results: TranscriptResponse[] = [];
    const errors: Array<{ videoId: string; error: string }> = [];

    this.logger.info(`Processing bulk request for ${request.videoIds.length} videos`);

    // Process videos with rate limiting
    for (const videoId of request.videoIds) {
      try {
        const response = await this.getTranscript(
          videoId,
          request.language,
          request.outputFormat
        );

        if (response.metadata?.error) {
          errors.push({
            videoId: this.extractVideoId(videoId),
            error: response.metadata.error
          });
        } else {
          results.push(response);
        }

        // Add delay to avoid rate limiting
        await this.delay(1000);

      } catch (error) {
        errors.push({
          videoId: this.extractVideoId(videoId),
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return {
      results,
      errors,
      summary: {
        total: request.videoIds.length,
        successful: results.length,
        failed: errors.length
      }
    };
  }

  public async getPlaylistTranscripts(
    request: PlaylistTranscriptRequest
  ): Promise<BulkTranscriptResponse> {
    try {
      // Extract playlist ID
      const playlistId = this.extractPlaylistId(request.playlistId);
      
      // Get video IDs from playlist (this would need YouTube Data API)
      // For now, we'll throw an error indicating this needs API key
      throw new Error('Playlist processing requires YouTube Data API key. Please extract video IDs manually.');
      
    } catch (error) {
      this.logger.error(`Failed to process playlist ${request.playlistId}:`, error);
      return {
        results: [],
        errors: [{
          videoId: request.playlistId,
          error: error instanceof Error ? error.message : 'Unknown error'
        }],
        summary: {
          total: 0,
          successful: 0,
          failed: 1
        }
      };
    }
  }

  public formatTranscript(
    transcript: TranscriptItem[],
    format: 'text' | 'json' | 'srt'
  ): string {
    switch (format) {
    case 'text':
      return transcript.map(item => item.text).join(' ');
      
    case 'json':
      return JSON.stringify(transcript, null, 2);
      
    case 'srt':
      return transcript.map((item, index) => {
        const start = this.secondsToSrtTime(item.start);
        const end = this.secondsToSrtTime(item.start + item.duration);
        return `${index + 1}\n${start} --> ${end}\n${item.text}\n`;
      }).join('\n');
      
    default:
      return JSON.stringify(transcript, null, 2);
    }
  }

  private extractVideoId(url: string): string {
    // Handle various YouTube URL formats
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
      /^([a-zA-Z0-9_-]{11})$/
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        return match[1];
      }
    }

    // If no pattern matches, assume it's already a video ID
    return url;
  }

  private extractPlaylistId(url: string): string {
    const match = url.match(/[?&]list=([^&]+)/);
    return match ? match[1] : url;
  }

  private secondsToSrtTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const milliseconds = Math.floor((seconds % 1) * 1000);

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${milliseconds.toString().padStart(3, '0')}`;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Cache management methods
  public getCacheStats() {
    return this.cache.getStats();
  }

  public clearCache(): void {
    this.cache.flush();
  }

  public getCacheKeys(): string[] {
    return this.cache.getKeys();
  }
}