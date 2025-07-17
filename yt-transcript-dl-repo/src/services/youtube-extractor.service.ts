import axios, { AxiosInstance } from 'axios';
import * as cheerio from 'cheerio';
import { 
  VideoTranscript, 
  TranscriptSegment, 
  TranscriptOptions,
  ExtractorConfig,
  TranscriptError,
  ErrorCode,
  VideoInfo,
  PlaylistInfo
} from '../types/index.js';
import { CacheService } from './cache.service.js';
import { RateLimiterService } from './rate-limiter.service.js';
import winston from 'winston';

export class YouTubeExtractorService {
  private axiosInstance: AxiosInstance;
  private cache: CacheService;
  private rateLimiter: RateLimiterService;
  private logger: winston.Logger;
  private config: ExtractorConfig;

  constructor(config: ExtractorConfig = {}) {
    this.config = {
      userAgent: config.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      timeout: config.timeout || 30000,
      retryAttempts: config.retryAttempts || 3,
      retryDelay: config.retryDelay || 1000,
      ...config
    };

    this.axiosInstance = axios.create({
      timeout: this.config.timeout,
      headers: {
        'User-Agent': this.config.userAgent,
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      ...(this.config.proxy && { proxy: this.parseProxy(this.config.proxy) })
    });

    this.cache = new CacheService(this.config.cache);
    this.rateLimiter = new RateLimiterService(this.config.rateLimit || {
      maxRequests: 10,
      windowMs: 60000
    });

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
   * Extract transcript for a single video
   */
  async extractTranscript(videoId: string, options: TranscriptOptions = {}): Promise<VideoTranscript> {
    // Validate video ID
    if (!this.isValidVideoId(videoId)) {
      throw new TranscriptError('Invalid video ID format', ErrorCode.INVALID_VIDEO_ID, videoId);
    }

    // Check cache first
    const cached = this.cache.get(videoId, options.lang);
    if (cached) {
      this.logger.debug(`Returning cached transcript for video: ${videoId}`);
      return cached;
    }

    // Extract with rate limiting
    const transcript = await this.rateLimiter.execute(async () => {
      return this.extractWithRetry(videoId, options);
    });

    // Cache the result
    this.cache.set(videoId, transcript, options.lang);
    
    return transcript;
  }

  /**
   * Extract transcript with retry logic
   */
  private async extractWithRetry(videoId: string, options: TranscriptOptions): Promise<VideoTranscript> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.config.retryAttempts!; attempt++) {
      try {
        this.logger.info(`Extracting transcript for video: ${videoId} (attempt ${attempt})`);
        return await this.performExtraction(videoId, options);
      } catch (error) {
        lastError = error as Error;
        this.logger.error(`Extraction failed (attempt ${attempt}):`, error);

        if (attempt < this.config.retryAttempts!) {
          await this.delay(this.config.retryDelay! * attempt);
        }
      }
    }

    throw lastError || new TranscriptError('Extraction failed after retries', ErrorCode.UNKNOWN, videoId);
  }

  /**
   * Perform the actual transcript extraction
   */
  private async performExtraction(videoId: string, options: TranscriptOptions): Promise<VideoTranscript> {
    const url = `https://www.youtube.com/watch?v=${videoId}`;
    
    try {
      const response = await this.axiosInstance.get(url);
      const $ = cheerio.load(response.data);
      
      // Extract initial data from page
      const scriptData = this.extractInitialData($);
      
      // Check if video is available
      this.checkVideoAvailability(scriptData, videoId);
      
      // Extract video metadata
      const metadata = this.extractVideoMetadata(scriptData);
      
      // Extract captions data
      const captionsData = this.extractCaptionsData(scriptData);
      
      if (!captionsData || captionsData.length === 0) {
        throw new TranscriptError('No transcripts available for this video', ErrorCode.TRANSCRIPT_NOT_AVAILABLE, videoId);
      }
      
      // Select appropriate caption track
      const selectedTrack = this.selectCaptionTrack(captionsData, options);
      
      if (!selectedTrack) {
        throw new TranscriptError('No suitable transcript found for specified language', ErrorCode.TRANSCRIPT_NOT_AVAILABLE, videoId);
      }
      
      // Fetch transcript segments
      const segments = await this.fetchTranscriptSegments(selectedTrack.baseUrl);
      
      return {
        videoId,
        title: metadata.title,
        channel: metadata.author,
        duration: metadata.duration,
        language: selectedTrack.languageCode,
        isAutoGenerated: selectedTrack.kind === 'asr',
        segments,
        fetchedAt: new Date()
      };
      
    } catch (error) {
      if (error instanceof TranscriptError) {
        throw error;
      }
      
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 404) {
          throw new TranscriptError('Video not found', ErrorCode.VIDEO_NOT_FOUND, videoId);
        }
        if (error.code === 'ECONNABORTED') {
          throw new TranscriptError('Request timeout', ErrorCode.TIMEOUT, videoId);
        }
        throw new TranscriptError('Network error', ErrorCode.NETWORK_ERROR, videoId, error.message);
      }
      
      throw new TranscriptError('Failed to extract transcript', ErrorCode.UNKNOWN, videoId, error);
    }
  }

  /**
   * Extract initial data from YouTube page
   */
  private extractInitialData($: cheerio.CheerioAPI): any {
    const scripts = $('script').toArray();
    
    for (const script of scripts) {
      const content = $(script).html();
      if (content && content.includes('ytInitialPlayerResponse')) {
        const match = content.match(/ytInitialPlayerResponse\s*=\s*({.+?});/);
        if (match) {
          try {
            return JSON.parse(match[1]);
          } catch (e) {
            this.logger.error('Failed to parse ytInitialPlayerResponse');
          }
        }
      }
    }
    
    throw new Error('Could not extract initial player response');
  }

  /**
   * Check video availability
   */
  private checkVideoAvailability(data: any, videoId: string): void {
    const status = data?.playabilityStatus?.status;
    
    if (status === 'UNPLAYABLE') {
      const reason = data.playabilityStatus.reason || 'Video is unplayable';
      throw new TranscriptError(reason, ErrorCode.PRIVATE_VIDEO, videoId);
    }
    
    if (status === 'LOGIN_REQUIRED') {
      throw new TranscriptError('Video is private', ErrorCode.PRIVATE_VIDEO, videoId);
    }
    
    if (status === 'ERROR') {
      throw new TranscriptError('Video not available', ErrorCode.DELETED_VIDEO, videoId);
    }
    
    if (data?.playabilityStatus?.desktopLegacyAgeGateReason) {
      throw new TranscriptError('Video is age restricted', ErrorCode.AGE_RESTRICTED, videoId);
    }
  }

  /**
   * Extract video metadata
   */
  private extractVideoMetadata(data: any): any {
    const details = data?.videoDetails || {};
    
    return {
      title: details.title || '',
      author: details.author || '',
      duration: parseInt(details.lengthSeconds || '0', 10),
      viewCount: parseInt(details.viewCount || '0', 10),
      keywords: details.keywords || [],
      description: details.shortDescription || '',
      isLive: details.isLiveContent || false,
      isPrivate: details.isPrivate || false
    };
  }

  /**
   * Extract captions data
   */
  private extractCaptionsData(data: any): any[] {
    const captions = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
    
    return captions.map((track: any) => ({
      baseUrl: track.baseUrl,
      name: track.name?.simpleText || track.name?.runs?.[0]?.text || '',
      vssId: track.vssId,
      languageCode: track.languageCode,
      kind: track.kind,
      isTranslatable: track.isTranslatable || false
    }));
  }

  /**
   * Select appropriate caption track
   */
  private selectCaptionTrack(tracks: any[], options: TranscriptOptions): any {
    if (!tracks || tracks.length === 0) return null;
    
    // If language specified, try to find exact match
    if (options.lang) {
      const exactMatch = tracks.find(t => t.languageCode === options.lang);
      if (exactMatch) return exactMatch;
      
      // Try to find partial match (e.g., 'en' matches 'en-US')
      const partialMatch = tracks.find(t => t.languageCode.startsWith(options.lang));
      if (partialMatch) return partialMatch;
    }
    
    // Prefer manually created over auto-generated
    const manualTrack = tracks.find(t => t.kind !== 'asr');
    if (manualTrack) return manualTrack;
    
    // Return first available track
    return tracks[0];
  }

  /**
   * Fetch transcript segments from caption URL
   */
  private async fetchTranscriptSegments(baseUrl: string): Promise<TranscriptSegment[]> {
    // Add format parameter to get JSON response
    const url = `${baseUrl}&fmt=json3`;
    
    const response = await this.axiosInstance.get(url);
    const data = response.data;
    
    if (!data.events) {
      throw new Error('No transcript events found');
    }
    
    const segments: TranscriptSegment[] = [];
    
    for (const event of data.events) {
      if (event.segs) {
        let text = '';
        for (const seg of event.segs) {
          text += seg.utf8 || '';
        }
        
        if (text.trim()) {
          segments.push({
            text: text.trim(),
            start: (event.tStartMs || 0) / 1000,
            duration: (event.dDurationMs || 0) / 1000,
            offset: event.wWinId
          });
        }
      }
    }
    
    return segments;
  }

  /**
   * Extract playlist information
   */
  async extractPlaylistInfo(playlistId: string): Promise<PlaylistInfo> {
    if (!this.isValidPlaylistId(playlistId)) {
      throw new TranscriptError('Invalid playlist ID format', ErrorCode.INVALID_PLAYLIST_ID);
    }

    return this.rateLimiter.execute(async () => {
      const url = `https://www.youtube.com/playlist?list=${playlistId}`;
      
      try {
        const response = await this.axiosInstance.get(url);
        const $ = cheerio.load(response.data);
        
        // Extract initial data
        const scriptData = this.extractInitialData($);
        
        // Extract playlist metadata
        const header = scriptData?.header?.playlistHeaderRenderer;
        const contents = scriptData?.contents?.twoColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents?.[0]?.playlistVideoListRenderer?.contents || [];
        
        const videos: VideoInfo[] = contents
          .filter((item: any) => item.playlistVideoRenderer)
          .map((item: any) => {
            const renderer = item.playlistVideoRenderer;
            return {
              videoId: renderer.videoId,
              title: renderer.title?.runs?.[0]?.text || '',
              channel: renderer.shortBylineText?.runs?.[0]?.text || '',
              duration: this.parseDuration(renderer.lengthText?.simpleText || ''),
              thumbnailUrl: renderer.thumbnail?.thumbnails?.[0]?.url
            };
          });
        
        return {
          playlistId,
          title: header?.title?.simpleText || '',
          videoCount: header?.numVideosText?.runs?.[0]?.text ? parseInt(header.numVideosText.runs[0].text) : videos.length,
          videos
        };
        
      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 404) {
          throw new TranscriptError('Playlist not found', ErrorCode.INVALID_PLAYLIST_ID);
        }
        throw error;
      }
    });
  }

  /**
   * Validate video ID format
   */
  private isValidVideoId(videoId: string): boolean {
    return /^[a-zA-Z0-9_-]{11}$/.test(videoId);
  }

  /**
   * Validate playlist ID format
   */
  private isValidPlaylistId(playlistId: string): boolean {
    return /^(PL|LL|EC|UU|FL|RD|UL|TL|PU|OLAK5uy_)[0-9A-Za-z_-]{10,}$/.test(playlistId);
  }

  /**
   * Parse proxy configuration
   */
  private parseProxy(proxy: string): any {
    const url = new URL(proxy);
    return {
      host: url.hostname,
      port: parseInt(url.port),
      ...(url.username && {
        auth: {
          username: url.username,
          password: url.password
        }
      })
    };
  }

  /**
   * Parse duration string to seconds
   */
  private parseDuration(duration: string): number {
    const parts = duration.split(':').map(p => parseInt(p, 10));
    if (parts.length === 3) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    } else if (parts.length === 2) {
      return parts[0] * 60 + parts[1];
    }
    return parts[0] || 0;
  }

  /**
   * Delay execution
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return this.cache.getStats();
  }

  /**
   * Get rate limit status
   */
  getRateLimitStatus() {
    return this.rateLimiter.getStatus();
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }
}