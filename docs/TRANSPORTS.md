# YouTube Transcript MCP Server - Transport Documentation

## Overview

The YouTube Transcript MCP Server supports three concurrent transport protocols, allowing clients to connect using their preferred method. All transports run simultaneously when multi-transport mode is enabled.

## Transport Types

### 1. STDIO Transport (Standard Input/Output)

**Use Case**: CLI tools, local development, process-based communication

**Configuration**:
```bash
STDIO_ENABLED=true
```

**Usage**:
```bash
# Direct usage
yt-transcript-dl-mcp start

# Or pipe JSON-RPC messages
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | yt-transcript-dl-mcp
```

**Example Request**:
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "get_transcript",
    "arguments": {
      "videoId": "dQw4w9WgXcQ",
      "language": "en",
      "format": "json"
    }
  }
}
```

### 2. SSE Transport (Server-Sent Events)

**Use Case**: Web applications, real-time streaming, browser-based clients

**Configuration**:
```bash
SSE_ENABLED=true
SSE_PORT=3001
SSE_HOST=0.0.0.0
```

**Endpoints**:
- `GET /` - Server information
- `GET /health` - Health check
- `GET /sse` - SSE event stream
- `POST /sse/message/:sessionId` - Send messages

**Client Example** (JavaScript):
```javascript
const eventSource = new EventSource('http://localhost:3001/sse');

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Received:', data);
};

// Send request via POST
fetch('http://localhost:3001/sse/message/session123', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/list',
    params: {}
  })
});
```

### 3. HTTP Transport (JSON-RPC over HTTP)

**Use Case**: Traditional REST clients, server-to-server communication, API integrations

**Configuration**:
```bash
HTTP_ENABLED=true
HTTP_PORT=3002
HTTP_HOST=0.0.0.0
```

**Endpoints**:
- `GET /` - Server information
- `GET /health` - Health check
- `POST /rpc` - JSON-RPC endpoint

**Client Example** (cURL):
```bash
# List available tools
curl -X POST http://localhost:3002/rpc \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/list",
    "params": {}
  }'

# Get transcript
curl -X POST http://localhost:3002/rpc \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/call",
    "params": {
      "name": "get_transcript",
      "arguments": {
        "videoId": "dQw4w9WgXcQ",
        "language": "en",
        "format": "text"
      }
    }
  }'
```

## Multi-Transport Mode

Enable all transports to run concurrently:

```bash
# Via environment variable
export MCP_MULTI_TRANSPORT=true

# Or use the npm script
npm run start:multi
```

### Default Ports
- STDIO: No port (process communication)
- SSE: 3001
- HTTP: 3002

### Docker Support

Run with all ports exposed:
```bash
docker run -p 3001:3001 -p 3002:3002 yt-transcript-dl-mcp
```

Docker Compose:
```yaml
services:
  yt-transcript-mcp:
    image: yt-transcript-dl-mcp
    environment:
      - MCP_MULTI_TRANSPORT=true
    ports:
      - "3001:3001"  # SSE
      - "3002:3002"  # HTTP
```

## Health Monitoring

Each transport provides health endpoints:

- **SSE**: `GET http://localhost:3001/health`
- **HTTP**: `GET http://localhost:3002/health`

Response format:
```json
{
  "status": "healthy",
  "transport": "http",
  "timestamp": "2025-07-16T12:00:00.000Z"
}
```

## Security Considerations

### CORS Configuration
```bash
CORS_ENABLED=true
CORS_ORIGINS=https://trusted-domain.com,http://localhost:3000
```

### Rate Limiting (HTTP Transport)
```bash
RATE_LIMIT_WINDOW=900000  # 15 minutes
RATE_LIMIT_MAX=100        # 100 requests per window
```

### Authentication
While not implemented by default, you can add authentication middleware:

```javascript
// Example: API Key authentication
app.use((req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey || apiKey !== process.env.API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
});
```

## Performance Optimization

### Connection Pooling
Each transport maintains its own connection pool:
- STDIO: Single process connection
- SSE: Multiple concurrent EventSource connections
- HTTP: Connection pooling via Keep-Alive

### Caching
All transports share the same cache layer:
```bash
CACHE_ENABLED=true
CACHE_TTL=3600      # 1 hour
CACHE_MAX_SIZE=1000 # Max cached items
```

### Load Balancing
For high traffic, run multiple instances behind a load balancer:

```nginx
upstream mcp_servers {
    server localhost:3002;
    server localhost:3003;
    server localhost:3004;
}

server {
    location /rpc {
        proxy_pass http://mcp_servers;
    }
}
```

## Troubleshooting

### Check Transport Status
```bash
# Via logs
npm start | grep "transport"

# Via API (when server is running)
curl http://localhost:3002/health
```

### Common Issues

1. **Port Already in Use**
   ```bash
   # Change ports via environment variables
   SSE_PORT=4001 HTTP_PORT=4002 npm start
   ```

2. **CORS Errors**
   ```bash
   # Allow all origins (development only)
   CORS_ORIGINS=* npm start
   ```

3. **Connection Timeouts**
   - Increase timeout settings in client
   - Check firewall rules
   - Verify network connectivity

## Example Client Implementations

### Node.js Client
```javascript
const axios = require('axios');

class MCPClient {
  constructor(transport = 'http', port = 3002) {
    this.baseURL = `http://localhost:${port}`;
  }

  async callTool(toolName, args) {
    const response = await axios.post(`${this.baseURL}/rpc`, {
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: args
      }
    });
    return response.data.result;
  }
}

// Usage
const client = new MCPClient();
const result = await client.callTool('get_transcript', {
  videoId: 'dQw4w9WgXcQ',
  format: 'text'
});
```

### Python Client
```python
import requests
import json

class MCPClient:
    def __init__(self, transport='http', port=3002):
        self.base_url = f'http://localhost:{port}'
    
    def call_tool(self, tool_name, args):
        response = requests.post(f'{self.base_url}/rpc', json={
            'jsonrpc': '2.0',
            'id': 1,
            'method': 'tools/call',
            'params': {
                'name': tool_name,
                'arguments': args
            }
        })
        return response.json()['result']

# Usage
client = MCPClient()
result = client.call_tool('get_transcript', {
    'videoId': 'dQw4w9WgXcQ',
    'format': 'text'
})
```

## Best Practices

1. **Choose the Right Transport**:
   - STDIO: For CLI tools and local scripts
   - SSE: For real-time web applications
   - HTTP: For server-to-server communication

2. **Enable Only What You Need**:
   - Disable unused transports to save resources
   - Use single transport mode for simpler deployments

3. **Monitor Health Endpoints**:
   - Set up monitoring for each transport
   - Alert on health check failures

4. **Implement Retry Logic**:
   - Handle transient failures gracefully
   - Use exponential backoff for retries

5. **Secure Production Deployments**:
   - Use HTTPS/WSS in production
   - Implement proper authentication
   - Restrict CORS origins
   - Enable rate limiting