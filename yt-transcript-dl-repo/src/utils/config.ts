import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { z } from 'zod';
import dotenv from 'dotenv';
import type { MCPServerConfig } from '../types/config.js';

// Load environment variables
dotenv.config();

const ConfigSchema = z.object({
  name: z.string().default('yt-transcript-mcp-server'),
  version: z.string().default('1.0.0'),
  logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  transports: z.object({
    stdio: z.object({
      enabled: z.boolean().default(true)
    }).optional(),
    sse: z.object({
      enabled: z.boolean().default(true),
      port: z.number().default(3456),
      host: z.string().default('0.0.0.0'),
      cors: z.object({
        origin: z.union([z.string(), z.array(z.string())]).default('*'),
        credentials: z.boolean().default(false)
      }).optional(),
      keepAliveInterval: z.number().default(30000),
      maxClients: z.number().default(100)
    }).optional(),
    http: z.object({
      enabled: z.boolean().default(true),
      port: z.number().default(3457),
      host: z.string().default('0.0.0.0'),
      cors: z.object({
        origin: z.union([z.string(), z.array(z.string())]).default('*'),
        credentials: z.boolean().default(false)
      }).optional(),
      maxBodySize: z.string().default('10mb'),
      timeout: z.number().default(30000),
      rateLimit: z.object({
        windowMs: z.number().default(60000),
        max: z.number().default(100)
      }).optional()
    }).optional()
  }).default({})
});

export function loadConfig(configPath?: string): MCPServerConfig {
  let config: any = {};

  // Load from file if provided
  if (configPath && existsSync(configPath)) {
    try {
      const fileContent = readFileSync(configPath, 'utf-8');
      config = JSON.parse(fileContent);
    } catch (error) {
      console.error(`Failed to load config from ${configPath}:`, error);
    }
  }

  // Override with environment variables
  config = {
    ...config,
    name: process.env.MCP_SERVER_NAME || config.name,
    version: process.env.MCP_SERVER_VERSION || config.version,
    logLevel: process.env.MCP_LOG_LEVEL || config.logLevel,
    transports: {
      stdio: {
        enabled: process.env.MCP_STDIO_ENABLED !== 'false',
        ...config.transports?.stdio
      },
      sse: {
        enabled: process.env.MCP_SSE_ENABLED !== 'false',
        port: process.env.MCP_SSE_PORT ? parseInt(process.env.MCP_SSE_PORT) : config.transports?.sse?.port,
        host: process.env.MCP_SSE_HOST || config.transports?.sse?.host,
        ...config.transports?.sse
      },
      http: {
        enabled: process.env.MCP_HTTP_ENABLED !== 'false',
        port: process.env.MCP_HTTP_PORT ? parseInt(process.env.MCP_HTTP_PORT) : config.transports?.http?.port,
        host: process.env.MCP_HTTP_HOST || config.transports?.http?.host,
        ...config.transports?.http
      }
    }
  };

  // Validate and return config
  return ConfigSchema.parse(config);
}

export function getDefaultConfig(): MCPServerConfig {
  return ConfigSchema.parse({});
}