import { ServerTransport } from '@modelcontextprotocol/sdk/server/index.js';
import { JSONRPCRequest, JSONRPCResponse } from '@modelcontextprotocol/sdk/types.js';
import { EventEmitter } from 'events';
import type { Response } from 'express';

interface SSEClient {
  id: string;
  response: Response;
  lastActivity: number;
}

export class SSEServerTransport extends EventEmitter implements ServerTransport {
  private clients: Map<string, SSEClient> = new Map();
  private requestHandlers: Map<string, (request: JSONRPCRequest) => Promise<JSONRPCResponse>> = new Map();
  
  start(): Promise<void> {
    // SSE transport starts via the SSETransport class
    return Promise.resolve();
  }

  close(): Promise<void> {
    this.clients.clear();
    this.requestHandlers.clear();
    return Promise.resolve();
  }

  registerClient(clientId: string, client: SSEClient): void {
    this.clients.set(clientId, client);
  }

  handleClientDisconnect(clientId: string): void {
    this.clients.delete(clientId);
  }

  async handleRequest(clientId: string, request: JSONRPCRequest): Promise<JSONRPCResponse> {
    const client = this.clients.get(clientId);
    if (!client) {
      throw new Error('Client not found');
    }

    // Emit request for MCP server to handle
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

  sendNotification(clientId: string, notification: any): void {
    const client = this.clients.get(clientId);
    if (client) {
      try {
        const message = `data: ${JSON.stringify({
          type: 'notification',
          data: notification
        })}\n\n`;
        client.response.write(message);
      } catch (error) {
        console.error('Error sending notification:', error);
        this.clients.delete(clientId);
      }
    }
  }

  broadcastNotification(notification: any): void {
    for (const [clientId] of this.clients) {
      this.sendNotification(clientId, notification);
    }
  }
}