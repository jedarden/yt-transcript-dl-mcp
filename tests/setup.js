// Jest setup file for YouTube Transcript MCP Server tests
import { jest } from '@jest/globals';
// Mock winston logger to avoid console output during tests
jest.mock('winston', () => ({
  createLogger: jest.fn(() => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  })),
  format: {
    timestamp: jest.fn(),
    errors: jest.fn(),
    json: jest.fn(),
    simple: jest.fn(),
    combine: jest.fn(),
  },
  transports: {
    Console: jest.fn(),
    File: jest.fn(),
  },
}));
// Mock youtube-transcript
jest.mock('youtube-transcript', () => ({
  YoutubeTranscript: {
    fetchTranscript: jest.fn(),
  },
}));
// Setup test environment
beforeEach(() => {
  jest.clearAllMocks();
});
// Global test timeout
jest.setTimeout(30000);
//# sourceMappingURL=setup.js.map