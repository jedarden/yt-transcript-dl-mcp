import { createServer, Server as HttpServer } from 'http';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { BaseTransport, TransportConfig } from './base-transport';
import express, { Request, Response } from 'express';
import { JSONRPCRequest, JSONRPCResponse, JSONRPCError } from '@modelcontextprotocol/sdk/types.js';

export interface HTTPTransportConfig extends TransportConfig {
  corsOrigin?: string;
  maxRequestSize?: number;
  timeout?: number;
}

export class HTTPTransport extends BaseTransport {
  private httpServer?: HttpServer;
  private app?: express.Application;
  private activeRequests: Map<string, { timestamp: number; request: JSONRPCRequest }> = new Map();

  constructor(server: Server, config: HTTPTransportConfig) {
    super(server, {
      ...config,
      name: config.name || 'HTTP Transport'
    });
  }

  public async start(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn(`[${this.config.name}] Already running`);
      return;
    }

    try {
      const port = this.config.port || 3002;
      const host = this.config.host || 'localhost';
      const corsOrigin = (this.config as HTTPTransportConfig).corsOrigin || '*';
      const maxRequestSize = (this.config as HTTPTransportConfig).maxRequestSize || '10mb';

      // Create Express app
      this.app = express();
      
      // Configure middleware
      this.app.use(express.json({ limit: maxRequestSize }));
      
      // Configure CORS
      this.app.use((req, res, next) => {
        res.header('Access-Control-Allow-Origin', corsOrigin);
        res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.header('Access-Control-Allow-Headers', 'Content-Type');
        
        if (req.method === 'OPTIONS') {
          res.sendStatus(200);
        } else {
          next();
        }
      });

      // Request logging
      this.app.use((req, res, next) => {
        this.logger.debug(`[${this.config.name}] ${req.method} ${req.path}`);
        next();
      });

      // Health check endpoint
      this.app.get('/health', (req: Request, res: Response) => {
        res.json(this.getHealthStatus());
      });

      // JSON-RPC endpoint
      this.app.post('/rpc', async (req: Request, res: Response) => {
        const startTime = Date.now();
        let requestId: string | undefined;

        try {
          const request = req.body as JSONRPCRequest;
          
          if (!this.isValidJSONRPCRequest(request)) {
            throw new Error('Invalid JSON-RPC request');
          }

          requestId = String(request.id);
          
          // Track active request
          this.activeRequests.set(requestId, {
            timestamp: startTime,
            request
          });

          // Process request through MCP server
          const response = await this.processRequest(request);
          
          // Send response
          res.json(response);
          
          // Log request completion
          const duration = Date.now() - startTime;
          this.logger.info(`[${this.config.name}] Request ${requestId} completed in ${duration}ms`);

        } catch (error) {
          const errorResponse: JSONRPCResponse = {
            jsonrpc: '2.0',
            id: requestId || null,
            error: {
              code: -32603,
              message: 'Internal error',
              data: error instanceof Error ? error.message : 'Unknown error'
            }
          };
          
          res.status(500).json(errorResponse);
          this.logger.error(`[${this.config.name}] Request error:`, error);
        } finally {
          if (requestId) {
            this.activeRequests.delete(requestId);
          }
        }
      });

      // List available methods endpoint
      this.app.get('/methods', async (req: Request, res: Response) => {
        try {
          const tools = await this.getAvailableTools();
          res.json({
            jsonrpc: '2.0',
            result: {
              methods: tools.map(tool => ({
                name: tool.name,
                description: tool.description,
                params: tool.inputSchema
              }))
            }
          });
        } catch (error) {
          res.status(500).json({
            jsonrpc: '2.0',
            error: {
              code: -32603,
              message: 'Failed to get methods',
              data: error instanceof Error ? error.message : 'Unknown error'
            }
          });
        }
      });

      // Create HTTP server
      this.httpServer = createServer(this.app);

      // Start server
      await new Promise<void>((resolve, reject) => {
        this.httpServer!.listen(port, host, () => {
          this.logger.info(`[${this.config.name}] Started on http://${host}:${port}`);
          this.isRunning = true;
          resolve();
        });

        this.httpServer!.on('error', (error) => {
          reject(error);
        });
      });

      // Start request cleanup timer
      this.startRequestCleanup();

    } catch (error) {
      await this.handleError(error as Error);
      throw error;
    }
  }

  public async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.logger.info(`[${this.config.name}] Stopping...`);

    // Wait for active requests to complete
    if (this.activeRequests.size > 0) {
      this.logger.info(`[${this.config.name}] Waiting for ${this.activeRequests.size} active requests...`);
      await this.waitForActiveRequests();
    }

    // Close HTTP server
    if (this.httpServer) {
      await new Promise<void>((resolve) => {
        this.httpServer!.close(() => {
          this.logger.info(`[${this.config.name}] HTTP server closed`);
          resolve();
        });
      });
      this.httpServer = undefined;
    }

    this.app = undefined;
    this.isRunning = false;
  }

  public getHealthStatus(): { status: string; details: any } {
    return {
      status: this.isRunning ? 'healthy' : 'stopped',
      details: {
        transport: 'HTTP',
        port: this.config.port || 3002,
        host: this.config.host || 'localhost',
        uptime: this.isRunning ? process.uptime() : 0,
        activeRequests: this.activeRequests.size,
        requestsServed: this.getRequestCount()
      }
    };
  }

  private isValidJSONRPCRequest(request: any): boolean {
    return (
      request &&
      request.jsonrpc === '2.0' &&
      typeof request.method === 'string' &&
      (request.id === undefined || request.id !== null)
    );
  }

  private async processRequest(request: JSONRPCRequest): Promise<JSONRPCResponse> {
    return new Promise((resolve, reject) => {
      // Create a custom transport that captures the response
      let responseReceived = false;
      
      const mockTransport = {
        send: async (message: JSONRPCMessage) => {
          if (!responseReceived) {
            responseReceived = true;
            resolve(message as JSONRPCResponse);
          }
        },
        close: async () => {},
        onclose: undefined,
        onerror: undefined,
        onmessage: undefined
      };

      // Connect and send the request
      this.server.connect(mockTransport as any).then(() => {
        // Trigger the request processing
        if (mockTransport.onmessage) {
          mockTransport.onmessage(request);
        }
      }).catch(reject);

      // Timeout after 30 seconds
      setTimeout(() => {
        if (!responseReceived) {
          reject(new Error('Request timeout'));
        }
      }, 30000);
    });
  }

  private async getAvailableTools(): Promise<any[]> {
    // This would need to be implemented to get tools from the MCP server
    // For now, return empty array
    return [];
  }

  private startRequestCleanup(): void {
    setInterval(() => {
      const timeout = (this.config as HTTPTransportConfig).timeout || 30000;
      const now = Date.now();
      
      for (const [id, info] of this.activeRequests) {
        if (now - info.timestamp > timeout) {
          this.logger.warn(`[${this.config.name}] Request ${id} timed out`);
          this.activeRequests.delete(id);
        }
      }
    }, 5000);
  }

  private async waitForActiveRequests(): Promise<void> {
    const maxWait = 10000; // 10 seconds
    const startTime = Date.now();
    
    while (this.activeRequests.size > 0 && Date.now() - startTime < maxWait) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    if (this.activeRequests.size > 0) {
      this.logger.warn(`[${this.config.name}] Force closing with ${this.activeRequests.size} active requests`);
    }
  }

  private getRequestCount(): number {
    // This would need to be tracked
    return 0;
  }
}