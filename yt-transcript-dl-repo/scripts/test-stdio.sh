#!/bin/bash

# Test stdio transport with sample JSON-RPC requests

echo "Testing stdio transport..."

# List tools
echo '{"jsonrpc":"2.0","method":"tools/list","id":1}' | npm start -- --stdio

# Get transcript
echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"get_transcript","arguments":{"url":"https://www.youtube.com/watch?v=dQw4w9WgXcQ","format":"text"}},"id":2}' | npm start -- --stdio

# List resources
echo '{"jsonrpc":"2.0","method":"resources/list","id":3}' | npm start -- --stdio