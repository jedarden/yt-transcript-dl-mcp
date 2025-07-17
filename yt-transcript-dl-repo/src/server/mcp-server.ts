import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ToolSchema,
  TextContent,
  ImageContent,
  ErrorCode as MCPErrorCode,
  McpError
} from '@modelcontextprotocol/sdk/types.js';
import {
  YouTubeExtractorService,
  BulkProcessorService,
  FormatterService,
  ExtractorConfig,
  TranscriptOptions,
  FormatOptions,
  BulkProcessOptions
} from '../services/index.js';
import winston from 'winston';
import { z } from 'zod';

// Tool schemas
const ExtractTranscriptSchema = z.object({
  videoId: z.string().describe('YouTube video ID (11 characters)'),
  language: z.string().optional().describe('Preferred language code (e.g., "en", "es")'),
  format: z.enum(['text', 'json', 'srt', 'vtt']).optional().describe('Output format'),
  includeTimestamps: z.boolean().optional().describe('Include timestamps in text format'),
  includeMetadata: z.boolean().optional().describe('Include video metadata')
});

const ExtractPlaylistSchema = z.object({
  playlistId: z.string().describe('YouTube playlist ID'),
  language: z.string().optional().describe('Preferred language code'),
  format: z.enum(['text', 'json', 'srt', 'vtt']).optional().describe('Output format'),
  concurrency: z.number().min(1).max(10).optional().describe('Number of concurrent requests')
});

const BulkExtractSchema = z.object({
  videoIds: z.array(z.string()).describe('Array of YouTube video IDs'),
  language: z.string().optional().describe('Preferred language code'),
  format: z.enum(['text', 'json', 'srt', 'vtt']).optional().describe('Output format'),
  concurrency: z.number().min(1).max(10).optional().describe('Number of concurrent requests'),
  includeProgress: z.boolean().optional().describe('Include progress updates')
});

const GetCacheStatsSchema = z.object({});
const ClearCacheSchema = z.object({});
const GetRateLimitStatusSchema = z.object({});

export class YouTubeTranscriptMCPServer {
  private server: Server;
  private extractor: YouTubeExtractorService;
  private bulkProcessor: BulkProcessorService;
  private formatter: FormatterService;
  private logger: winston.Logger;

  constructor(config?: ExtractorConfig) {
    this.server = new Server(
      {
        name: 'youtube-transcript-extractor',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {}
        }
      }
    );

    this.extractor = new YouTubeExtractorService(config);
    this.bulkProcessor = new BulkProcessorService(this.extractor);
    this.formatter = new FormatterService();

    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
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

    this.setupHandlers();
  }

  private setupHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'extract_transcript',
          description: 'Extract transcript from a YouTube video',
          inputSchema: {
            type: 'object',
            properties: {
              videoId: { type: 'string', description: 'YouTube video ID (11 characters)' },
              language: { type: 'string', description: 'Preferred language code (e.g., "en", "es")' },
              format: { 
                type: 'string', 
                enum: ['text', 'json', 'srt', 'vtt'],
                description: 'Output format'
              },
              includeTimestamps: { type: 'boolean', description: 'Include timestamps in text format' },
              includeMetadata: { type: 'boolean', description: 'Include video metadata' }
            },
            required: ['videoId']
          }
        },
        {
          name: 'extract_playlist',
          description: 'Extract transcripts from all videos in a YouTube playlist',
          inputSchema: {
            type: 'object',
            properties: {
              playlistId: { type: 'string', description: 'YouTube playlist ID' },
              language: { type: 'string', description: 'Preferred language code' },
              format: { 
                type: 'string', 
                enum: ['text', 'json', 'srt', 'vtt'],
                description: 'Output format'
              },
              concurrency: { 
                type: 'number', 
                minimum: 1, 
                maximum: 10,
                description: 'Number of concurrent requests'
              }
            },
            required: ['playlistId']
          }
        },
        {
          name: 'bulk_extract',
          description: 'Extract transcripts from multiple YouTube videos',
          inputSchema: {
            type: 'object',
            properties: {
              videoIds: { 
                type: 'array', 
                items: { type: 'string' },
                description: 'Array of YouTube video IDs' 
              },
              language: { type: 'string', description: 'Preferred language code' },
              format: { 
                type: 'string', 
                enum: ['text', 'json', 'srt', 'vtt'],
                description: 'Output format'
              },
              concurrency: { 
                type: 'number', 
                minimum: 1, 
                maximum: 10,
                description: 'Number of concurrent requests'
              },
              includeProgress: { 
                type: 'boolean', 
                description: 'Include progress updates' 
              }
            },
            required: ['videoIds']
          }
        },
        {
          name: 'get_cache_stats',
          description: 'Get cache statistics',
          inputSchema: { type: 'object', properties: {} }
        },
        {
          name: 'clear_cache',
          description: 'Clear all cached transcripts',
          inputSchema: { type: 'object', properties: {} }
        },
        {
          name: 'get_rate_limit_status',
          description: 'Get current rate limit status',
          inputSchema: { type: 'object', properties: {} }
        }
      ]
    }));

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'extract_transcript':
            return await this.handleExtractTranscript(args);
          case 'extract_playlist':
            return await this.handleExtractPlaylist(args);
          case 'bulk_extract':
            return await this.handleBulkExtract(args);
          case 'get_cache_stats':
            return await this.handleGetCacheStats();
          case 'clear_cache':
            return await this.handleClearCache();
          case 'get_rate_limit_status':
            return await this.handleGetRateLimitStatus();
          default:
            throw new McpError(MCPErrorCode.MethodNotFound, `Unknown tool: ${name}`);
        }
      } catch (error) {
        this.logger.error(`Error in tool ${name}:`, error);
        
        if (error instanceof McpError) {
          throw error;
        }
        
        throw new McpError(
          MCPErrorCode.InternalError,
          error instanceof Error ? error.message : 'Unknown error occurred'
        );
      }
    });
  }

  private async handleExtractTranscript(args: unknown) {
    const params = ExtractTranscriptSchema.parse(args);
    
    try {
      // Extract transcript
      const transcript = await this.extractor.extractTranscript(params.videoId, {
        lang: params.language
      });

      // Format if requested
      let content: string;
      if (params.format) {
        const formatOptions: FormatOptions = {
          format: params.format,
          includeTimestamps: params.includeTimestamps,
          includeMetadata: params.includeMetadata,
          prettify: true
        };
        content = this.formatter.format(transcript, formatOptions);
      } else {
        content = JSON.stringify(transcript, null, 2);
      }

      return {
        content: [{ type: 'text', text: content } as TextContent]
      };
    } catch (error) {
      this.logger.error('Transcript extraction failed:', error);
      throw new McpError(
        MCPErrorCode.InternalError,
        `Failed to extract transcript: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private async handleExtractPlaylist(args: unknown) {
    const params = ExtractPlaylistSchema.parse(args);
    
    try {
      const formatOptions = params.format ? {
        format: params.format,
        includeTimestamps: false,
        includeMetadata: true,
        prettify: true
      } as FormatOptions : undefined;

      const result = await this.bulkProcessor.processPlaylist(
        params.playlistId,
        { lang: params.language },
        formatOptions,
        params.concurrency || 3
      );

      const report = this.bulkProcessor.generateReport(result.results);
      
      const content = {
        playlistInfo: result.playlistInfo,
        summary: {
          total: report.total,
          successful: report.successful,
          failed: report.failed,
          successRate: `${report.successRate.toFixed(1)}%`,
          languages: report.languages,
          totalDuration: `${Math.floor(report.totalDuration / 60)} minutes`
        },
        results: formatOptions 
          ? result.results.filter(r => r.success).map(r => ({
              videoId: r.videoId,
              content: r.formatted
            }))
          : result.results
      };

      return {
        content: [{ type: 'text', text: JSON.stringify(content, null, 2) } as TextContent]
      };
    } catch (error) {
      this.logger.error('Playlist extraction failed:', error);
      throw new McpError(
        MCPErrorCode.InternalError,
        `Failed to extract playlist: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private async handleBulkExtract(args: unknown) {
    const params = BulkExtractSchema.parse(args);
    
    try {
      const formatOptions = params.format ? {
        format: params.format,
        includeTimestamps: false,
        includeMetadata: true,
        prettify: true
      } as FormatOptions : undefined;

      const progressUpdates: any[] = [];
      
      const results = await this.bulkProcessor.processBulk({
        videoIds: params.videoIds,
        options: { lang: params.language },
        format: formatOptions,
        concurrency: params.concurrency || 3,
        onProgress: params.includeProgress ? (progress) => {
          progressUpdates.push({
            timestamp: new Date().toISOString(),
            ...progress
          });
        } : undefined
      });

      const report = this.bulkProcessor.generateReport(results);
      
      const content = {
        summary: {
          total: report.total,
          successful: report.successful,
          failed: report.failed,
          successRate: `${report.successRate.toFixed(1)}%`,
          languages: report.languages,
          errors: report.errors
        },
        results: formatOptions 
          ? results.filter(r => r.success).map(r => ({
              videoId: r.videoId,
              content: r.formatted
            }))
          : results,
        ...(params.includeProgress && { progressHistory: progressUpdates })
      };

      return {
        content: [{ type: 'text', text: JSON.stringify(content, null, 2) } as TextContent]
      };
    } catch (error) {
      this.logger.error('Bulk extraction failed:', error);
      throw new McpError(
        MCPErrorCode.InternalError,
        `Failed to extract videos: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private async handleGetCacheStats() {
    const stats = this.extractor.getCacheStats();
    
    return {
      content: [{ 
        type: 'text', 
        text: JSON.stringify(stats, null, 2) 
      } as TextContent]
    };
  }

  private async handleClearCache() {
    this.extractor.clearCache();
    
    return {
      content: [{ 
        type: 'text', 
        text: 'Cache cleared successfully' 
      } as TextContent]
    };
  }

  private async handleGetRateLimitStatus() {
    const status = this.extractor.getRateLimitStatus();
    
    return {
      content: [{ 
        type: 'text', 
        text: JSON.stringify(status, null, 2) 
      } as TextContent]
    };
  }

  async start() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    this.logger.info('YouTube Transcript MCP Server started');
  }
}

// Start server if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new YouTubeTranscriptMCPServer();
  server.start().catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
}