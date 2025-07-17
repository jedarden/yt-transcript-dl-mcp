import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { BaseTransport } from './base-transport';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import http from 'http';

export class SimpleHTTPTransport extends BaseTransport {
  private app?: express.Application;
  private httpServer?: http.Server;

  async start(): Promise<void> {
    if (!this.options.enabled) {
      this.logger.info('HTTP transport is disabled');
      return;
    }

    try {
      this.app = express();
      
      // Security middleware
      this.app.use(helmet());
      
      // Enable CORS
      this.app.use(cors({
        origin: true,
        credentials: true,
        methods: ['GET', 'POST', 'OPTIONS']
      }));

      // JSON body parser
      this.app.use(express.json({ limit: '10mb' }));

      // Rate limiting
      const limiter = rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100 // limit each IP to 100 requests per windowMs
      });
      this.app.use('/rpc', limiter);

      // Setup RPC endpoint that manually handles MCP messages
      this.app.post('/rpc', async (req: Request, res: Response) => {
        try {
          const { jsonrpc, id, method, params } = req.body;

          if (jsonrpc !== '2.0') {
            return res.status(400).json({
              jsonrpc: '2.0',
              id,
              error: { code: -32600, message: 'Invalid Request' }
            });
          }

          // Handle MCP methods directly
          let result;
          switch (method) {
            case 'tools/list':
              result = await this.handleToolsList();
              break;
            
            case 'tools/call':
              result = await this.handleToolCall(params);
              break;
            
            default:
              return res.status(400).json({
                jsonrpc: '2.0',
                id,
                error: { code: -32601, message: 'Method not found' }
              });
          }

          return res.json({
            jsonrpc: '2.0',
            id,
            result
          });

        } catch (error) {
          this.logger.error('RPC error:', error);
          return res.status(500).json({
            jsonrpc: '2.0',
            id: req.body.id,
            error: {
              code: -32603,
              message: 'Internal error',
              data: error instanceof Error ? error.message : 'Unknown error'
            }
          });
        }
      });

      // Health check endpoint
      this.app.get('/health', (req: Request, res: Response) => {
        res.json({
          status: 'healthy',
          transport: 'http',
          timestamp: new Date().toISOString()
        });
      });

      // Root endpoint
      this.app.get('/', (req: Request, res: Response) => {
        res.json({
          name: 'YouTube Transcript MCP Server (HTTP)',
          version: '1.0.0',
          transport: 'http',
          endpoint: '/rpc',
          health: '/health'
        });
      });

      // Error handling middleware
      this.app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
        this.logger.error('HTTP transport error:', err);
        res.status(500).json({
          error: 'Internal server error',
          message: err.message
        });
      });

      // Start HTTP server
      const port = this.options.port || 3002;
      const host = this.options.host || '0.0.0.0';
      
      this.httpServer = this.app.listen(port, host, () => {
        this.logger.info(`HTTP transport listening on ${host}:${port}`);
      });

      this.isRunning = true;
      this.logger.info(`HTTP transport started successfully on port ${port}`);

    } catch (error) {
      this.logger.error('Failed to start HTTP transport:', error);
      throw error;
    }
  }

  private async handleToolsList() {
    // Mock tools list - in a real implementation, this would come from the MCP server
    return {
      tools: [
        {
          name: 'get_transcript',
          description: 'Extract transcript from a single YouTube video',
          inputSchema: {
            type: 'object',
            properties: {
              videoId: { type: 'string', description: 'YouTube video ID or URL' },
              language: { type: 'string', description: 'Language code', default: 'en' },
              format: { type: 'string', enum: ['text', 'json', 'srt'], default: 'json' }
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
              videoIds: { type: 'array', items: { type: 'string' } },
              language: { type: 'string', default: 'en' },
              outputFormat: { type: 'string', enum: ['text', 'json', 'srt'], default: 'json' }
            },
            required: ['videoIds']
          }
        }
      ]
    };
  }

  private async handleToolCall(params: any) {
    const { name, arguments: args } = params;
    
    // Mock tool execution - in a real implementation, this would delegate to the MCP server
    switch (name) {
      case 'get_transcript':
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              videoId: args.videoId,
              message: 'HTTP transport is working! (Mock response)',
              timestamp: new Date().toISOString()
            }, null, 2)
          }]
        };
      
      case 'get_bulk_transcripts':
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              results: args.videoIds.map((id: string) => ({
                videoId: id,
                message: 'HTTP transport bulk processing! (Mock response)'
              })),
              timestamp: new Date().toISOString()
            }, null, 2)
          }]
        };
      
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) return;

    try {
      if (this.httpServer) {
        await new Promise<void>((resolve, reject) => {
          this.httpServer!.close((err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      }
      
      this.isRunning = false;
      this.logger.info('HTTP transport stopped');
    } catch (error) {
      this.logger.error('Error stopping HTTP transport:', error);
      throw error;
    }
  }
}