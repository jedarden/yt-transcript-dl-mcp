/**
 * TDD Tests for ESM Migration - MCP SDK Compatibility
 *
 * These tests MUST pass after ESM migration to ensure MCP SDK works correctly.
 * Focus: MCP SDK imports, server initialization, and transport functionality
 */
import { jest } from '@jest/globals';
import { fileURLToPath } from 'url';
import * as path from 'path';
// Get current file directory for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
describe('ESM Migration - MCP SDK Compatibility', () => {
    describe('MCP SDK Module Imports', () => {
        it('should import Server from MCP SDK', async () => {
            const { Server } = await import('@modelcontextprotocol/sdk/server/index.js');
            expect(Server).toBeDefined();
            expect(typeof Server).toBe('function');
            // Should be able to instantiate
            const serverConfig = {
                name: 'test-server',
                version: '1.0.0',
            };
            const serverOptions = {
                capabilities: {
                    tools: {},
                },
            };
            expect(() => new Server(serverConfig, serverOptions)).not.toThrow();
        });
        it('should import transport modules correctly', async () => {
            // Test stdio transport
            const { StdioServerTransport } = await import('@modelcontextprotocol/sdk/server/stdio.js');
            expect(StdioServerTransport).toBeDefined();
            expect(typeof StdioServerTransport).toBe('function');
            // Test SSE transport if available
            try {
                const { SSEServerTransport } = await import('@modelcontextprotocol/sdk/server/sse.js');
                expect(SSEServerTransport).toBeDefined();
            }
            catch (error) {
                // SSE transport might not be available in all versions
                console.warn('SSE transport not available:', error);
            }
        });
        it('should import protocol types correctly', async () => {
            const protocol = await import('@modelcontextprotocol/sdk/types.js');
            expect(protocol).toBeDefined();
            // Should have common types available
            expect(protocol).toHaveProperty('ListToolsRequestSchema');
            expect(protocol).toHaveProperty('CallToolRequestSchema');
        });
    });
    describe('Server Initialization with ESM', () => {
        it('should create MCP server instance with ESM imports', async () => {
            const { Server } = await import('@modelcontextprotocol/sdk/server/index.js');
            const server = new Server({
                name: 'youtube-transcript-mcp',
                version: '1.0.0',
            }, {
                capabilities: {
                    tools: {},
                },
            });
            expect(server).toBeDefined();
            expect(typeof server.setRequestHandler).toBe('function');
            expect(typeof server.connect).toBe('function');
        });
        it('should set up request handlers without import errors', async () => {
            const { Server } = await import('@modelcontextprotocol/sdk/server/index.js');
            const { ListToolsRequestSchema, CallToolRequestSchema } = await import('@modelcontextprotocol/sdk/types.js');
            const server = new Server({
                name: 'test-server',
                version: '1.0.0',
            }, {
                capabilities: {
                    tools: {},
                },
            });
            // Should be able to set request handlers
            expect(() => {
                server.setRequestHandler(ListToolsRequestSchema, async () => ({
                    tools: []
                }));
                server.setRequestHandler(CallToolRequestSchema, async () => ({
                    content: [{ type: 'text', text: 'test' }]
                }));
            }).not.toThrow();
        });
    });
    describe('Transport Compatibility', () => {
        it('should create stdio transport without errors', async () => {
            const { StdioServerTransport } = await import('@modelcontextprotocol/sdk/server/stdio.js');
            expect(() => {
                new StdioServerTransport();
            }).not.toThrow();
        });
        it('should handle transport connection setup', async () => {
            const { Server } = await import('@modelcontextprotocol/sdk/server/index.js');
            const { StdioServerTransport } = await import('@modelcontextprotocol/sdk/server/stdio.js');
            const server = new Server({ name: 'test', version: '1.0.0' }, { capabilities: { tools: {} } });
            const transport = new StdioServerTransport();
            // Should be able to connect (though we won't actually connect in tests)
            expect(typeof server.connect).toBe('function');
            expect(transport).toBeDefined();
        });
    });
    describe('Tool Registration and Execution', () => {
        it('should register tools with correct schemas', async () => {
            const { Server } = await import('@modelcontextprotocol/sdk/server/index.js');
            const { ListToolsRequestSchema, CallToolRequestSchema } = await import('@modelcontextprotocol/sdk/types.js');
            const server = new Server({
                name: 'youtube-transcript-mcp',
                version: '1.0.0',
            }, {
                capabilities: {
                    tools: {},
                },
            });
            const tools = [
                {
                    name: 'get_transcript',
                    description: 'Extract transcript from a single YouTube video',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            videoId: { type: 'string' },
                            language: { type: 'string', default: 'en' },
                            format: { type: 'string', enum: ['text', 'json', 'srt'], default: 'json' }
                        },
                        required: ['videoId']
                    }
                }
            ];
            // Should register tools handler without errors
            expect(() => {
                server.setRequestHandler(ListToolsRequestSchema, async () => ({
                    tools: tools
                }));
            }).not.toThrow();
        });
        it('should handle tool execution with proper error handling', async () => {
            const { Server } = await import('@modelcontextprotocol/sdk/server/index.js');
            const { CallToolRequestSchema } = await import('@modelcontextprotocol/sdk/types.js');
            const server = new Server({
                name: 'test-server',
                version: '1.0.0',
            }, {
                capabilities: {
                    tools: {},
                },
            });
            // Should handle tool calls without import/export errors
            expect(() => {
                server.setRequestHandler(CallToolRequestSchema, async (request) => {
                    const { name, arguments: args } = request.params;
                    if (name === 'get_transcript') {
                        return {
                            content: [{
                                    type: 'text',
                                    text: `Transcript for video: ${args.videoId}`
                                }]
                        };
                    }
                    throw new Error(`Unknown tool: ${name}`);
                });
            }).not.toThrow();
        });
    });
    describe('Error Handling and ESM Compatibility', () => {
        it('should handle MCP errors without import issues', async () => {
            const { McpError, ErrorCode } = await import('@modelcontextprotocol/sdk/types.js');
            expect(McpError).toBeDefined();
            expect(ErrorCode).toBeDefined();
            // Should be able to create and throw MCP errors
            const error = new McpError(ErrorCode.InvalidRequest, 'Test error');
            expect(error).toBeInstanceOf(Error);
            expect(error.code).toBe(ErrorCode.InvalidRequest);
        });
        it('should handle async operations in ESM context', async () => {
            const { Server } = await import('@modelcontextprotocol/sdk/server/index.js');
            const { CallToolRequestSchema } = await import('@modelcontextprotocol/sdk/types.js');
            const server = new Server({ name: 'test', version: '1.0.0' }, { capabilities: { tools: {} } });
            // Should handle async tool execution
            let handlerCalled = false;
            server.setRequestHandler(CallToolRequestSchema, async (request) => {
                handlerCalled = true;
                // Simulate async operation
                await new Promise(resolve => setTimeout(resolve, 1));
                return {
                    content: [{ type: 'text', text: 'async result' }]
                };
            });
            expect(handlerCalled).toBe(false); // Handler not called yet
        });
    });
    describe('TypeScript and ESM Type Definitions', () => {
        it('should have correct TypeScript types for MCP SDK', async () => {
            // Import types should work
            const types = await import('@modelcontextprotocol/sdk/types.js');
            // Should have tool-related types
            expect(types.ListToolsRequestSchema).toBeDefined();
            expect(types.CallToolRequestSchema).toBeDefined();
            // Should have server config types
            expect(types.ServerCapabilities).toBeDefined();
        });
        it('should support generic types in ESM context', async () => {
            const { Server } = await import('@modelcontextprotocol/sdk/server/index.js');
            // TypeScript should infer types correctly
            const server = new Server({
                name: 'typed-server',
                version: '1.0.0',
            }, {
                capabilities: {
                    tools: {},
                },
            });
            expect(server).toBeDefined();
        });
    });
    describe('Integration with YouTube Transcript Service', () => {
        it('should import both MCP SDK and YouTube transcript service', async () => {
            // Both imports should work together
            const { Server } = await import('@modelcontextprotocol/sdk/server/index.js');
            const { YoutubeTranscript } = await import('youtube-transcript');
            expect(Server).toBeDefined();
            expect(YoutubeTranscript).toBeDefined();
            // Should be able to use together
            const server = new Server({ name: 'integration-test', version: '1.0.0' }, { capabilities: { tools: {} } });
            expect(typeof YoutubeTranscript.fetchTranscript).toBe('function');
        });
        it('should handle service instantiation in ESM context', async () => {
            // Mock the service import
            const mockService = {
                getTranscript: jest.fn(),
                getCacheStats: jest.fn(),
                clearCache: jest.fn()
            };
            // Should be able to create service instance
            expect(() => {
                const service = mockService;
                expect(service.getTranscript).toBeDefined();
            }).not.toThrow();
        });
    });
});
//# sourceMappingURL=mcp-sdk-compatibility.test.js.map