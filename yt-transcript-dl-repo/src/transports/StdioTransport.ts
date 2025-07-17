import { EventEmitter } from 'events';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { ServerTransport } from '@modelcontextprotocol/sdk/server/index.js';
import type { Transport } from '../types/transport.js';
import type { StdioTransportConfig } from '../types/config.js';
import pino from 'pino';

export class StdioTransport extends EventEmitter implements Transport {
  private transport: StdioServerTransport;
  private config: StdioTransportConfig;
  private logger: pino.Logger;
  private isConnected = false;

  constructor(config: StdioTransportConfig = {}, logger: pino.Logger) {
    super();
    this.config = config;
    this.logger = logger.child({ transport: 'stdio' });
    this.transport = new StdioServerTransport();
  }

  isAvailable(): boolean {
    // Stdio is always available when running in a terminal
    return process.stdin && process.stdout && !process.stdin.isTTY;
  }

  async start(): Promise<void> {
    if (this.isConnected) {
      throw new Error('Stdio transport already started');
    }

    try {
      this.logger.info('Starting stdio transport');
      
      // Setup error handling
      process.stdin.on('error', (error) => {
        this.logger.error({ error }, 'Stdin error');
        this.emit('error', error);
      });

      process.stdout.on('error', (error) => {
        this.logger.error({ error }, 'Stdout error');
        this.emit('error', error);
      });

      process.stdin.on('end', () => {
        this.logger.info('Stdin closed');
        this.close();
      });

      this.isConnected = true;
      this.emit('connect');
      this.logger.info('Stdio transport started successfully');
    } catch (error) {
      this.logger.error({ error }, 'Failed to start stdio transport');
      throw error;
    }
  }

  async close(): Promise<void> {
    if (!this.isConnected) return;

    try {
      this.logger.info('Closing stdio transport');
      this.isConnected = false;
      
      // Don't close stdin/stdout as they might be used by other parts
      // Just emit close event
      this.emit('close');
      this.logger.info('Stdio transport closed');
    } catch (error) {
      this.logger.error({ error }, 'Error closing stdio transport');
      throw error;
    }
  }

  getServerTransport(): ServerTransport {
    return this.transport;
  }

  configure(options: StdioTransportConfig): void {
    this.config = { ...this.config, ...options };
    this.logger.debug({ config: this.config }, 'Updated stdio transport config');
  }
}