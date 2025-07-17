import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { BaseTransport } from './base-transport.js';

export class StdioTransport extends BaseTransport {
  private transport?: StdioServerTransport;

  async start(): Promise<void> {
    if (!this.options.enabled) {
      this.logger.info('Stdio transport is disabled');
      return;
    }

    try {
      this.transport = new StdioServerTransport();
      await this.server.connect(this.transport);
      this.isRunning = true;
      this.logger.info('Stdio transport started successfully');
    } catch (error) {
      this.logger.error('Failed to start stdio transport:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) return;

    try {
      // Stdio transport doesn't need explicit cleanup
      this.isRunning = false;
      this.logger.info('Stdio transport stopped');
    } catch (error) {
      this.logger.error('Error stopping stdio transport:', error);
      throw error;
    }
  }
}