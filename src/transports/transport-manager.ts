import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { Logger } from '../utils/logger';
import { BaseTransport } from './base-transport';
import { StdioTransport } from './stdio-transport';
import { SimpleSSETransport } from './simple-sse-transport';
import { SimpleHTTPTransport } from './simple-http-transport';

export interface TransportManagerConfig {
  stdio: {
    enabled: boolean;
  };
  sse: {
    enabled: boolean;
    port: number;
    host: string;
  };
  http: {
    enabled: boolean;
    port: number;
    host: string;
  };
}

export class TransportManager {
  private transports: BaseTransport[] = [];
  private logger: typeof Logger;
  private server: Server;
  private config: TransportManagerConfig;

  constructor(server: Server, config: TransportManagerConfig) {
    this.server = server;
    this.config = config;
    this.logger = Logger;
    this.initializeTransports();
  }

  private initializeTransports(): void {
    // Initialize stdio transport
    if (this.config.stdio.enabled) {
      this.transports.push(new StdioTransport(this.server, {
        name: 'stdio',
        enabled: true
      }));
    }

    // Initialize SSE transport
    if (this.config.sse.enabled) {
      this.transports.push(new SimpleSSETransport(this.server, {
        name: 'sse',
        enabled: true,
        port: this.config.sse.port,
        host: this.config.sse.host
      }));
    }

    // Initialize HTTP transport
    if (this.config.http.enabled) {
      this.transports.push(new SimpleHTTPTransport(this.server, {
        name: 'http',
        enabled: true,
        port: this.config.http.port,
        host: this.config.http.host
      }));
    }

    this.logger.info(`Initialized ${this.transports.length} transports`);
  }

  public async startAll(): Promise<void> {
    this.logger.info('Starting all enabled transports...');
    
    const startPromises = this.transports.map(async (transport) => {
      try {
        await transport.start();
        this.logger.info(`✅ ${transport.getName()} transport started`);
      } catch (error) {
        this.logger.error(`❌ Failed to start ${transport.getName()} transport:`, error);
        // Don't throw - allow other transports to start
      }
    });

    await Promise.all(startPromises);
    
    const runningTransports = this.transports.filter(t => t.getStatus().running);
    if (runningTransports.length === 0) {
      throw new Error('No transports could be started');
    }

    this.logger.info(`Successfully started ${runningTransports.length} transport(s)`);
  }

  public async stopAll(): Promise<void> {
    this.logger.info('Stopping all transports...');
    
    const stopPromises = this.transports.map(async (transport) => {
      try {
        await transport.stop();
        this.logger.info(`✅ ${transport.getName()} transport stopped`);
      } catch (error) {
        this.logger.error(`❌ Failed to stop ${transport.getName()} transport:`, error);
      }
    });

    await Promise.all(stopPromises);
    this.logger.info('All transports stopped');
  }

  public getStatus(): Record<string, any> {
    return {
      transports: this.transports.map(t => t.getStatus()),
      summary: {
        total: this.transports.length,
        running: this.transports.filter(t => t.getStatus().running).length
      }
    };
  }

  public async startTransport(name: string): Promise<void> {
    const transport = this.transports.find(t => t.getName() === name);
    if (!transport) {
      throw new Error(`Transport ${name} not found`);
    }
    await transport.start();
  }

  public async stopTransport(name: string): Promise<void> {
    const transport = this.transports.find(t => t.getName() === name);
    if (!transport) {
      throw new Error(`Transport ${name} not found`);
    }
    await transport.stop();
  }

  public getTransportStatus(name: string): any {
    const transport = this.transports.find(t => t.getName() === name);
    if (!transport) {
      throw new Error(`Transport ${name} not found`);
    }
    return transport.getStatus();
  }
}