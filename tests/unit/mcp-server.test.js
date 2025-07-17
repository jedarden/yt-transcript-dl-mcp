import { jest } from '@jest/globals';
import { YouTubeTranscriptMCPServer } from '../../src/server/mcp-server';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
// Mock the dependencies
jest.mock('@modelcontextprotocol/sdk/server/index.js');
jest.mock('../../src/services/youtube-transcript.service');
jest.mock('../../src/utils/logger');
const MockServer = Server;
describe('YouTubeTranscriptMCPServer', () => {
    let mcpServer;
    let mockServerInstance;
    beforeEach(() => {
        jest.clearAllMocks();
        // Create a mock server instance
        mockServerInstance = {
            setRequestHandler: jest.fn(),
            connect: jest.fn(),
        };
        MockServer.mockImplementation(() => mockServerInstance);
        mcpServer = new YouTubeTranscriptMCPServer();
    });
    describe('constructor', () => {
        it('should initialize server with correct configuration', () => {
            expect(MockServer).toHaveBeenCalledWith({
                name: 'youtube-transcript-mcp',
                version: '1.0.0',
            }, {
                capabilities: {
                    tools: {},
                },
            });
        });
        it('should set up request handlers', () => {
            expect(mockServerInstance.setRequestHandler).toHaveBeenCalledTimes(2);
        });
    });
    describe('tool listing', () => {
        it('should provide correct tool definitions', () => {
            // Get the handler function from the setRequestHandler call
            const listToolsHandler = mockServerInstance.setRequestHandler.mock.calls
                .find(call => call[0])?.[1];
            expect(listToolsHandler).toBeDefined();
            if (listToolsHandler) {
                const result = listToolsHandler({}, {});
                expect(result).toEqual({
                    tools: expect.arrayContaining([
                        expect.objectContaining({
                            name: 'get_transcript',
                            description: 'Extract transcript from a single YouTube video'
                        }),
                        expect.objectContaining({
                            name: 'get_bulk_transcripts',
                            description: 'Extract transcripts from multiple YouTube videos'
                        }),
                        expect.objectContaining({
                            name: 'get_playlist_transcripts',
                            description: 'Extract transcripts from all videos in a YouTube playlist'
                        }),
                        expect.objectContaining({
                            name: 'format_transcript',
                            description: 'Format existing transcript data into different formats'
                        }),
                        expect.objectContaining({
                            name: 'get_cache_stats',
                            description: 'Get cache statistics and performance metrics'
                        }),
                        expect.objectContaining({
                            name: 'clear_cache',
                            description: 'Clear the transcript cache'
                        })
                    ])
                });
            }
        });
    });
    describe('tool execution', () => {
        let callToolHandler;
        beforeEach(() => {
            // Get the call tool handler
            callToolHandler = mockServerInstance.setRequestHandler.mock.calls
                .find(call => call[0])?.[1];
        });
        it('should handle get_transcript tool call', async () => {
            const request = {
                params: {
                    name: 'get_transcript',
                    arguments: {
                        videoId: 'dQw4w9WgXcQ',
                        language: 'en',
                        format: 'json'
                    }
                }
            };
            const result = await callToolHandler(request, {});
            expect(result).toEqual({
                content: [{
                        type: 'text',
                        text: expect.stringContaining('dQw4w9WgXcQ')
                    }]
            });
        });
        it('should handle get_bulk_transcripts tool call', async () => {
            const request = {
                params: {
                    name: 'get_bulk_transcripts',
                    arguments: {
                        videoIds: ['dQw4w9WgXcQ', 'jNQXAC9IVRw'],
                        language: 'en',
                        outputFormat: 'json'
                    }
                }
            };
            const result = await callToolHandler(request, {});
            expect(result).toEqual({
                content: [{
                        type: 'text',
                        text: expect.stringContaining('results')
                    }]
            });
        });
        it('should handle get_cache_stats tool call', async () => {
            const request = {
                params: {
                    name: 'get_cache_stats',
                    arguments: {}
                }
            };
            const result = await callToolHandler(request, {});
            expect(result).toEqual({
                content: [{
                        type: 'text',
                        text: expect.any(String)
                    }]
            });
        });
        it('should handle clear_cache tool call', async () => {
            const request = {
                params: {
                    name: 'clear_cache',
                    arguments: {}
                }
            };
            const result = await callToolHandler(request, {});
            expect(result).toEqual({
                content: [{
                        type: 'text',
                        text: 'Cache cleared successfully'
                    }]
            });
        });
        it('should throw error for unknown tool', async () => {
            const request = {
                params: {
                    name: 'unknown_tool',
                    arguments: {}
                }
            };
            await expect(callToolHandler(request, {})).rejects.toThrow();
        });
        it('should throw error for missing required parameters', async () => {
            const request = {
                params: {
                    name: 'get_transcript',
                    arguments: {} // Missing videoId
                }
            };
            await expect(callToolHandler(request, {})).rejects.toThrow();
        });
    });
    describe('server startup', () => {
        it('should start with stdio transport', async () => {
            process.env.MCP_TRANSPORT = 'stdio';
            await mcpServer.start();
            expect(mockServerInstance.connect).toHaveBeenCalledWith({
                reader: process.stdin,
                writer: process.stdout
            });
        });
        it('should throw error for unsupported transport', async () => {
            process.env.MCP_TRANSPORT = 'unsupported';
            await expect(mcpServer.start()).rejects.toThrow('Unsupported transport: unsupported');
        });
    });
    describe('server instance access', () => {
        it('should return server instance', () => {
            const server = mcpServer.getServer();
            expect(server).toBe(mockServerInstance);
        });
    });
});
//# sourceMappingURL=mcp-server.test.js.map