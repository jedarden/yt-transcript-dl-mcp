import express, { Request, Response } from 'express';
import cors from 'cors';
import { BaseTransport } from './base-transport';
import http from 'http';

interface SSEClient {
  id: string;
  response: Response;
  lastSeen: number;
}

export class SimpleSSETransport extends BaseTransport {
  private app?: express.Application;
  private httpServer?: http.Server;
  private clients: Map<string, SSEClient> = new Map();

  async start(): Promise<void> {
    if (!this.options.enabled) {
      this.logger.info('SSE transport is disabled');
      return;
    }

    try {
      this.app = express();
      
      // Enable CORS
      this.app.use(cors({
        origin: true,
        credentials: true
      }));

      this.app.use(express.json({ limit: '10mb' }));

      // SSE endpoint for establishing connection
      this.app.get('/sse', (req: Request, res: Response) => {
        const clientId = `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Set SSE headers
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': 'true'
        });

        // Store client
        this.clients.set(clientId, {
          id: clientId,
          response: res,
          lastSeen: Date.now()
        });

        // Send initial connection message
        this.sendSSEMessage(res, 'connected', {
          clientId,
          message: 'Connected to YouTube Transcript MCP Server',
          timestamp: new Date().toISOString()
        });

        // Handle client disconnect
        req.on('close', () => {
          this.clients.delete(clientId);
          this.logger.debug(`SSE client disconnected: ${clientId}`);
        });

        req.on('error', (err) => {
          this.logger.error(`SSE client error: ${clientId}`, err);
          this.clients.delete(clientId);
        });

        this.logger.debug(`SSE client connected: ${clientId}`);
      });

      // Message endpoint for receiving JSON-RPC messages
      this.app.post('/sse/message/:clientId', async (req: Request, res: Response) => {
        const { clientId } = req.params;
        const client = this.clients.get(clientId);

        if (!client) {
          return res.status(404).json({ error: 'Client not found' });
        }

        try {
          const { jsonrpc, id, method, params } = req.body;

          if (jsonrpc !== '2.0') {
            return res.status(400).json({
              error: 'Invalid JSON-RPC request'
            });
          }

          // Handle MCP methods
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
              error: `Method not found: ${method}`
            });
          }

          // Send response via SSE
          this.sendSSEMessage(client.response, 'response', {
            jsonrpc: '2.0',
            id,
            result
          });

          // Acknowledge message receipt
          return res.json({ status: 'sent' });

        } catch (error) {
          this.logger.error('SSE message error:', error);
          
          // Send error via SSE
          this.sendSSEMessage(client.response, 'error', {
            jsonrpc: '2.0',
            id: req.body.id,
            error: {
              code: -32603,
              message: 'Internal error',
              data: error instanceof Error ? error.message : 'Unknown error'
            }
          });

          return res.status(500).json({ error: 'Internal server error' });
        }
      });

      // Health check endpoint
      this.app.get('/health', (req: Request, res: Response) => {
        res.json({
          status: 'healthy',
          transport: 'sse',
          clients: this.clients.size,
          timestamp: new Date().toISOString()
        });
      });

      // Root endpoint
      this.app.get('/', (req: Request, res: Response) => {
        res.json({
          name: 'YouTube Transcript MCP Server (SSE)',
          version: '1.0.0',
          transport: 'sse',
          endpoint: '/sse',
          messageEndpoint: '/sse/message/:clientId',
          health: '/health',
          clients: this.clients.size
        });
      });

      // Start HTTP server
      const port = this.options.port || 3001;
      const host = this.options.host || '0.0.0.0';
      
      this.httpServer = this.app.listen(port, host, () => {
        this.logger.info(`SSE transport listening on ${host}:${port}`);
      });

      this.isRunning = true;
      this.logger.info(`SSE transport started successfully on port ${port}`);

      // Cleanup disconnected clients periodically
      this.startClientCleanup();

    } catch (error) {
      this.logger.error('Failed to start SSE transport:', error);
      throw error;
    }
  }

  private sendSSEMessage(res: Response, event: string, data: any): void {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  }

  private async handleToolsList() {
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
    
    switch (name) {
    case 'get_transcript':
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            videoId: args.videoId,
            message: 'SSE transport is working! (Mock response)',
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
              message: 'SSE transport bulk processing! (Mock response)'
            })),
            timestamp: new Date().toISOString()
          }, null, 2)
        }]
      };
      
    default:
      throw new Error(`Unknown tool: ${name}`);
    }
  }

  private startClientCleanup(): void {
    setInterval(() => {
      const now = Date.now();
      const timeout = 5 * 60 * 1000; // 5 minutes

      for (const [clientId, client] of this.clients) {
        if (now - client.lastSeen > timeout) {
          this.logger.debug(`Cleaning up stale SSE client: ${clientId}`);
          this.clients.delete(clientId);
        }
      }
    }, 60000); // Run every minute
  }

  async stop(): Promise<void> {
    if (!this.isRunning) return;

    try {
      // Close all SSE connections
      for (const [clientId, client] of this.clients) {
        client.response.end();
      }
      this.clients.clear();

      if (this.httpServer) {
        await new Promise<void>((resolve, reject) => {
          this.httpServer!.close((err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      }
      
      this.isRunning = false;
      this.logger.info('SSE transport stopped');
    } catch (error) {
      this.logger.error('Error stopping SSE transport:', error);
      throw error;
    }
  }
}