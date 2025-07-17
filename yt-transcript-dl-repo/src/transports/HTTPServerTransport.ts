import { ServerTransport } from '@modelcontextprotocol/sdk/server/index.js';
import { JSONRPCRequest, JSONRPCResponse } from '@modelcontextprotocol/sdk/types.js';
import { EventEmitter } from 'events';

export class HTTPServerTransport extends EventEmitter implements ServerTransport {
  private requestHandlers: Map<string, (request: JSONRPCRequest) => Promise<JSONRPCResponse>> = new Map();
  
  start(): Promise<void> {
    // HTTP transport starts via the HTTPTransport class
    return Promise.resolve();
  }

  close(): Promise<void> {
    this.requestHandlers.clear();
    return Promise.resolve();
  }

  async handleRequest(request: JSONRPCRequest): Promise<JSONRPCResponse> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Request timeout'));
      }, 30000);

      this.once(`response:${request.id}`, (response: JSONRPCResponse) => {
        clearTimeout(timeout);
        resolve(response);
      });

      // Emit request to be handled by MCP server
      this.emit('request', request, (response: JSONRPCResponse) => {
        this.emit(`response:${request.id}`, response);
      });
    });
  }
}