import { EventEmitter } from 'events';
import express, { Request, Response } from 'express';
import cors from 'cors';
import { createServer, Server as HTTPServer } from 'http';
import type { ServerTransport } from '@modelcontextprotocol/sdk/server/index.js';
import type { Transport } from '../types/transport.js';
import type { SSETransportConfig } from '../types/config.js';
import pino from 'pino';
import { SSEServerTransport } from './SSEServerTransport.js';

interface SSEClient {
  id: string;
  response: Response;
  lastActivity: number;
}

export class SSETransport extends EventEmitter implements Transport {
  private app: express.Application;
  private server: HTTPServer | null = null;
  private config: SSETransportConfig;
  private logger: pino.Logger;
  private clients: Map<string, SSEClient> = new Map();
  private keepAliveTimer: NodeJS.Timeout | null = null;
  private serverTransport: SSEServerTransport;

  constructor(config: SSETransportConfig = {}, logger: pino.Logger) {
    super();
    this.config = {
      port: 3456,
      host: '0.0.0.0',
      keepAliveInterval: 30000,
      maxClients: 100,
      ...config
    };
    this.logger = logger.child({ transport: 'sse' });
    this.app = express();
    this.serverTransport = new SSEServerTransport();
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    // CORS
    if (this.config.cors) {
      this.app.use(cors({
        origin: this.config.cors.origin || '*',
        credentials: this.config.cors.credentials || false
      }));
    }

    // Body parser for POST requests
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));

    // Request logging
    this.app.use((req, res, next) => {
      this.logger.debug({ method: req.method, path: req.path }, 'SSE request');
      next();
    });
  }

  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'ok',
        clients: this.clients.size,
        uptime: process.uptime()
      });
    });

    // SSE endpoint
    this.app.get('/sse', (req, res) => {
      // Check max clients
      if (this.clients.size >= (this.config.maxClients || 100)) {
        res.status(503).json({ error: 'Server at capacity' });
        return;
      }

      // Setup SSE headers
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no' // Disable nginx buffering
      });

      const clientId = this.generateClientId();
      const client: SSEClient = {
        id: clientId,
        response: res,
        lastActivity: Date.now()
      };

      this.clients.set(clientId, client);
      this.logger.info({ clientId, totalClients: this.clients.size }, 'SSE client connected');

      // Send initial connection event
      this.sendToClient(client, {
        type: 'connection',
        data: { clientId, timestamp: new Date().toISOString() }
      });

      // Handle client disconnect
      req.on('close', () => {
        this.clients.delete(clientId);
        this.logger.info({ clientId, totalClients: this.clients.size }, 'SSE client disconnected');
        this.serverTransport.handleClientDisconnect(clientId);
      });

      // Register client with server transport
      this.serverTransport.registerClient(clientId, client);
    });

    // JSON-RPC endpoint for SSE transport
    this.app.post('/rpc/:clientId', async (req, res) => {
      const { clientId } = req.params;
      const client = this.clients.get(clientId);

      if (!client) {
        res.status(404).json({ error: 'Client not found' });
        return;
      }

      try {
        // Update last activity
        client.lastActivity = Date.now();

        // Process JSON-RPC request through server transport
        const response = await this.serverTransport.handleRequest(clientId, req.body);
        res.json(response);
      } catch (error) {
        this.logger.error({ error, clientId }, 'Error handling RPC request');
        res.status(500).json({
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message: 'Internal error',
            data: error instanceof Error ? error.message : String(error)
          },
          id: req.body.id || null
        });
      }
    });

    // Error handling
    this.app.use((err: any, req: Request, res: Response, next: any) => {
      this.logger.error({ error: err }, 'Express error');
      res.status(500).json({ error: 'Internal server error' });
    });
  }

  private generateClientId(): string {
    return `sse-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private sendToClient(client: SSEClient, data: any): void {
    try {
      const message = `data: ${JSON.stringify(data)}\n\n`;
      client.response.write(message);
    } catch (error) {
      this.logger.error({ error, clientId: client.id }, 'Error sending to client');
      this.clients.delete(client.id);
    }
  }

  private startKeepAlive(): void {
    this.keepAliveTimer = setInterval(() => {
      const now = Date.now();
      const timeout = this.config.keepAliveInterval || 30000;

      for (const [clientId, client] of this.clients) {
        try {
          // Send ping
          this.sendToClient(client, { type: 'ping', timestamp: now });

          // Check for inactive clients
          if (now - client.lastActivity > timeout * 2) {
            this.logger.warn({ clientId }, 'Removing inactive client');
            client.response.end();
            this.clients.delete(clientId);
          }
        } catch (error) {
          this.logger.error({ error, clientId }, 'Keep-alive error');
          this.clients.delete(clientId);
        }
      }
    }, this.config.keepAliveInterval || 30000);
  }

  isAvailable(): boolean {
    return this.server !== null && this.server.listening;
  }

  async start(): Promise<void> {
    if (this.server?.listening) {
      throw new Error('SSE transport already started');
    }

    return new Promise((resolve, reject) => {
      try {
        this.server = createServer(this.app);

        this.server.on('error', (error) => {
          this.logger.error({ error }, 'SSE server error');
          this.emit('error', error);
          if (!this.server?.listening) {
            reject(error);
          }
        });

        this.server.listen(this.config.port, this.config.host, () => {
          const address = this.server!.address();
          const port = typeof address === 'object' ? address?.port : this.config.port;
          
          this.logger.info({ host: this.config.host, port }, 'SSE transport started');
          this.startKeepAlive();
          this.emit('connect');
          resolve();
        });
      } catch (error) {
        this.logger.error({ error }, 'Failed to start SSE transport');
        reject(error);
      }
    });
  }

  async close(): Promise<void> {
    // Stop keep-alive
    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer);
      this.keepAliveTimer = null;
    }

    // Close all client connections
    for (const [clientId, client] of this.clients) {
      try {
        client.response.end();
      } catch (error) {
        this.logger.error({ error, clientId }, 'Error closing client connection');
      }
    }
    this.clients.clear();

    // Close server
    return new Promise((resolve) => {
      if (!this.server) {
        resolve();
        return;
      }

      this.server.close(() => {
        this.logger.info('SSE transport closed');
        this.server = null;
        this.emit('close');
        resolve();
      });
    });
  }

  getServerTransport(): ServerTransport {
    return this.serverTransport;
  }

  configure(options: SSETransportConfig): void {
    this.config = { ...this.config, ...options };
    this.logger.debug({ config: this.config }, 'Updated SSE transport config');
  }

  /**
   * Broadcast message to all connected clients
   */
  broadcast(data: any): void {
    for (const client of this.clients.values()) {
      this.sendToClient(client, data);
    }
  }
}