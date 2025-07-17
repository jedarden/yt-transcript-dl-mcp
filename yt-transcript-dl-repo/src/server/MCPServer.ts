import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { 
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ErrorCode,
  McpError
} from '@modelcontextprotocol/sdk/types.js';
import pino from 'pino';
import { EventEmitter } from 'events';
import type { Transport } from '../types/transport.js';
import type { MCPServerConfig } from '../types/config.js';

export abstract class MCPServer extends EventEmitter {
  protected server: Server;
  protected logger: pino.Logger;
  protected transports: Map<string, Transport> = new Map();
  protected activeTransport: Transport | null = null;
  protected config: MCPServerConfig;
  protected isShuttingDown = false;

  constructor(config: MCPServerConfig) {
    super();
    this.config = config;
    
    // Initialize logger
    this.logger = pino({
      level: config.logLevel || 'info',
      transport: {
        target: 'pino-pretty',
        options: {
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname'
        }
      }
    });

    // Initialize MCP server
    this.server = new Server(
      {
        name: config.name,
        version: config.version
      },
      {
        capabilities: {
          resources: {},
          tools: {},
          prompts: {}
        }
      }
    );

    this.setupHandlers();
    this.setupShutdownHandlers();
  }

  /**
   * Setup request handlers for MCP protocol
   */
  private setupHandlers(): void {
    // Resources handler
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      this.logger.debug('Listing resources');
      return this.handleListResources();
    });

    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      this.logger.debug({ uri: request.params.uri }, 'Reading resource');
      return this.handleReadResource(request.params.uri);
    });

    // Tools handler
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      this.logger.debug('Listing tools');
      return this.handleListTools();
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      this.logger.debug({ tool: request.params.name }, 'Calling tool');
      return this.handleCallTool(request.params.name, request.params.arguments || {});
    });
  }

  /**
   * Setup graceful shutdown handlers
   */
  private setupShutdownHandlers(): void {
    const shutdown = async (signal: string) => {
      if (this.isShuttingDown) return;
      this.isShuttingDown = true;

      this.logger.info({ signal }, 'Shutting down MCP server');
      
      try {
        // Close all transports
        for (const [name, transport] of this.transports) {
          this.logger.info({ transport: name }, 'Closing transport');
          await transport.close();
        }

        // Emit shutdown event
        this.emit('shutdown');

        process.exit(0);
      } catch (error) {
        this.logger.error({ error }, 'Error during shutdown');
        process.exit(1);
      }
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('uncaughtException', (error) => {
      this.logger.fatal({ error }, 'Uncaught exception');
      shutdown('uncaughtException');
    });
    process.on('unhandledRejection', (error) => {
      this.logger.fatal({ error }, 'Unhandled rejection');
      shutdown('unhandledRejection');
    });
  }

  /**
   * Register a transport
   */
  public registerTransport(name: string, transport: Transport): void {
    this.logger.info({ transport: name }, 'Registering transport');
    this.transports.set(name, transport);
    
    // Setup transport event handlers
    transport.on('error', (error) => {
      this.logger.error({ transport: name, error }, 'Transport error');
      this.emit('transport:error', { name, error });
    });

    transport.on('close', () => {
      this.logger.info({ transport: name }, 'Transport closed');
      this.emit('transport:close', { name });
      
      // Try to failover to another transport
      if (this.activeTransport === transport) {
        this.failover();
      }
    });
  }

  /**
   * Start the server with specified transport
   */
  public async start(transportName?: string): Promise<void> {
    try {
      // Select transport
      const transport = transportName 
        ? this.transports.get(transportName)
        : this.selectTransport();

      if (!transport) {
        throw new Error(`No transport available${transportName ? `: ${transportName}` : ''}`);
      }

      this.activeTransport = transport;
      this.logger.info({ transport: transportName || 'auto' }, 'Starting MCP server');

      // Connect transport to server
      await this.server.connect(transport.getServerTransport());
      
      // Start transport
      await transport.start();

      this.logger.info('MCP server started successfully');
      this.emit('start');
    } catch (error) {
      this.logger.error({ error }, 'Failed to start MCP server');
      throw error;
    }
  }

  /**
   * Select best available transport
   */
  private selectTransport(): Transport | null {
    // Priority order: stdio > sse > http
    const priorities = ['stdio', 'sse', 'http'];
    
    for (const name of priorities) {
      const transport = this.transports.get(name);
      if (transport && transport.isAvailable()) {
        this.logger.info({ transport: name }, 'Auto-selected transport');
        return transport;
      }
    }

    return null;
  }

  /**
   * Failover to another transport
   */
  private async failover(): Promise<void> {
    this.logger.warn('Attempting transport failover');
    
    for (const [name, transport] of this.transports) {
      if (transport !== this.activeTransport && transport.isAvailable()) {
        try {
          this.logger.info({ transport: name }, 'Failing over to transport');
          this.activeTransport = transport;
          await this.server.connect(transport.getServerTransport());
          await transport.start();
          this.emit('failover', { transport: name });
          return;
        } catch (error) {
          this.logger.error({ transport: name, error }, 'Failover failed');
        }
      }
    }

    this.logger.error('No transports available for failover');
    this.emit('error', new Error('All transports failed'));
  }

  /**
   * Get server health status
   */
  public getHealth(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    transports: Record<string, boolean>;
    uptime: number;
  } {
    const transportStatus: Record<string, boolean> = {};
    let healthyCount = 0;

    for (const [name, transport] of this.transports) {
      const isHealthy = transport.isAvailable();
      transportStatus[name] = isHealthy;
      if (isHealthy) healthyCount++;
    }

    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (healthyCount === this.transports.size) {
      status = 'healthy';
    } else if (healthyCount > 0) {
      status = 'degraded';
    } else {
      status = 'unhealthy';
    }

    return {
      status,
      transports: transportStatus,
      uptime: process.uptime()
    };
  }

  /**
   * Abstract methods to be implemented by subclasses
   */
  protected abstract handleListResources(): Promise<any>;
  protected abstract handleReadResource(uri: string): Promise<any>;
  protected abstract handleListTools(): Promise<any>;
  protected abstract handleCallTool(name: string, args: any): Promise<any>;
}