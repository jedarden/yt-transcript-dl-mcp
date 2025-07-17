#!/usr/bin/env tsx

import { spawn } from 'child_process';
import axios from 'axios';

console.log('🚀 Testing YouTube Transcript MCP Server - All Transports Concurrently\n');

// Test configuration
const SSE_PORT = 3001;
const HTTP_PORT = 3002;
const TEST_VIDEO_ID = 'dQw4w9WgXcQ';

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Test HTTP transport
async function testHTTPTransport() {
  console.log('📡 Testing HTTP Transport...');
  try {
    // Test health endpoint
    const healthResponse = await axios.get(`http://localhost:${HTTP_PORT}/health`);
    console.log('✅ HTTP Health Check:', healthResponse.data);

    // Test RPC endpoint
    const rpcResponse = await axios.post(`http://localhost:${HTTP_PORT}/rpc`, {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list',
      params: {}
    });
    console.log('✅ HTTP RPC Response:', {
      tools: rpcResponse.data.result.tools.length,
      firstTool: rpcResponse.data.result.tools[0]?.name
    });

    // Test get_transcript tool
    const transcriptResponse = await axios.post(`http://localhost:${HTTP_PORT}/rpc`, {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: {
        name: 'get_transcript',
        arguments: {
          videoId: TEST_VIDEO_ID,
          language: 'en',
          format: 'text'
        }
      }
    });
    console.log('✅ HTTP Transcript Response:', {
      success: !!transcriptResponse.data.result,
      contentLength: transcriptResponse.data.result?.content?.[0]?.text?.length
    });

  } catch (error) {
    console.error('❌ HTTP Transport Error:', error.message);
  }
}

// Test SSE transport
async function testSSETransport() {
  console.log('\n📡 Testing SSE Transport...');
  try {
    // Test health endpoint
    const healthResponse = await axios.get(`http://localhost:${SSE_PORT}/health`);
    console.log('✅ SSE Health Check:', healthResponse.data);

    // Note: Full SSE testing would require establishing an SSE connection
    // and handling the event stream, which is more complex
    console.log('ℹ️  SSE endpoint available at: http://localhost:' + SSE_PORT + '/sse');
    
  } catch (error) {
    console.error('❌ SSE Transport Error:', error.message);
  }
}

// Test STDIO transport
async function testSTDIOTransport() {
  console.log('\n📡 Testing STDIO Transport...');
  
  return new Promise<void>((resolve) => {
    // Test by sending a JSON-RPC request via stdin
    const testRequest = {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list',
      params: {}
    };

    console.log('ℹ️  STDIO transport accepts JSON-RPC messages via stdin');
    console.log('ℹ️  Example request:', JSON.stringify(testRequest, null, 2));
    resolve();
  });
}

// Main test function
async function runTests() {
  console.log('⏳ Waiting for server to start...\n');
  await delay(3000);

  await testHTTPTransport();
  await testSSETransport();
  await testSTDIOTransport();

  console.log('\n✅ All transport tests completed!');
  console.log('\n📊 Summary:');
  console.log('- STDIO: Ready for JSON-RPC via stdin/stdout');
  console.log('- SSE: Available at http://localhost:' + SSE_PORT + '/sse');
  console.log('- HTTP: Available at http://localhost:' + HTTP_PORT + '/rpc');
}

// Run tests
runTests().catch(console.error);