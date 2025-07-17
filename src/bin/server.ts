#!/usr/bin/env node

import { Command } from 'commander';
import { YouTubeTranscriptMCPServer } from '../server/mcp-server.js';
import { Logger } from '../utils/logger.js';
import { defaultServerConfig } from '../utils/config.js';

const program = new Command();

program
  .name('yt-transcript-dl-mcp')
  .description('YouTube Transcript Download MCP Server')
  .version('1.0.0');

program
  .command('start')
  .description('Start the MCP server')
  .option('-t, --transport <type>', 'Transport type (stdio, sse, http)', 'stdio')
  .option('-p, --port <port>', 'Port for HTTP/SSE transport', '3000')
  .option('-v, --verbose', 'Enable verbose logging')
  .action(async (options) => {
    try {
      // Configure logging
      const logLevel = options.verbose ? 'debug' : 'info';
      Logger.getInstance({ ...defaultServerConfig.logging, level: logLevel });
      
      // Set transport environment variable
      process.env.MCP_TRANSPORT = options.transport;
      process.env.PORT = options.port;
      
      // Create and start server
      const server = new YouTubeTranscriptMCPServer();
      Logger.info(`Starting server with ${options.transport} transport on port ${options.port}...`);
      await server.start();
      
    } catch (error) {
      Logger.error('Failed to start server:', error);
      process.exit(1);
    }
  });

program
  .command('test')
  .description('Test the server with a sample video')
  .argument('<video-id>', 'YouTube video ID to test')
  .option('-l, --language <lang>', 'Language code', 'en')
  .option('-f, --format <format>', 'Output format (text, json, srt)', 'json')
  .action(async (videoId, options) => {
    try {
      const { YouTubeTranscriptService } = await import('../services/youtube-transcript.service.js');
      const service = new YouTubeTranscriptService();
      
      Logger.info(`Testing transcript extraction for video: ${videoId}`);
      const result = await service.getTranscript(videoId, options.language, options.format);
      
      if (result.metadata?.error) {
        Logger.error('Error:', result.metadata.error);
        process.exit(1);
      } else {
        console.log(JSON.stringify(result, null, 2));
      }
      
    } catch (error) {
      Logger.error('Test failed:', error);
      process.exit(1);
    }
  });

program.parse();