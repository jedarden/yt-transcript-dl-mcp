import { exec } from 'child_process';
import { promisify } from 'util';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { Logger } from '../utils/logger.js';
import { Cache } from '../utils/cache.js';
import { 
  TranscriptItem, 
  TranscriptResponse, 
  BulkTranscriptRequest, 
  BulkTranscriptResponse,
  PlaylistTranscriptRequest 
} from '../types/index.js';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface PythonTranscriptResult {
  success: boolean;
  videoId: string;
  language: string;
  transcript: Array<{
    text: string;
    start: number;
    duration: number;
  }>;
  metadata?: {
    extractedAt?: string;
    source: string;
    itemCount: number;
    duration: number;
  };
  error?: string;
}

interface PythonListResult {
  success: boolean;
  videoId: string;
  transcripts: Array<{
    language: string;
    language_code: string;
    is_generated: boolean;
    is_translatable: boolean;
  }>;
  error?: string;
}

interface PythonBulkResult {
  success: boolean;
  results: PythonTranscriptResult[];
  errors: Array<{
    videoId: string;
    error: string;
  }>;
  summary: {
    total: number;
    successful: number;
    failed: number;
  };
}

export class YouTubeTranscriptService {
  private cache: Cache;
  private logger: typeof Logger;
  private pythonScript: string;

  constructor(
    cacheConfig: { ttl: number; maxSize: number; enabled: boolean } = {
      ttl: 3600,
      maxSize: 1000,
      enabled: true
    }
  ) {
    this.cache = new Cache(cacheConfig.ttl, cacheConfig.maxSize, cacheConfig.enabled);
    this.logger = Logger;
    this.pythonScript = join(__dirname, '../../scripts/youtube_transcript_fetcher.py');
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

      // Call Python script to get transcript
      const command = `python3 "${this.pythonScript}" fetch --video-id "${cleanVideoId}" --language "${language}"`;
      const { stdout, stderr } = await execAsync(command);

      if (stderr) {
        this.logger.warn(`Python script warning: ${stderr}`);
      }

      const pythonResult: PythonTranscriptResult = JSON.parse(stdout);

      if (!pythonResult.success) {
        throw new Error(pythonResult.error || 'Failed to fetch transcript');
      }

      // Convert to our format
      const transcript: TranscriptItem[] = pythonResult.transcript.map(item => ({
        text: item.text,
        start: item.start,
        duration: item.duration
      }));

      const response: TranscriptResponse = {
        videoId: cleanVideoId,
        title: await this.getVideoTitle(cleanVideoId), // Try to get title
        language,
        transcript,
        metadata: {
          extractedAt: new Date().toISOString(),
          source: 'youtube-transcript-api',
          duration: pythonResult.metadata?.duration || transcript.reduce((acc, item) => acc + item.duration, 0)
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
          source: 'youtube-transcript-api',
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }

  public async getBulkTranscripts(
    request: BulkTranscriptRequest
  ): Promise<BulkTranscriptResponse> {
    try {
      this.logger.info(`Processing bulk request for ${request.videoIds.length} videos`);

      // Call Python script for bulk processing
      const videoIds = request.videoIds.map(id => this.extractVideoId(id)).join(',');
      const command = `python3 "${this.pythonScript}" bulk --video-ids "${videoIds}" --language "${request.language || 'en'}"`;
      
      const { stdout, stderr } = await execAsync(command);

      if (stderr) {
        this.logger.warn(`Python script warning: ${stderr}`);
      }

      const pythonResult: PythonBulkResult = JSON.parse(stdout);

      if (!pythonResult.success) {
        throw new Error('Bulk processing failed');
      }

      // Convert results to our format
      const results: TranscriptResponse[] = [];
      for (const result of pythonResult.results) {
        const transcript: TranscriptItem[] = result.transcript.map(item => ({
          text: item.text,
          start: item.start,
          duration: item.duration
        }));

        results.push({
          videoId: result.videoId,
          title: await this.getVideoTitle(result.videoId),
          language: result.language,
          transcript,
          metadata: {
            extractedAt: new Date().toISOString(),
            source: 'youtube-transcript-api',
            duration: result.metadata?.duration || transcript.reduce((acc, item) => acc + item.duration, 0)
          }
        });
      }

      return {
        results,
        errors: pythonResult.errors,
        summary: pythonResult.summary
      };

    } catch (error) {
      this.logger.error(`Failed to process bulk request:`, error);
      return {
        results: [],
        errors: request.videoIds.map(videoId => ({
          videoId: this.extractVideoId(videoId),
          error: error instanceof Error ? error.message : 'Unknown error'
        })),
        summary: {
          total: request.videoIds.length,
          successful: 0,
          failed: request.videoIds.length
        }
      };
    }
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

  public async listTranscripts(videoId: string): Promise<{
    success: boolean;
    videoId: string;
    transcripts: Array<{
      language: string;
      language_code: string;
      is_generated: boolean;
      is_translatable: boolean;
    }>;
    error?: string;
  }> {
    try {
      const cleanVideoId = this.extractVideoId(videoId);
      const command = `python3 "${this.pythonScript}" list --video-id "${cleanVideoId}"`;
      
      const { stdout, stderr } = await execAsync(command);

      if (stderr) {
        this.logger.warn(`Python script warning: ${stderr}`);
      }

      const result: PythonListResult = JSON.parse(stdout);
      return result;

    } catch (error) {
      this.logger.error(`Failed to list transcripts for video ${videoId}:`, error);
      return {
        success: false,
        videoId: this.extractVideoId(videoId),
        transcripts: [],
        error: error instanceof Error ? error.message : 'Unknown error'
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

  private async getVideoTitle(videoId: string): Promise<string> {
    // For now, return a generic title
    // In a production system, you might want to use YouTube Data API
    // or extract title from the video page
    return `YouTube Video ${videoId}`;
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