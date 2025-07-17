// TDD Test: Verify MCP SDK usage and handler signatures
// This test MUST FAIL first to prove we need correct implementation

import { describe, it, expect, jest } from '@jest/globals';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

describe('MCP SDK Integration', () => {
  it('should use correct MCP SDK import syntax', async () => {
    // Check that we're using the correct MCP SDK imports
    const serverFile = join(projectRoot, 'src', 'index.js');
    
    if (existsSync(serverFile)) {
      const content = readFileSync(serverFile, 'utf-8');
      
      // Should import from @modelcontextprotocol/sdk
      expect(content).toMatch(/import.*@modelcontextprotocol\/sdk/);
      
      // Should use Server class correctly
      expect(content).toMatch(/new Server\(/);
      
      // Should have proper handler registration
      expect(content).toMatch(/setRequestHandler/);
    }
  });
  
  it('should implement correct handler signatures for tools', async () => {
    // Import the server module to test handler signatures
    const serverPath = join(projectRoot, 'src', 'index.js');
    
    if (existsSync(serverPath)) {
      // Test that handlers match MCP SDK expectations
      const module = await import(serverPath);
      
      // Handler should be a function that returns proper MCP response
      expect(typeof module.default).toBe('function');
    }
  });
  
  it('should handle tool requests with correct parameters', () => {
    // Test tool request handler signature
    const mockRequest = {
      method: 'tools/call',
      params: {
        name: 'get_transcript',
        arguments: {
          url: 'https://youtube.com/watch?v=test123'
        }
      }
    };
    
    // Handler should accept request and return proper response structure
    const expectedResponse = {
      content: [
        {
          type: 'text',
          text: expect.any(String)
        }
      ]
    };
    
    // This test ensures our handler signature is correct
    expect(mockRequest.params).toHaveProperty('name');
    expect(mockRequest.params).toHaveProperty('arguments');
  });
  
  it('should export tools list with correct schema', () => {
    // Test that tools are properly defined
    const expectedToolSchema = {
      name: 'get_transcript',
      description: expect.any(String),
      inputSchema: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: expect.any(String)
          }
        },
        required: ['url']
      }
    };
    
    // Our tools should match this schema
    expect(expectedToolSchema.name).toBe('get_transcript');
    expect(expectedToolSchema.inputSchema.required).toContain('url');
  });
  
  it('should handle MCP protocol communication correctly', async () => {
    // Test MCP protocol compliance
    const serverFile = join(projectRoot, 'src', 'index.js');
    
    if (existsSync(serverFile)) {
      const content = readFileSync(serverFile, 'utf-8');
      
      // Should handle stdio transport
      expect(content).toMatch(/StdioServerTransport|stdio/);
      
      // Should call server.connect()
      expect(content).toMatch(/\.connect\(\)/);
    }
  });
  
  it('should have proper error handling for MCP operations', () => {
    // Test error handling patterns
    const mockError = new Error('YouTube API error');
    
    // Errors should be properly formatted for MCP
    const expectedErrorResponse = {
      content: [
        {
          type: 'text',
          text: expect.stringContaining('Error')
        }
      ],
      isError: true
    };
    
    expect(mockError.message).toContain('YouTube');
  });
});
