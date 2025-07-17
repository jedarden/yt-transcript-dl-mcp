import { EventEmitter } from 'events';
import express, { Request, Response } from 'express';
import cors from 'cors';
import { createServer, Server as HTTPServer } from 'http';
import type { ServerTransport } from '@modelcontextprotocol/sdk/server/index.js';
import type { Transport } from '../types/transport.js';
import type { HTTPTransportConfig } from '../types/config.js';
import pino from 'pino';
import { HTTPServerTransport } from './HTTPServerTransport.js';

export class HTTPTransport extends EventEmitter implements Transport {
  private app: express.Application;
  private server: HTTPServer | null = null;
  private config: HTTPTransportConfig;
  private logger: pino.Logger;
  private serverTransport: HTTPServerTransport;
  private requestCount = 0;
  private requestTimestamps: number[] = [];

  constructor(config: HTTPTransportConfig = {}, logger: pino.Logger) {
    super();
    this.config = {
      port: 3457,
      host: '0.0.0.0',
      maxBodySize: '10mb',
      timeout: 30000,
      ...config
    };
    this.logger = logger.child({ transport: 'http' });
    this.app = express();
    this.serverTransport = new HTTPServerTransport();
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    // CORS
    if (this.config.cors) {
      this.app.use(cors({
        origin: this.config.cors.origin || '*',
        credentials: this.config.cors.credentials || false,
        methods: ['GET', 'POST', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization']
      }));
    }

    // Body parser
    this.app.use(express.json({ limit: this.config.maxBodySize || '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: this.config.maxBodySize || '10mb' }));

    // Request timeout
    this.app.use((req, res, next) => {
      res.setTimeout(this.config.timeout || 30000, () => {
        res.status(408).json({ error: 'Request timeout' });
      });
      next();
    });

    // Rate limiting
    if (this.config.rateLimit) {
      this.app.use(this.rateLimitMiddleware.bind(this));
    }

    // Request logging
    this.app.use((req, res, next) => {
      const start = Date.now();
      this.requestCount++;
      
      res.on('finish', () => {
        const duration = Date.now() - start;
        this.logger.debug({
          method: req.method,
          path: req.path,
          status: res.statusCode,
          duration,
          requestCount: this.requestCount
        }, 'HTTP request completed');
      });
      
      next();
    });
  }

  private rateLimitMiddleware(req: Request, res: Response, next: any): void {
    const now = Date.now();
    const windowMs = this.config.rateLimit?.windowMs || 60000;
    const maxRequests = this.config.rateLimit?.max || 100;

    // Clean old timestamps
    this.requestTimestamps = this.requestTimestamps.filter(
      timestamp => now - timestamp < windowMs
    );

    if (this.requestTimestamps.length >= maxRequests) {
      res.status(429).json({ error: 'Too many requests' });
      return;
    }

    this.requestTimestamps.push(now);
    next();
  }

  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (req, res) => {
      const health = {
        status: 'ok',
        uptime: process.uptime(),
        requestCount: this.requestCount,
        timestamp: new Date().toISOString()
      };
      res.json(health);
    });

    // Metrics endpoint
    this.app.get('/metrics', (req, res) => {
      res.json({
        requests: {
          total: this.requestCount,
          rate: this.requestTimestamps.length
        },
        server: {
          uptime: process.uptime(),
          memory: process.memoryUsage()
        }
      });
    });

    // Main JSON-RPC endpoint
    this.app.post('/rpc', async (req, res) => {
      try {
        // Validate JSON-RPC request
        if (!req.body || !req.body.jsonrpc || req.body.jsonrpc !== '2.0') {
          res.status(400).json({
            jsonrpc: '2.0',
            error: {
              code: -32700,
              message: 'Parse error'
            },
            id: null
          });
          return;
        }

        // Process request through server transport
        const response = await this.serverTransport.handleRequest(req.body);
        res.json(response);
      } catch (error) {
        this.logger.error({ error }, 'Error handling RPC request');
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

    // Batch JSON-RPC endpoint
    this.app.post('/rpc/batch', async (req, res) => {
      if (!Array.isArray(req.body)) {
        res.status(400).json({
          jsonrpc: '2.0',
          error: {
            code: -32700,
            message: 'Parse error: Expected array'
          },
          id: null
        });
        return;
      }

      try {
        const responses = await Promise.all(
          req.body.map(request => this.serverTransport.handleRequest(request))
        );
        res.json(responses);
      } catch (error) {
        this.logger.error({ error }, 'Error handling batch RPC request');
        res.status(500).json({
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message: 'Internal error'
          },
          id: null
        });
      }
    });

    // 404 handler
    this.app.use((req, res) => {
      res.status(404).json({ error: 'Not found' });
    });

    // Error handler
    this.app.use((err: any, req: Request, res: Response, next: any) => {
      this.logger.error({ error: err }, 'Express error');
      res.status(500).json({ error: 'Internal server error' });
    });
  }

  isAvailable(): boolean {
    return this.server !== null && this.server.listening;
  }

  async start(): Promise<void> {
    if (this.server?.listening) {
      throw new Error('HTTP transport already started');
    }

    return new Promise((resolve, reject) => {
      try {
        this.server = createServer(this.app);

        this.server.on('error', (error) => {
          this.logger.error({ error }, 'HTTP server error');
          this.emit('error', error);
          if (!this.server?.listening) {
            reject(error);
          }
        });

        this.server.listen(this.config.port, this.config.host, () => {
          const address = this.server!.address();
          const port = typeof address === 'object' ? address?.port : this.config.port;
          
          this.logger.info({ host: this.config.host, port }, 'HTTP transport started');
          this.emit('connect');
          resolve();
        });
      } catch (error) {
        this.logger.error({ error }, 'Failed to start HTTP transport');
        reject(error);
      }
    });
  }

  async close(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.server) {
        resolve();
        return;
      }

      this.server.close(() => {
        this.logger.info('HTTP transport closed');
        this.server = null;
        this.emit('close');
        resolve();
      });
    });
  }

  getServerTransport(): ServerTransport {
    return this.serverTransport;
  }

  configure(options: HTTPTransportConfig): void {
    this.config = { ...this.config, ...options };
    this.logger.debug({ config: this.config }, 'Updated HTTP transport config');
  }
}