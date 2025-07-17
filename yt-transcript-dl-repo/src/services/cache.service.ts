import { LRUCache } from 'lru-cache';
import { VideoTranscript, CacheOptions } from '../types/index.js';
import winston from 'winston';

export class CacheService {
  private cache: LRUCache<string, VideoTranscript>;
  private logger: winston.Logger;

  constructor(options: CacheOptions = {}) {
    const {
      ttl = 3600000, // 1 hour default
      maxSize = 100,
      namespace = 'transcripts'
    } = options;

    this.cache = new LRUCache<string, VideoTranscript>({
      max: maxSize,
      ttl: ttl * 1000, // Convert seconds to milliseconds
      updateAgeOnGet: true,
      updateAgeOnHas: true,
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

    this.logger.info(`Cache service initialized with namespace: ${namespace}, maxSize: ${maxSize}, ttl: ${ttl}s`);
  }

  /**
   * Get a transcript from cache
   */
  get(videoId: string, lang?: string): VideoTranscript | undefined {
    const key = this.generateKey(videoId, lang);
    const cached = this.cache.get(key);
    
    if (cached) {
      this.logger.debug(`Cache hit for video: ${videoId}, lang: ${lang || 'default'}`);
    } else {
      this.logger.debug(`Cache miss for video: ${videoId}, lang: ${lang || 'default'}`);
    }
    
    return cached;
  }

  /**
   * Set a transcript in cache
   */
  set(videoId: string, transcript: VideoTranscript, lang?: string): void {
    const key = this.generateKey(videoId, lang);
    this.cache.set(key, transcript);
    this.logger.debug(`Cached transcript for video: ${videoId}, lang: ${lang || 'default'}`);
  }

  /**
   * Check if a transcript exists in cache
   */
  has(videoId: string, lang?: string): boolean {
    const key = this.generateKey(videoId, lang);
    return this.cache.has(key);
  }

  /**
   * Delete a transcript from cache
   */
  delete(videoId: string, lang?: string): boolean {
    const key = this.generateKey(videoId, lang);
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.logger.debug(`Deleted cached transcript for video: ${videoId}, lang: ${lang || 'default'}`);
    }
    return deleted;
  }

  /**
   * Clear all cached transcripts
   */
  clear(): void {
    const size = this.cache.size;
    this.cache.clear();
    this.logger.info(`Cleared ${size} items from cache`);
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.cache.max,
      calculatedSize: this.cache.calculatedSize,
      disposed: this.cache.disposed,
      hits: this.cache.size > 0 ? 'Available' : 'Empty',
    };
  }

  /**
   * Generate cache key
   */
  private generateKey(videoId: string, lang?: string): string {
    return lang ? `${videoId}:${lang}` : videoId;
  }

  /**
   * Prune expired entries
   */
  prune(): number {
    const beforeSize = this.cache.size;
    this.cache.purgeStale();
    const pruned = beforeSize - this.cache.size;
    if (pruned > 0) {
      this.logger.info(`Pruned ${pruned} expired entries from cache`);
    }
    return pruned;
  }

  /**
   * Get all cached video IDs
   */
  getCachedVideoIds(): string[] {
    const videoIds = new Set<string>();
    for (const key of this.cache.keys()) {
      const videoId = key.split(':')[0];
      videoIds.add(videoId);
    }
    return Array.from(videoIds);
  }

  /**
   * Batch get multiple transcripts
   */
  getMany(videoIds: string[], lang?: string): Map<string, VideoTranscript | undefined> {
    const results = new Map<string, VideoTranscript | undefined>();
    for (const videoId of videoIds) {
      results.set(videoId, this.get(videoId, lang));
    }
    return results;
  }

  /**
   * Batch set multiple transcripts
   */
  setMany(transcripts: Map<string, VideoTranscript>, lang?: string): void {
    for (const [videoId, transcript] of transcripts) {
      this.set(videoId, transcript, lang);
    }
  }
}