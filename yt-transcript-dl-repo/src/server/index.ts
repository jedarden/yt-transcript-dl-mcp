#!/usr/bin/env node

import { YouTubeTranscriptMCPServer } from './mcp-server.js';
import { ExtractorConfig } from '../types/index.js';

// Load configuration from environment variables
const config: ExtractorConfig = {
  cache: {
    ttl: parseInt(process.env.CACHE_TTL || '3600'),
    maxSize: parseInt(process.env.CACHE_MAX_SIZE || '100'),
    namespace: process.env.CACHE_NAMESPACE || 'transcripts'
  },
  rateLimit: {
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '10'),
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000'),
    delayAfterLimit: parseInt(process.env.RATE_LIMIT_DELAY || '1000')
  },
  userAgent: process.env.USER_AGENT,
  proxy: process.env.PROXY_URL,
  timeout: parseInt(process.env.REQUEST_TIMEOUT || '30000'),
  retryAttempts: parseInt(process.env.RETRY_ATTEMPTS || '3'),
  retryDelay: parseInt(process.env.RETRY_DELAY || '1000')
};

// Create and start server
const server = new YouTubeTranscriptMCPServer(config);

server.start().catch((error) => {
  console.error('Failed to start YouTube Transcript MCP Server:', error);
  process.exit(1);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down server...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('Shutting down server...');
  process.exit(0);
});