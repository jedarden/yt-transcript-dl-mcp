import { ServerConfig, TransportConfig } from '../types/index.js';

export const defaultServerConfig: ServerConfig = {
  port: parseInt(process.env.PORT || '3000', 10),
  host: process.env.HOST || '0.0.0.0',
  cors: {
    enabled: process.env.CORS_ENABLED !== 'false',
    origins: process.env.CORS_ORIGINS?.split(',') || ['*']
  },
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW || '900000', 10), // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10)
  },
  cache: {
    enabled: process.env.CACHE_ENABLED !== 'false',
    ttl: parseInt(process.env.CACHE_TTL || '3600', 10), // 1 hour
    maxSize: parseInt(process.env.CACHE_MAX_SIZE || '1000', 10)
  },
  logging: {
    level: (process.env.LOG_LEVEL as any) || 'info',
    format: (process.env.LOG_FORMAT as any) || 'simple'
  }
};

export const defaultTransportConfig: TransportConfig = {
  stdio: {
    enabled: process.env.STDIO_ENABLED !== 'false'
  },
  sse: {
    enabled: process.env.SSE_ENABLED !== 'false',
    endpoint: process.env.SSE_ENDPOINT || '/events'
  },
  http: {
    enabled: process.env.HTTP_ENABLED !== 'false',
    endpoint: process.env.HTTP_ENDPOINT || '/api'
  }
};

export function validateConfig(config: ServerConfig): void {
  if (config.port < 1 || config.port > 65535) {
    throw new Error('Port must be between 1 and 65535');
  }

  if (config.rateLimit.windowMs < 1000) {
    throw new Error('Rate limit window must be at least 1 second');
  }

  if (config.rateLimit.max < 1) {
    throw new Error('Rate limit max must be at least 1');
  }

  if (config.cache.ttl < 1) {
    throw new Error('Cache TTL must be at least 1 second');
  }

  if (config.cache.maxSize < 1) {
    throw new Error('Cache max size must be at least 1');
  }

  if (!['debug', 'info', 'warn', 'error'].includes(config.logging.level)) {
    throw new Error('Log level must be one of: debug, info, warn, error');
  }

  if (!['json', 'simple'].includes(config.logging.format)) {
    throw new Error('Log format must be one of: json, simple');
  }
}

export function mergeConfig(
  defaultConfig: ServerConfig,
  userConfig: Partial<ServerConfig>
): ServerConfig {
  return {
    ...defaultConfig,
    ...userConfig,
    cors: {
      ...defaultConfig.cors,
      ...userConfig.cors
    },
    rateLimit: {
      ...defaultConfig.rateLimit,
      ...userConfig.rateLimit
    },
    cache: {
      ...defaultConfig.cache,
      ...userConfig.cache
    },
    logging: {
      ...defaultConfig.logging,
      ...userConfig.logging
    }
  };
}