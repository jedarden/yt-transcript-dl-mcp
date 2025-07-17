import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { 
  CallToolRequestSchema, 
  ListToolsRequestSchema,
  McpError,
  ErrorCode
} from '@modelcontextprotocol/sdk/types.js';
import { YouTubeTranscriptService } from '../services/youtube-transcript.service.js';
import { Logger } from '../utils/logger.js';
import { McpTool } from '../types/index.js';
import { TransportManager, TransportManagerConfig } from '../transports/transport-manager.js';

export class YouTubeTranscriptMCPServer {
  private server: Server;
  private transcriptService: YouTubeTranscriptService;
  private logger: typeof Logger;
  private transportManager?: TransportManager;

  constructor() {
    this.server = new Server(
      {
        name: 'youtube-transcript-mcp',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.transcriptService = new YouTubeTranscriptService();
    this.logger = Logger;
    
    this.setupHandlers();
  }

  private setupHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: this.getAvailableTools(),
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
        case 'get_transcript':
          return await this.handleGetTranscript(args);
          
        case 'get_bulk_transcripts':
          return await this.handleGetBulkTranscripts(args);
          
        case 'get_playlist_transcripts':
          return await this.handleGetPlaylistTranscripts(args);
          
        case 'format_transcript':
          return await this.handleFormatTranscript(args);
          
        case 'get_cache_stats':
          return await this.handleGetCacheStats();
          
        case 'clear_cache':
          return await this.handleClearCache();
          
        default:
          throw new McpError(
            ErrorCode.MethodNotFound,
            `Unknown tool: ${name}`
          );
        }
      } catch (error) {
        this.logger.error(`Error handling tool call ${name}:`, error);
        throw new McpError(
          ErrorCode.InternalError,
          `Error executing tool: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    });
  }

  private getAvailableTools(): McpTool[] {
    return [
      {
        name: 'get_transcript',
        description: 'Extract transcript from a single YouTube video',
        inputSchema: {
          type: 'object',
          properties: {
            videoId: {
              type: 'string',
              description: 'YouTube video ID or URL'
            },
            language: {
              type: 'string',
              description: 'Language code (e.g., "en", "es", "fr")',
              default: 'en'
            },
            format: {
              type: 'string',
              enum: ['text', 'json', 'srt'],
              description: 'Output format',
              default: 'json'
            }
          },
          required: ['videoId']
        }
      },
      {
        name: 'get_bulk_transcripts',
        description: 'Extract transcripts from multiple YouTube videos',
        inputSchema: {
          type: 'object',
          properties: {
            videoIds: {
              type: 'array',
              items: { type: 'string' },
              description: 'Array of YouTube video IDs or URLs'
            },
            language: {
              type: 'string',
              description: 'Language code (e.g., "en", "es", "fr")',
              default: 'en'
            },
            outputFormat: {
              type: 'string',
              enum: ['text', 'json', 'srt'],
              description: 'Output format',
              default: 'json'
            },
            includeMetadata: {
              type: 'boolean',
              description: 'Include metadata in response',
              default: true
            }
          },
          required: ['videoIds']
        }
      },
      {
        name: 'get_playlist_transcripts',
        description: 'Extract transcripts from all videos in a YouTube playlist',
        inputSchema: {
          type: 'object',
          properties: {
            playlistId: {
              type: 'string',
              description: 'YouTube playlist ID or URL'
            },
            language: {
              type: 'string',
              description: 'Language code (e.g., "en", "es", "fr")',
              default: 'en'
            },
            outputFormat: {
              type: 'string',
              enum: ['text', 'json', 'srt'],
              description: 'Output format',
              default: 'json'
            },
            includeMetadata: {
              type: 'boolean',
              description: 'Include metadata in response',
              default: true
            }
          },
          required: ['playlistId']
        }
      },
      {
        name: 'format_transcript',
        description: 'Format existing transcript data into different formats',
        inputSchema: {
          type: 'object',
          properties: {
            transcript: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  text: { type: 'string' },
                  start: { type: 'number' },
                  duration: { type: 'number' }
                }
              },
              description: 'Transcript data to format'
            },
            format: {
              type: 'string',
              enum: ['text', 'json', 'srt'],
              description: 'Output format',
              default: 'json'
            }
          },
          required: ['transcript', 'format']
        }
      },
      {
        name: 'get_cache_stats',
        description: 'Get cache statistics and performance metrics',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      },
      {
        name: 'clear_cache',
        description: 'Clear the transcript cache',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      }
    ];
  }

  private async handleGetTranscript(args: any) {
    const { videoId, language = 'en', format = 'json' } = args;
    
    if (!videoId) {
      throw new McpError(ErrorCode.InvalidParams, 'videoId is required');
    }

    const result = await this.transcriptService.getTranscript(videoId, language, format);
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2)
      }]
    };
  }

  private async handleGetBulkTranscripts(args: any) {
    const { videoIds, language = 'en', outputFormat = 'json', includeMetadata = true } = args;
    
    if (!videoIds || !Array.isArray(videoIds) || videoIds.length === 0) {
      throw new McpError(ErrorCode.InvalidParams, 'videoIds array is required');
    }

    const request = {
      videoIds,
      language,
      outputFormat,
      includeMetadata
    };

    const result = await this.transcriptService.getBulkTranscripts(request);
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2)
      }]
    };
  }

  private async handleGetPlaylistTranscripts(args: any) {
    const { playlistId, language = 'en', outputFormat = 'json', includeMetadata = true } = args;
    
    if (!playlistId) {
      throw new McpError(ErrorCode.InvalidParams, 'playlistId is required');
    }

    const request = {
      playlistId,
      language,
      outputFormat,
      includeMetadata
    };

    const result = await this.transcriptService.getPlaylistTranscripts(request);
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2)
      }]
    };
  }

  private async handleFormatTranscript(args: any) {
    const { transcript, format } = args;
    
    if (!transcript || !format) {
      throw new McpError(ErrorCode.InvalidParams, 'transcript and format are required');
    }

    const result = this.transcriptService.formatTranscript(transcript, format);
    
    return {
      content: [{
        type: 'text',
        text: result
      }]
    };
  }

  private async handleGetCacheStats() {
    const stats = this.transcriptService.getCacheStats();
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(stats, null, 2)
      }]
    };
  }

  private async handleClearCache() {
    this.transcriptService.clearCache();
    
    return {
      content: [{
        type: 'text',
        text: 'Cache cleared successfully'
      }]
    };
  }

  public async start(): Promise<void> {
    // Check if multi-transport mode is enabled
    const multiTransport = process.env.MCP_MULTI_TRANSPORT === 'true';
    
    if (multiTransport) {
      // Use transport manager for concurrent transports
      const config: TransportManagerConfig = {
        stdio: {
          enabled: process.env.STDIO_ENABLED !== 'false'
        },
        sse: {
          enabled: process.env.SSE_ENABLED !== 'false',
          port: parseInt(process.env.SSE_PORT || '3001', 10),
          host: process.env.SSE_HOST || '0.0.0.0'
        },
        http: {
          enabled: process.env.HTTP_ENABLED !== 'false',
          port: parseInt(process.env.HTTP_PORT || '3002', 10),
          host: process.env.HTTP_HOST || '0.0.0.0'
        }
      };

      this.transportManager = new TransportManager(this.server, config);
      await this.transportManager.startAll();
      
      this.logger.info('YouTube Transcript MCP Server started with multiple transports');
      this.logger.info('Transport status:', this.transportManager.getStatus());
    } else {
      // Legacy single transport mode (backward compatibility)
      const transport = process.env.MCP_TRANSPORT || 'stdio';
      
      if (transport === 'stdio') {
        const transport = new StdioServerTransport();
        await this.server.connect(transport);
      } else {
        throw new Error(`Unsupported transport: ${transport}`);
      }

      this.logger.info('YouTube Transcript MCP Server started (single transport mode)');
    }
  }

  public async stop(): Promise<void> {
    if (this.transportManager) {
      await this.transportManager.stopAll();
    }
    this.logger.info('YouTube Transcript MCP Server stopped');
  }

  public getServer(): Server {
    return this.server;
  }

  public getTransportStatus(): any {
    if (this.transportManager) {
      return this.transportManager.getStatus();
    }
    return { mode: 'single', transport: process.env.MCP_TRANSPORT || 'stdio' };
  }
}