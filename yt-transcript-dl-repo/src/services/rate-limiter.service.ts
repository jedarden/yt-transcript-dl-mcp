import pLimit from 'p-limit';
import { RateLimitOptions } from '../types/index.js';
import winston from 'winston';

export class RateLimiterService {
  private limiter: ReturnType<typeof pLimit>;
  private requestCounts: Map<number, number>;
  private options: RateLimitOptions;
  private logger: winston.Logger;

  constructor(options: RateLimitOptions) {
    this.options = {
      maxRequests: options.maxRequests || 10,
      windowMs: options.windowMs || 60000, // 1 minute default
      delayAfterLimit: options.delayAfterLimit || 1000, // 1 second default
    };

    this.limiter = pLimit(this.options.maxRequests);
    this.requestCounts = new Map();

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

    // Clean up old request counts periodically
    setInterval(() => this.cleanupOldCounts(), this.options.windowMs);

    this.logger.info(`Rate limiter initialized: ${this.options.maxRequests} requests per ${this.options.windowMs}ms`);
  }

  /**
   * Execute a function with rate limiting
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    const now = Date.now();
    const window = Math.floor(now / this.options.windowMs);
    
    // Check if we're at the limit for this window
    const currentCount = this.requestCounts.get(window) || 0;
    
    if (currentCount >= this.options.maxRequests) {
      this.logger.warn(`Rate limit reached. Delaying for ${this.options.delayAfterLimit}ms`);
      await this.delay(this.options.delayAfterLimit);
    }

    return this.limiter(async () => {
      // Update request count
      const window = Math.floor(Date.now() / this.options.windowMs);
      this.requestCounts.set(window, (this.requestCounts.get(window) || 0) + 1);
      
      try {
        return await fn();
      } catch (error) {
        this.logger.error('Error during rate-limited execution:', error);
        throw error;
      }
    });
  }

  /**
   * Execute multiple functions with rate limiting
   */
  async executeMany<T>(fns: Array<() => Promise<T>>): Promise<T[]> {
    return Promise.all(fns.map(fn => this.execute(fn)));
  }

  /**
   * Get current rate limit status
   */
  getStatus() {
    const now = Date.now();
    const window = Math.floor(now / this.options.windowMs);
    const currentCount = this.requestCounts.get(window) || 0;
    const remaining = Math.max(0, this.options.maxRequests - currentCount);
    const resetTime = (window + 1) * this.options.windowMs;
    const resetIn = Math.max(0, resetTime - now);

    return {
      limit: this.options.maxRequests,
      remaining,
      used: currentCount,
      resetIn,
      resetAt: new Date(resetTime),
      activeCount: this.limiter.activeCount,
      pendingCount: this.limiter.pendingCount,
    };
  }

  /**
   * Wait until rate limit resets
   */
  async waitForReset(): Promise<void> {
    const status = this.getStatus();
    if (status.remaining === 0 && status.resetIn > 0) {
      this.logger.info(`Waiting ${status.resetIn}ms for rate limit reset`);
      await this.delay(status.resetIn);
    }
  }

  /**
   * Clean up old request counts
   */
  private cleanupOldCounts(): void {
    const now = Date.now();
    const currentWindow = Math.floor(now / this.options.windowMs);
    
    for (const [window] of this.requestCounts) {
      if (window < currentWindow - 1) {
        this.requestCounts.delete(window);
      }
    }
  }

  /**
   * Delay execution
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Update rate limit options
   */
  updateOptions(options: Partial<RateLimitOptions>): void {
    this.options = { ...this.options, ...options };
    this.limiter = pLimit(this.options.maxRequests);
    this.logger.info(`Rate limiter updated: ${this.options.maxRequests} requests per ${this.options.windowMs}ms`);
  }

  /**
   * Clear all pending operations
   */
  clearPending(): void {
    this.limiter.clearQueue();
    this.logger.info('Cleared all pending rate-limited operations');
  }

  /**
   * Get concurrency limit
   */
  getConcurrency(): number {
    return this.options.maxRequests;
  }
}