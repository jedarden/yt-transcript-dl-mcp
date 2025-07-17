export interface MCPServerConfig {
  name: string;
  version: string;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
  transports?: {
    stdio?: StdioTransportConfig;
    sse?: SSETransportConfig;
    http?: HTTPTransportConfig;
  };
}

export interface StdioTransportConfig {
  enabled?: boolean;
}

export interface SSETransportConfig {
  enabled?: boolean;
  port?: number;
  host?: string;
  cors?: {
    origin?: string | string[];
    credentials?: boolean;
  };
  keepAliveInterval?: number;
  maxClients?: number;
}

export interface HTTPTransportConfig {
  enabled?: boolean;
  port?: number;
  host?: string;
  cors?: {
    origin?: string | string[];
    credentials?: boolean;
  };
  maxBodySize?: string;
  timeout?: number;
  rateLimit?: {
    windowMs?: number;
    max?: number;
  };
}