import { 
  VideoTranscript, 
  BulkProcessOptions, 
  BulkProgress,
  TranscriptError,
  ErrorCode,
  TranscriptOptions,
  FormatOptions
} from '../types/index.js';
import { YouTubeExtractorService } from './youtube-extractor.service.js';
import { FormatterService } from './formatter.service.js';
import winston from 'winston';
import pLimit from 'p-limit';

export interface BulkProcessResult {
  videoId: string;
  success: boolean;
  transcript?: VideoTranscript;
  formatted?: string;
  error?: string;
}

export class BulkProcessorService {
  private extractor: YouTubeExtractorService;
  private formatter: FormatterService;
  private logger: winston.Logger;

  constructor(extractor: YouTubeExtractorService) {
    this.extractor = extractor;
    this.formatter = new FormatterService();

    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console({
          format: winston.format.simple()
        })
      ]
    });
  }

  /**
   * Process multiple videos in bulk
   */
  async processBulk(options: BulkProcessOptions): Promise<BulkProcessResult[]> {
    const {
      videoIds,
      options: transcriptOptions = {},
      format: formatOptions,
      concurrency = 3,
      retryAttempts = 3,
      retryDelay = 1000,
      onProgress
    } = options;

    // Remove duplicates
    const uniqueVideoIds = [...new Set(videoIds)];
    
    this.logger.info(`Starting bulk processing of ${uniqueVideoIds.length} videos`);

    const limit = pLimit(concurrency);
    const results: BulkProcessResult[] = [];
    const progress: BulkProgress = {
      total: uniqueVideoIds.length,
      completed: 0,
      failed: 0,
      errors: []
    };

    // Create processing tasks
    const tasks = uniqueVideoIds.map((videoId, index) => 
      limit(async () => {
        progress.currentVideo = videoId;
        
        try {
          const result = await this.processVideo(
            videoId, 
            transcriptOptions, 
            formatOptions,
            retryAttempts,
            retryDelay
          );
          
          progress.completed++;
          results.push(result);
          
          if (onProgress) {
            onProgress({ ...progress });
          }
          
          return result;
        } catch (error) {
          progress.failed++;
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          progress.errors.push({ videoId, error: errorMessage });
          
          const result: BulkProcessResult = {
            videoId,
            success: false,
            error: errorMessage
          };
          
          results.push(result);
          
          if (onProgress) {
            onProgress({ ...progress });
          }
          
          return result;
        }
      })
    );

    // Execute all tasks
    await Promise.all(tasks);

    this.logger.info(`Bulk processing completed: ${progress.completed} succeeded, ${progress.failed} failed`);

    return results;
  }

  /**
   * Process a single video
   */
  private async processVideo(
    videoId: string,
    transcriptOptions: TranscriptOptions,
    formatOptions?: FormatOptions,
    retryAttempts: number = 3,
    retryDelay: number = 1000
  ): Promise<BulkProcessResult> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= retryAttempts; attempt++) {
      try {
        this.logger.debug(`Processing video ${videoId} (attempt ${attempt})`);
        
        // Extract transcript
        const transcript = await this.extractor.extractTranscript(videoId, transcriptOptions);
        
        // Format if requested
        let formatted: string | undefined;
        if (formatOptions) {
          formatted = this.formatter.format(transcript, formatOptions);
        }
        
        return {
          videoId,
          success: true,
          transcript,
          formatted
        };
        
      } catch (error) {
        lastError = error as Error;
        this.logger.error(`Failed to process video ${videoId} (attempt ${attempt}):`, error);
        
        // Don't retry for certain errors
        if (error instanceof TranscriptError) {
          const nonRetryableCodes = [
            ErrorCode.VIDEO_NOT_FOUND,
            ErrorCode.PRIVATE_VIDEO,
            ErrorCode.DELETED_VIDEO,
            ErrorCode.INVALID_VIDEO_ID,
            ErrorCode.TRANSCRIPT_NOT_AVAILABLE
          ];
          
          if (nonRetryableCodes.includes(error.code)) {
            break;
          }
        }
        
        if (attempt < retryAttempts) {
          await this.delay(retryDelay * attempt);
        }
      }
    }

    throw lastError || new Error('Processing failed');
  }

  /**
   * Process a playlist
   */
  async processPlaylist(
    playlistId: string,
    transcriptOptions: TranscriptOptions = {},
    formatOptions?: FormatOptions,
    concurrency: number = 3,
    onProgress?: (progress: BulkProgress) => void
  ): Promise<{
    playlistInfo: any;
    results: BulkProcessResult[];
  }> {
    this.logger.info(`Processing playlist: ${playlistId}`);

    // Get playlist info
    const playlistInfo = await this.extractor.extractPlaylistInfo(playlistId);
    
    this.logger.info(`Found ${playlistInfo.videos.length} videos in playlist: ${playlistInfo.title}`);

    // Extract video IDs
    const videoIds = playlistInfo.videos.map(v => v.videoId);

    // Process videos
    const results = await this.processBulk({
      videoIds,
      options: transcriptOptions,
      format: formatOptions,
      concurrency,
      onProgress
    });

    return {
      playlistInfo,
      results
    };
  }

  /**
   * Process videos from various sources
   */
  async processFromSources(sources: {
    videoIds?: string[];
    playlistIds?: string[];
    channelId?: string;
  }, options: {
    transcriptOptions?: TranscriptOptions;
    formatOptions?: FormatOptions;
    concurrency?: number;
    onProgress?: (progress: BulkProgress) => void;
  }): Promise<BulkProcessResult[]> {
    const allResults: BulkProcessResult[] = [];
    let allVideoIds: string[] = [];

    // Collect video IDs from all sources
    if (sources.videoIds) {
      allVideoIds.push(...sources.videoIds);
    }

    if (sources.playlistIds) {
      for (const playlistId of sources.playlistIds) {
        try {
          const playlistInfo = await this.extractor.extractPlaylistInfo(playlistId);
          allVideoIds.push(...playlistInfo.videos.map(v => v.videoId));
        } catch (error) {
          this.logger.error(`Failed to get playlist ${playlistId}:`, error);
        }
      }
    }

    // Process all collected videos
    if (allVideoIds.length > 0) {
      const results = await this.processBulk({
        videoIds: allVideoIds,
        options: options.transcriptOptions,
        format: options.formatOptions,
        concurrency: options.concurrency,
        onProgress: options.onProgress
      });
      
      allResults.push(...results);
    }

    return allResults;
  }

  /**
   * Generate summary report
   */
  generateReport(results: BulkProcessResult[]): {
    total: number;
    successful: number;
    failed: number;
    successRate: number;
    errors: Array<{ videoId: string; error: string }>;
    languages: Record<string, number>;
    totalDuration: number;
    averageDuration: number;
  } {
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    // Language statistics
    const languages: Record<string, number> = {};
    let totalDuration = 0;

    for (const result of successful) {
      if (result.transcript) {
        const lang = result.transcript.language;
        languages[lang] = (languages[lang] || 0) + 1;
        totalDuration += result.transcript.duration || 0;
      }
    }

    return {
      total: results.length,
      successful: successful.length,
      failed: failed.length,
      successRate: results.length > 0 ? (successful.length / results.length) * 100 : 0,
      errors: failed.map(r => ({ videoId: r.videoId, error: r.error || 'Unknown error' })),
      languages,
      totalDuration,
      averageDuration: successful.length > 0 ? totalDuration / successful.length : 0
    };
  }

  /**
   * Export results to various formats
   */
  exportResults(results: BulkProcessResult[], format: 'json' | 'csv' | 'txt' = 'json'): string {
    const successful = results.filter(r => r.success && r.transcript);

    switch (format) {
      case 'json':
        return JSON.stringify(successful.map(r => r.transcript), null, 2);

      case 'csv':
        let csv = 'Video ID,Title,Channel,Language,Duration,Auto-generated,Transcript Length\n';
        for (const result of successful) {
          const t = result.transcript!;
          csv += `"${t.videoId}","${t.title || ''}","${t.channel || ''}","${t.language}",${t.duration || 0},${t.isAutoGenerated},${t.segments.length}\n`;
        }
        return csv;

      case 'txt':
        let txt = '';
        for (const result of successful) {
          const t = result.transcript!;
          txt += `Video: ${t.title || t.videoId}\n`;
          txt += `Channel: ${t.channel || 'Unknown'}\n`;
          txt += `Language: ${t.language}\n`;
          txt += `Duration: ${this.formatDuration(t.duration || 0)}\n`;
          txt += '\nTranscript:\n';
          txt += t.segments.map(s => s.text).join(' ');
          txt += '\n\n' + '='.repeat(80) + '\n\n';
        }
        return txt;

      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Format duration
   */
  private formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    }
    return `${minutes}m ${secs}s`;
  }

  /**
   * Delay execution
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}