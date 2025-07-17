import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { BaseTransport } from './base-transport.js';
import { SSETransport } from './sse-transport.js';
import { HTTPTransport } from './http-transport.js';
import { Logger } from '../../utils/logger.js';

export interface TransportManagerConfig {
  enableStdio?: boolean;
  enableSSE?: boolean;
  enableHTTP?: boolean;
  ssePort?: number;
  httpPort?: number;
  host?: string;
  corsOrigin?: string;
}

export class TransportManager {
  private server: Server;
  private config: TransportManagerConfig;
  private transports: Map<string, BaseTransport> = new Map();
  private stdioTransport?: StdioServerTransport;
  private logger: typeof Logger;

  constructor(server: Server, config?: TransportManagerConfig) {
    this.server = server;
    this.config = {
      enableStdio: true,
      enableSSE: true,
      enableHTTP: true,
      ssePort: 3001,
      httpPort: 3002,
      host: 'localhost',
      corsOrigin: '*',
      ...config
    };
    this.logger = Logger;
  }

  public async startAll(): Promise<void> {
    this.logger.info('Starting transport manager...');

    const startPromises: Promise<void>[] = [];

    // Start stdio transport if enabled
    if (this.config.enableStdio) {
      startPromises.push(this.startStdioTransport());
    }

    // Start SSE transport if enabled
    if (this.config.enableSSE) {
      const sseTransport = new SSETransport(this.server, {
        name: 'SSE Transport',
        port: this.config.ssePort,
        host: this.config.host,
        corsOrigin: this.config.corsOrigin
      });
      this.transports.set('sse', sseTransport);
      startPromises.push(sseTransport.start());
    }

    // Start HTTP transport if enabled
    if (this.config.enableHTTP) {
      const httpTransport = new HTTPTransport(this.server, {
        name: 'HTTP Transport',
        port: this.config.httpPort,
        host: this.config.host,
        corsOrigin: this.config.corsOrigin
      });
      this.transports.set('http', httpTransport);
      startPromises.push(httpTransport.start());
    }

    // Wait for all transports to start
    try {
      await Promise.all(startPromises);
      this.logger.info('All transports started successfully');
      this.logTransportStatus();
    } catch (error) {
      this.logger.error('Failed to start transports:', error);
      // Stop any that did start
      await this.stopAll();
      throw error;
    }
  }

  public async stopAll(): Promise<void> {
    this.logger.info('Stopping all transports...');

    const stopPromises: Promise<void>[] = [];

    // Stop all custom transports
    for (const [name, transport] of this.transports) {
      this.logger.info(`Stopping ${name} transport...`);
      stopPromises.push(transport.stop());
    }

    // Note: Stdio transport typically doesn't need explicit stopping
    // as it's tied to the process streams

    try {
      await Promise.all(stopPromises);
      this.transports.clear();
      this.logger.info('All transports stopped successfully');
    } catch (error) {
      this.logger.error('Error stopping transports:', error);
      throw error;
    }
  }

  public getTransport(name: string): BaseTransport | undefined {
    return this.transports.get(name);
  }

  public getAllTransports(): Map<string, BaseTransport> {
    return new Map(this.transports);
  }

  public getHealthStatus(): { [key: string]: any } {
    const status: { [key: string]: any } = {
      overall: 'healthy',
      transports: {}
    };

    // Check stdio transport
    if (this.config.enableStdio) {
      status.transports.stdio = {
        status: 'healthy',
        details: {
          transport: 'STDIO',
          type: 'bidirectional',
          connected: true
        }
      };
    }

    // Check other transports
    for (const [name, transport] of this.transports) {
      status.transports[name] = transport.getHealthStatus();
      if (status.transports[name].status !== 'healthy') {
        status.overall = 'degraded';
      }
    }

    return status;
  }

  public getActiveTransportCount(): number {
    let count = this.config.enableStdio ? 1 : 0;
    
    for (const transport of this.transports.values()) {
      if (transport.isActive()) {
        count++;
      }
    }
    
    return count;
  }

  private async startStdioTransport(): Promise<void> {
    this.logger.info('Starting STDIO transport...');
    this.stdioTransport = new StdioServerTransport();
    await this.server.connect(this.stdioTransport);
    this.logger.info('STDIO transport started');
  }

  private logTransportStatus(): void {
    const status = this.getHealthStatus();
    
    this.logger.info('Transport Status:');
    this.logger.info(`  Overall: ${status.overall}`);
    this.logger.info(`  Active transports: ${this.getActiveTransportCount()}`);
    
    for (const [name, transportStatus] of Object.entries(status.transports)) {
      const details = (transportStatus as any).details;
      if (name === 'stdio') {
        this.logger.info(`  - ${name}: ${(transportStatus as any).status} (${details.type})`);
      } else {
        this.logger.info(`  - ${name}: ${(transportStatus as any).status} on ${details.host}:${details.port}`);
      }
    }
  }

  public async restartTransport(name: string): Promise<void> {
    const transport = this.transports.get(name);
    
    if (!transport) {
      throw new Error(`Transport '${name}' not found`);
    }

    this.logger.info(`Restarting ${name} transport...`);
    
    await transport.stop();
    await transport.start();
    
    this.logger.info(`${name} transport restarted successfully`);
  }
}