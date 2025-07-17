// Jest setup file for YouTube Transcript MCP Server tests

import { jest } from '@jest/globals';

// Setup test environment
beforeEach(() => {
  jest.clearAllMocks();
});

// Global test timeout
jest.setTimeout(30000);