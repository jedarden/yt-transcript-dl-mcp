import { createServer, Server as HttpServer } from 'http';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { BaseTransport, TransportConfig } from './base-transport.js';
import express, { Request, Response } from 'express';

export interface SSETransportConfig extends TransportConfig {
  corsOrigin?: string;
  heartbeatInterval?: number;
}

export class SSETransport extends BaseTransport {
  private httpServer?: HttpServer;
  private app?: express.Application;
  private sseTransport?: SSEServerTransport;
  private heartbeatTimer?: NodeJS.Timeout;

  constructor(server: Server, config: SSETransportConfig) {
    super(server, {
      ...config,
      name: config.name || 'SSE Transport'
    });
  }

  public async start(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn(`[${this.config.name}] Already running`);
      return;
    }

    try {
      const port = this.config.port || 3001;
      const host = this.config.host || 'localhost';
      const corsOrigin = (this.config as SSETransportConfig).corsOrigin || '*';

      // Create Express app
      this.app = express();
      
      // Configure CORS
      this.app.use((req, res, next) => {
        res.header('Access-Control-Allow-Origin', corsOrigin);
        res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.header('Access-Control-Allow-Headers', 'Content-Type');
        next();
      });

      // Health check endpoint
      this.app.get('/health', (req: Request, res: Response) => {
        res.json(this.getHealthStatus());
      });

      // Store active SSE transports by session ID
      const sseTransports = new Map<string, SSEServerTransport>();

      // SSE endpoint
      this.app.get('/sse', async (req: Request, res: Response) => {
        this.logger.info(`[${this.config.name}] New SSE connection from ${req.ip}`);
        
        // Create SSE transport for this connection
        const transport = new SSEServerTransport('/sse/message', res);
        await transport.start();
        
        // Store transport by session ID
        sseTransports.set(transport.sessionId, transport);
        
        // Connect to MCP server
        await this.server.connect(transport);
        
        this.logger.info(`[${this.config.name}] SSE session started: ${transport.sessionId}`);

        // Handle client disconnect
        req.on('close', () => {
          this.logger.info(`[${this.config.name}] SSE client disconnected: ${transport.sessionId}`);
          sseTransports.delete(transport.sessionId);
        });
      });

      // SSE message endpoint for POST requests
      this.app.post('/sse/message/:sessionId?', async (req: Request, res: Response) => {
        const sessionId = req.params.sessionId || req.body?.sessionId;
        
        if (!sessionId) {
          res.status(400).json({ error: 'Session ID required' });
          return;
        }
        
        const transport = sseTransports.get(sessionId);
        if (!transport) {
          res.status(404).json({ error: 'Session not found' });
          return;
        }
        
        try {
          await transport.handlePostMessage(req as any, res as any);
        } catch (error) {
          this.logger.error(`[${this.config.name}] Error handling SSE message:`, error);
          res.status(500).json({ error: 'Internal server error' });
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

      // Start heartbeat
      this.startHeartbeat();

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

    // Stop heartbeat
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
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
        transport: 'SSE',
        port: this.config.port || 3001,
        host: this.config.host || 'localhost',
        uptime: this.isRunning ? process.uptime() : 0,
        connections: this.getActiveConnections()
      }
    };
  }

  private startHeartbeat(): void {
    const interval = (this.config as SSETransportConfig).heartbeatInterval || 30000;
    
    this.heartbeatTimer = setInterval(() => {
      if (this.isRunning) {
        this.logger.debug(`[${this.config.name}] Heartbeat`);
      }
    }, interval);
  }

  private getActiveConnections(): number {
    // This would need to be tracked by counting active SSE connections
    // For now, return 0 as placeholder
    return 0;
  }
}