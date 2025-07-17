import axios from 'axios';
import { EventSource } from 'eventsource';

// Configuration
const HTTP_URL = 'http://localhost:3002';
const SSE_URL = 'http://localhost:3001';

// Test HTTP Transport
async function testHTTPTransport() {
  console.log('\n=== Testing HTTP Transport ===');
  
  try {
    // Get available methods
    const methodsResponse = await axios.get(`${HTTP_URL}/methods`);
    console.log('Available methods:', JSON.stringify(methodsResponse.data, null, 2));
    
    // Test health endpoint
    const healthResponse = await axios.get(`${HTTP_URL}/health`);
    console.log('Health status:', JSON.stringify(healthResponse.data, null, 2));
    
    // Test RPC call
    const rpcRequest = {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list',
      params: {}
    };
    
    const rpcResponse = await axios.post(`${HTTP_URL}/rpc`, rpcRequest);
    console.log('RPC Response:', JSON.stringify(rpcResponse.data, null, 2));
    
    // Test get_transcript tool
    const transcriptRequest = {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: {
        name: 'get_transcript',
        arguments: {
          videoId: 'dQw4w9WgXcQ',
          format: 'text'
        }
      }
    };
    
    const transcriptResponse = await axios.post(`${HTTP_URL}/rpc`, transcriptRequest);
    console.log('Transcript Response:', JSON.stringify(transcriptResponse.data, null, 2));
    
  } catch (error) {
    console.error('HTTP Transport Error:', error.message);
  }
}

// Test SSE Transport
async function testSSETransport() {
  console.log('\n=== Testing SSE Transport ===');
  
  return new Promise((resolve) => {
    const eventSource = new EventSource(`${SSE_URL}/sse`);
    let sessionId: string;
    
    eventSource.onopen = () => {
      console.log('SSE Connection established');
    };
    
    eventSource.onmessage = async (event) => {
      const data = JSON.parse(event.data);
      console.log('SSE Message:', data);
      
      // Extract session ID from the initial message
      if (data.sessionId) {
        sessionId = data.sessionId;
        console.log('Session ID:', sessionId);
        
        // Send a test message via POST
        try {
          const message = {
            jsonrpc: '2.0',
            id: 1,
            method: 'tools/list',
            params: {}
          };
          
          const response = await axios.post(`${SSE_URL}/sse/message/${sessionId}`, message);
          console.log('SSE POST Response:', response.data);
        } catch (error) {
          console.error('SSE POST Error:', error.message);
        }
      }
    };
    
    eventSource.onerror = (error) => {
      console.error('SSE Error:', error);
      eventSource.close();
      resolve(null);
    };
    
    // Close after 10 seconds
    setTimeout(() => {
      console.log('Closing SSE connection');
      eventSource.close();
      resolve(null);
    }, 10000);
  });
}

// Run tests
async function runTests() {
  console.log('YouTube Transcript MCP Transport Tests');
  console.log('=====================================');
  
  await testHTTPTransport();
  await testSSETransport();
  
  console.log('\n=== Tests Complete ===');
}

// Execute if run directly
if (require.main === module) {
  runTests().catch(console.error);
}