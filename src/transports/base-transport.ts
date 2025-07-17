import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { Logger } from '../utils/logger.js';

export interface TransportOptions {
  name: string;
  enabled: boolean;
  port?: number;
  host?: string;
}

export abstract class BaseTransport {
  protected server: Server;
  protected logger: typeof Logger;
  protected options: TransportOptions;
  protected isRunning: boolean = false;

  constructor(server: Server, options: TransportOptions) {
    this.server = server;
    this.logger = Logger;
    this.options = options;
  }

  abstract start(): Promise<void>;
  abstract stop(): Promise<void>;

  public isEnabled(): boolean {
    return this.options.enabled;
  }

  public getName(): string {
    return this.options.name;
  }

  public getStatus(): { running: boolean; name: string; port?: number } {
    return {
      running: this.isRunning,
      name: this.options.name,
      port: this.options.port
    };
  }
}