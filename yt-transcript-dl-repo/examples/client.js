#!/usr/bin/env node

/**
 * Example client for testing the YouTube Transcript MCP Server
 */

import fetch from 'node-fetch';
import { EventSource } from 'eventsource';

// Configuration
const HTTP_URL = 'http://localhost:3457/rpc';
const SSE_URL = 'http://localhost:3456';

// Example: HTTP Transport Client
async function testHTTPTransport() {
  console.log('\n🚀 Testing HTTP Transport...\n');

  // List available tools
  const listToolsResponse = await fetch(HTTP_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'tools/list',
      id: 1
    })
  });

  const tools = await listToolsResponse.json();
  console.log('Available tools:', JSON.stringify(tools, null, 2));

  // Get transcript
  const getTranscriptResponse = await fetch(HTTP_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: 'get_transcript',
        arguments: {
          url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          format: 'text'
        }
      },
      id: 2
    })
  });

  const transcript = await getTranscriptResponse.json();
  console.log('\nTranscript result:', JSON.stringify(transcript, null, 2));
}

// Example: SSE Transport Client
async function testSSETransport() {
  console.log('\n🚀 Testing SSE Transport...\n');

  return new Promise((resolve) => {
    const eventSource = new EventSource(`${SSE_URL}/sse`);
    let clientId = null;

    eventSource.onopen = () => {
      console.log('✅ SSE connection established');
    };

    eventSource.onmessage = async (event) => {
      const data = JSON.parse(event.data);
      console.log('📨 SSE message:', data);

      if (data.type === 'connection' && data.data.clientId) {
        clientId = data.data.clientId;
        console.log(`🆔 Client ID: ${clientId}`);

        // Make an RPC call via SSE
        const response = await fetch(`${SSE_URL}/rpc/${clientId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'tools/list',
            id: 1
          })
        });

        const result = await response.json();
        console.log('\n📋 Tools via SSE:', JSON.stringify(result, null, 2));

        // Close connection after test
        setTimeout(() => {
          eventSource.close();
          console.log('\n❌ SSE connection closed');
          resolve();
        }, 2000);
      }
    };

    eventSource.onerror = (error) => {
      console.error('❌ SSE error:', error);
      eventSource.close();
      resolve();
    };
  });
}

// Example: Batch requests
async function testBatchRequests() {
  console.log('\n🚀 Testing Batch Requests...\n');

  const batchResponse = await fetch(`${HTTP_URL}/batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify([
      {
        jsonrpc: '2.0',
        method: 'tools/list',
        id: 1
      },
      {
        jsonrpc: '2.0',
        method: 'resources/list',
        id: 2
      }
    ])
  });

  const batchResults = await batchResponse.json();
  console.log('Batch results:', JSON.stringify(batchResults, null, 2));
}

// Main execution
async function main() {
  console.log('🎯 YouTube Transcript MCP Server Test Client\n');

  const args = process.argv.slice(2);
  const transport = args[0] || 'http';

  try {
    switch (transport) {
      case 'http':
        await testHTTPTransport();
        break;
      case 'sse':
        await testSSETransport();
        break;
      case 'batch':
        await testBatchRequests();
        break;
      case 'all':
        await testHTTPTransport();
        await testSSETransport();
        await testBatchRequests();
        break;
      default:
        console.log('Usage: node client.js [http|sse|batch|all]');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Install required packages if needed
try {
  await import('node-fetch');
  await import('eventsource');
} catch {
  console.log('📦 Installing required packages...');
  const { execSync } = await import('child_process');
  execSync('npm install node-fetch eventsource', { stdio: 'inherit' });
}

main();