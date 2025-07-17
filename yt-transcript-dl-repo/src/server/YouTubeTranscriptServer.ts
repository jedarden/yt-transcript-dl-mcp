import { MCPServer } from './MCPServer.js';
import type { MCPServerConfig } from '../types/config.js';
import { z } from 'zod';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';

// Tool schemas
const GetTranscriptSchema = z.object({
  url: z.string().url().optional(),
  videoId: z.string().optional(),
  lang: z.string().default('en'),
  format: z.enum(['text', 'json', 'srt', 'vtt']).default('text')
}).refine(data => data.url || data.videoId, {
  message: 'Either url or videoId must be provided'
});

const SearchTranscriptSchema = z.object({
  url: z.string().url().optional(),
  videoId: z.string().optional(),
  query: z.string(),
  caseSensitive: z.boolean().default(false),
  maxResults: z.number().default(10)
}).refine(data => data.url || data.videoId, {
  message: 'Either url or videoId must be provided'
});

const GetMetadataSchema = z.object({
  url: z.string().url().optional(),
  videoId: z.string().optional()
}).refine(data => data.url || data.videoId, {
  message: 'Either url or videoId must be provided'
});

export class YouTubeTranscriptServer extends MCPServer {
  constructor(config: MCPServerConfig) {
    super(config);
    this.logger.info('Initializing YouTube Transcript MCP Server');
  }

  protected async handleListResources(): Promise<any> {
    return {
      resources: [
        {
          uri: 'transcript://recent',
          name: 'Recent Transcripts',
          description: 'List of recently fetched transcripts',
          mimeType: 'application/json'
        },
        {
          uri: 'transcript://cache',
          name: 'Cached Transcripts',
          description: 'All cached transcripts',
          mimeType: 'application/json'
        }
      ]
    };
  }

  protected async handleReadResource(uri: string): Promise<any> {
    if (uri === 'transcript://recent') {
      // Return recent transcripts from cache/memory
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify({
              transcripts: [],
              message: 'No recent transcripts available'
            })
          }
        ]
      };
    }

    if (uri === 'transcript://cache') {
      // Return all cached transcripts
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify({
              transcripts: [],
              message: 'Cache not implemented yet'
            })
          }
        ]
      };
    }

    throw new McpError(ErrorCode.ResourceNotFound, `Resource not found: ${uri}`);
  }

  protected async handleListTools(): Promise<any> {
    return {
      tools: [
        {
          name: 'get_transcript',
          description: 'Get transcript for a YouTube video',
          inputSchema: {
            type: 'object',
            properties: {
              url: {
                type: 'string',
                description: 'YouTube video URL'
              },
              videoId: {
                type: 'string',
                description: 'YouTube video ID'
              },
              lang: {
                type: 'string',
                description: 'Language code (default: en)',
                default: 'en'
              },
              format: {
                type: 'string',
                enum: ['text', 'json', 'srt', 'vtt'],
                description: 'Output format (default: text)',
                default: 'text'
              }
            },
            oneOf: [
              { required: ['url'] },
              { required: ['videoId'] }
            ]
          }
        },
        {
          name: 'search_transcript',
          description: 'Search within a YouTube video transcript',
          inputSchema: {
            type: 'object',
            properties: {
              url: {
                type: 'string',
                description: 'YouTube video URL'
              },
              videoId: {
                type: 'string',
                description: 'YouTube video ID'
              },
              query: {
                type: 'string',
                description: 'Search query'
              },
              caseSensitive: {
                type: 'boolean',
                description: 'Case sensitive search (default: false)',
                default: false
              },
              maxResults: {
                type: 'number',
                description: 'Maximum number of results (default: 10)',
                default: 10
              }
            },
            required: ['query'],
            oneOf: [
              { required: ['url'] },
              { required: ['videoId'] }
            ]
          }
        },
        {
          name: 'get_video_metadata',
          description: 'Get metadata for a YouTube video',
          inputSchema: {
            type: 'object',
            properties: {
              url: {
                type: 'string',
                description: 'YouTube video URL'
              },
              videoId: {
                type: 'string',
                description: 'YouTube video ID'
              }
            },
            oneOf: [
              { required: ['url'] },
              { required: ['videoId'] }
            ]
          }
        }
      ]
    };
  }

  protected async handleCallTool(name: string, args: any): Promise<any> {
    this.logger.debug({ tool: name, args }, 'Handling tool call');

    try {
      switch (name) {
        case 'get_transcript':
          return await this.getTranscript(args);
        case 'search_transcript':
          return await this.searchTranscript(args);
        case 'get_video_metadata':
          return await this.getVideoMetadata(args);
        default:
          throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
      }
    } catch (error) {
      this.logger.error({ error, tool: name }, 'Tool execution failed');
      
      if (error instanceof McpError) {
        throw error;
      }
      
      throw new McpError(
        ErrorCode.InternalError,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  private async getTranscript(args: any): Promise<any> {
    const params = GetTranscriptSchema.parse(args);
    
    // Extract video ID from URL if provided
    const videoId = params.videoId || this.extractVideoId(params.url!);
    
    this.logger.info({ videoId, lang: params.lang, format: params.format }, 'Fetching transcript');

    // TODO: Integrate with YouTube API service
    // For now, return a mock response
    return {
      content: [
        {
          type: 'text',
          text: `Mock transcript for video ${videoId} in ${params.lang} format: ${params.format}`
        }
      ]
    };
  }

  private async searchTranscript(args: any): Promise<any> {
    const params = SearchTranscriptSchema.parse(args);
    
    const videoId = params.videoId || this.extractVideoId(params.url!);
    
    this.logger.info({ 
      videoId, 
      query: params.query, 
      caseSensitive: params.caseSensitive 
    }, 'Searching transcript');

    // TODO: Integrate with YouTube API service
    return {
      content: [
        {
          type: 'text',
          text: `Mock search results for "${params.query}" in video ${videoId}`
        }
      ]
    };
  }

  private async getVideoMetadata(args: any): Promise<any> {
    const params = GetMetadataSchema.parse(args);
    
    const videoId = params.videoId || this.extractVideoId(params.url!);
    
    this.logger.info({ videoId }, 'Fetching video metadata');

    // TODO: Integrate with YouTube API service
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            videoId,
            title: 'Mock Video Title',
            description: 'Mock video description',
            duration: 300,
            author: 'Mock Author',
            publishedAt: new Date().toISOString()
          }, null, 2)
        }
      ]
    };
  }

  private extractVideoId(url: string): string {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
      /^([a-zA-Z0-9_-]{11})$/
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        return match[1];
      }
    }

    throw new McpError(ErrorCode.InvalidParams, 'Invalid YouTube URL or video ID');
  }
}