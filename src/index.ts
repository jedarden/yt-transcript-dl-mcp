#!/usr/bin/env node

import { YouTubeTranscriptMCPServer } from './server/mcp-server.js';
import { Logger } from './utils/logger.js';
import { defaultServerConfig } from './utils/config.js';

async function main(): Promise<void> {
  try {
    // Initialize logger
    Logger.getInstance(defaultServerConfig.logging);
    
    // Create and start MCP server
    const mcpServer = new YouTubeTranscriptMCPServer();
    
    Logger.info('Starting YouTube Transcript MCP Server...');
    await mcpServer.start();
    
    // Log transport status
    const status = mcpServer.getTransportStatus();
    Logger.info('Transport status:', status);
    
  } catch (error) {
    Logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  Logger.info('Received SIGINT, shutting down gracefully...');
  try {
    const mcpServer = new YouTubeTranscriptMCPServer();
    await mcpServer.stop();
  } catch (error) {
    Logger.error('Error during shutdown:', error);
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  Logger.info('Received SIGTERM, shutting down gracefully...');
  try {
    const mcpServer = new YouTubeTranscriptMCPServer();
    await mcpServer.stop();
  } catch (error) {
    Logger.error('Error during shutdown:', error);
  }
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  Logger.error('Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  Logger.error('Unhandled rejection:', reason);
  process.exit(1);
});

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    Logger.error('Error in main:', error);
    process.exit(1);
  });
}