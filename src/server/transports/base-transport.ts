import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { Logger } from '../../utils/logger';

export interface TransportConfig {
  name: string;
  port?: number;
  host?: string;
  path?: string;
}

export abstract class BaseTransport {
  protected server: Server;
  protected config: TransportConfig;
  protected logger: typeof Logger;
  protected transport?: Transport;
  protected isRunning: boolean = false;

  constructor(server: Server, config: TransportConfig) {
    this.server = server;
    this.config = config;
    this.logger = Logger;
  }

  public abstract start(): Promise<void>;
  public abstract stop(): Promise<void>;
  public abstract getHealthStatus(): { status: string; details: any };

  public isActive(): boolean {
    return this.isRunning;
  }

  public getConfig(): TransportConfig {
    return this.config;
  }

  protected async handleError(error: Error): Promise<void> {
    this.logger.error(`[${this.config.name}] Transport error:`, error);
    this.isRunning = false;
  }
}