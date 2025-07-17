import NodeCache from 'node-cache';
import { Logger } from './logger.js';

export class Cache {
  private cache: NodeCache;
  private enabled: boolean;

  constructor(ttl: number = 3600, maxSize: number = 1000, enabled: boolean = true) {
    this.enabled = enabled;
    this.cache = new NodeCache({
      stdTTL: ttl,
      checkperiod: 120,
      maxKeys: maxSize,
      useClones: false
    });

    // Setup cache event listeners
    this.cache.on('set', (key, value) => {
      Logger.debug(`Cache SET: ${key}`, { size: this.cache.getStats().keys });
    });

    this.cache.on('del', (key, value) => {
      Logger.debug(`Cache DEL: ${key}`, { size: this.cache.getStats().keys });
    });

    this.cache.on('expired', (key, value) => {
      Logger.debug(`Cache EXPIRED: ${key}`, { size: this.cache.getStats().keys });
    });
  }

  public get<T>(key: string): T | undefined {
    if (!this.enabled) return undefined;
    
    const value = this.cache.get<T>(key);
    if (value) {
      Logger.debug(`Cache HIT: ${key}`);
    } else {
      Logger.debug(`Cache MISS: ${key}`);
    }
    return value;
  }

  public set<T>(key: string, value: T, ttl?: number): boolean {
    if (!this.enabled) return false;
    
    const success = this.cache.set(key, value, ttl || 0);
    Logger.debug(`Cache SET: ${key}`, { success, ttl });
    return success;
  }

  public del(key: string): number {
    if (!this.enabled) return 0;
    
    const deleted = this.cache.del(key);
    Logger.debug(`Cache DEL: ${key}`, { deleted });
    return deleted;
  }

  public flush(): void {
    if (!this.enabled) return;
    
    this.cache.flushAll();
    Logger.debug('Cache flushed');
  }

  public getStats(): NodeCache.Stats {
    return this.cache.getStats();
  }

  public getKeys(): string[] {
    return this.cache.keys();
  }

  public has(key: string): boolean {
    if (!this.enabled) return false;
    return this.cache.has(key);
  }

  public getTtl(key: string): number | undefined {
    if (!this.enabled) return undefined;
    const ttl = this.cache.getTtl(key);
    return ttl ? ttl : undefined;
  }

  public setTtl(key: string, ttl: number): boolean {
    if (!this.enabled) return false;
    return this.cache.ttl(key, ttl);
  }

  public enable(): void {
    this.enabled = true;
    Logger.info('Cache enabled');
  }

  public disable(): void {
    this.enabled = false;
    Logger.info('Cache disabled');
  }

  public isEnabled(): boolean {
    return this.enabled;
  }
}

export default Cache;