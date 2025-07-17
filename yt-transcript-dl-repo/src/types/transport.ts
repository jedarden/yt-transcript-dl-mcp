import { EventEmitter } from 'events';
import type { ServerTransport } from '@modelcontextprotocol/sdk/server/index.js';

export interface Transport extends EventEmitter {
  /**
   * Check if transport is available
   */
  isAvailable(): boolean;

  /**
   * Start the transport
   */
  start(): Promise<void>;

  /**
   * Close the transport
   */
  close(): Promise<void>;

  /**
   * Get the underlying server transport for MCP SDK
   */
  getServerTransport(): ServerTransport;

  /**
   * Transport-specific configuration
   */
  configure(options: any): void;
}

export interface TransportEvents {
  error: (error: Error) => void;
  close: () => void;
  connect: () => void;
  disconnect: () => void;
}