export interface TranscriptItem {
  text: string;
  start: number;
  duration: number;
}

export interface TranscriptResponse {
  videoId: string;
  title?: string;
  language: string;
  transcript: TranscriptItem[];
  metadata?: {
    extractedAt: string;
    source: 'youtube-transcript' | 'fallback';
    duration?: number;
    error?: string;
  };
}

export interface BulkTranscriptRequest {
  videoIds: string[];
  outputFormat: 'text' | 'json' | 'srt';
  language?: string;
  includeMetadata?: boolean;
}

export interface BulkTranscriptResponse {
  results: TranscriptResponse[];
  errors: Array<{
    videoId: string;
    error: string;
  }>;
  summary: {
    total: number;
    successful: number;
    failed: number;
  };
}

export interface PlaylistTranscriptRequest {
  playlistId: string;
  outputFormat: 'text' | 'json' | 'srt';
  language?: string;
  includeMetadata?: boolean;
}

export interface McpTool {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface McpResource {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
}

export interface McpMessage {
  jsonrpc: '2.0';
  id?: string | number;
  method?: string;
  params?: any;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

export interface ServerConfig {
  port: number;
  host: string;
  cors: {
    enabled: boolean;
    origins: string[];
  };
  rateLimit: {
    windowMs: number;
    max: number;
  };
  cache: {
    enabled: boolean;
    ttl: number;
    maxSize: number;
  };
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
    format: 'json' | 'simple';
  };
}

export interface TransportConfig {
  stdio: {
    enabled: boolean;
  };
  sse: {
    enabled: boolean;
    endpoint: string;
  };
  http: {
    enabled: boolean;
    endpoint: string;
  };
}