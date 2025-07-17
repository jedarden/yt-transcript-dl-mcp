# YouTube Transcript DL MCP Server

A comprehensive MCP (Model Context Protocol) server for extracting YouTube video transcripts with support for multiple transports (stdio, SSE, HTTP), Docker deployment, and npm package distribution.

## Features

- 🎯 **Multiple Transport Support**: stdio, Server-Sent Events (SSE), and HTTP
- 📹 **Comprehensive Transcript Extraction**: Single videos, bulk processing, and playlists
- 🌍 **Multi-language Support**: Extract transcripts in different languages
- 📝 **Multiple Output Formats**: Text, JSON, and SRT subtitle formats
- 🚀 **High Performance**: Built-in caching and rate limiting
- 🐳 **Docker Ready**: Full containerization support
- 📦 **npm Package**: Easy installation and distribution
- 🧪 **Test-Driven Development**: Comprehensive test suite with 90%+ coverage
- 🔧 **TypeScript**: Full type safety and modern JavaScript features

## Installation

### As an npm package

```bash
npm install -g yt-transcript-dl-mcp
```

### From source

```bash
git clone <repository-url>
cd yt-transcript-dl-repo
npm install
npm run build
```

### Docker

```bash
# From GitHub Container Registry (recommended)
docker pull ghcr.io/jedarden/yt-transcript-dl-mcp:latest
docker run -p 3001:3001 -p 3002:3002 ghcr.io/jedarden/yt-transcript-dl-mcp:latest --multi-transport

# Build from source
docker build -t yt-transcript-dl-mcp .
docker run -p 3001:3001 -p 3002:3002 yt-transcript-dl-mcp --multi-transport
```

## Usage

### MCP Server

Start the MCP server in different modes:

```bash
# Stdio mode (default)
yt-transcript-dl-mcp start

# SSE mode
yt-transcript-dl-mcp start --transport sse --port 3000

# HTTP mode
yt-transcript-dl-mcp start --transport http --port 3000

# With verbose logging
yt-transcript-dl-mcp start --verbose
```

### CLI Tool

Test the server with a sample video:

```bash
# Test with a YouTube video
yt-transcript-dl-mcp test dQw4w9WgXcQ

# Test with different language
yt-transcript-dl-mcp test dQw4w9WgXcQ --language es

# Test with different format
yt-transcript-dl-mcp test dQw4w9WgXcQ --format srt
```

### Programmatic Usage

```typescript
import { YouTubeTranscriptService } from 'yt-transcript-dl-mcp';

const service = new YouTubeTranscriptService();

// Extract single video transcript
const result = await service.getTranscript('dQw4w9WgXcQ', 'en', 'json');
console.log(result);

// Bulk processing
const bulkResult = await service.getBulkTranscripts({
  videoIds: ['dQw4w9WgXcQ', 'jNQXAC9IVRw'],
  outputFormat: 'json',
  language: 'en'
});
console.log(bulkResult);
```

## MCP Tools

The server provides the following MCP tools:

### `get_transcript`
Extract transcript from a single YouTube video.

**Parameters:**
- `videoId` (required): YouTube video ID or URL
- `language` (optional): Language code (default: 'en')
- `format` (optional): Output format - 'text', 'json', or 'srt' (default: 'json')

### `get_bulk_transcripts`
Extract transcripts from multiple YouTube videos.

**Parameters:**
- `videoIds` (required): Array of YouTube video IDs or URLs
- `language` (optional): Language code (default: 'en')
- `outputFormat` (optional): Output format - 'text', 'json', or 'srt' (default: 'json')
- `includeMetadata` (optional): Include metadata in response (default: true)

### `get_playlist_transcripts`
Extract transcripts from all videos in a YouTube playlist.

**Parameters:**
- `playlistId` (required): YouTube playlist ID or URL
- `language` (optional): Language code (default: 'en')
- `outputFormat` (optional): Output format - 'text', 'json', or 'srt' (default: 'json')
- `includeMetadata` (optional): Include metadata in response (default: true)

### `format_transcript`
Format existing transcript data into different formats.

**Parameters:**
- `transcript` (required): Transcript data array
- `format` (required): Output format - 'text', 'json', or 'srt'

### `get_cache_stats`
Get cache statistics and performance metrics.

### `clear_cache`
Clear the transcript cache.

## Configuration

### Environment Variables

```bash
# Server configuration
PORT=3000
HOST=0.0.0.0
MCP_TRANSPORT=stdio

# CORS settings
CORS_ENABLED=true
CORS_ORIGINS=*

# Rate limiting
RATE_LIMIT_WINDOW=900000  # 15 minutes in ms
RATE_LIMIT_MAX=100

# Caching
CACHE_ENABLED=true
CACHE_TTL=3600  # 1 hour in seconds
CACHE_MAX_SIZE=1000

# Logging
LOG_LEVEL=info
LOG_FORMAT=simple
```

### Configuration File

Create a `config.json` file:

```json
{
  "port": 3000,
  "host": "0.0.0.0",
  "cors": {
    "enabled": true,
    "origins": ["*"]
  },
  "rateLimit": {
    "windowMs": 900000,
    "max": 100
  },
  "cache": {
    "enabled": true,
    "ttl": 3600,
    "maxSize": 1000
  },
  "logging": {
    "level": "info",
    "format": "simple"
  }
}
```

## Docker Deployment

### Docker Compose

```yaml
version: '3.8'

services:
  yt-transcript-mcp:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
      - LOG_LEVEL=info
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "node", "dist/health-check.js"]
      interval: 30s
      timeout: 10s
      retries: 3
```

### Health Checks

The Docker container includes built-in health checks:

```bash
# Check container health
docker ps
docker exec <container-id> node dist/health-check.js
```

## Development

### Setup

```bash
git clone <repository-url>
cd yt-transcript-dl-repo
npm install
```

### Running Tests

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run specific test suites
npm run test:unit
npm run test:integration
npm run test:e2e

# Watch mode
npm run test:watch
```

### Building

```bash
# Build TypeScript
npm run build

# Development mode with watch
npm run dev

# Linting
npm run lint
npm run lint:fix
```

### Testing the MCP Server

```bash
# Test stdio transport
./scripts/test-stdio.sh

# Test with sample video
npm run test:sample
```

## API Documentation

### Response Format

All transcript responses follow this structure:

```typescript
interface TranscriptResponse {
  videoId: string;
  title?: string;
  language: string;
  transcript: TranscriptItem[];
  metadata?: {
    extractedAt: string;
    source: string;
    duration?: number;
    error?: string;
  };
}

interface TranscriptItem {
  text: string;
  start: number;
  duration: number;
}
```

### Error Handling

The server handles various error scenarios:

- **Video not found**: Returns empty transcript with error in metadata
- **Private videos**: Graceful error handling with descriptive messages
- **Rate limiting**: Built-in delays and retry logic
- **Network errors**: Automatic retries with exponential backoff

## Performance

### Benchmarks

- **Single video extraction**: < 5 seconds
- **Bulk processing**: < 2 seconds per video
- **Concurrent requests**: 90%+ success rate for 10 concurrent requests
- **Memory usage**: < 512MB under normal load
- **Cache hit ratio**: 70%+ for repeated requests

### Optimization

- **LRU Cache**: Configurable TTL and size limits
- **Rate Limiting**: Prevents API abuse
- **Concurrent Processing**: Optimized for bulk operations
- **Memory Management**: Efficient garbage collection

## Troubleshooting

### Common Issues

1. **Video not found**: Check if video is public and has captions
2. **Rate limiting**: Reduce concurrent requests or increase delays
3. **Memory issues**: Reduce cache size or clear cache regularly
4. **Network errors**: Check internet connection and firewall settings

### Debug Mode

Enable debug logging:

```bash
export LOG_LEVEL=debug
yt-transcript-dl-mcp start --verbose
```

### Logs

Check logs in the `logs/` directory:

```bash
tail -f logs/combined.log
tail -f logs/error.log
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Write tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

### Code Style

- Use TypeScript for all code
- Follow ESLint configuration
- Write comprehensive tests
- Add JSDoc comments for public APIs
- Use conventional commit messages

## License

MIT License - see LICENSE file for details.

## Support

- GitHub Issues: [Report bugs and feature requests](https://github.com/your-username/yt-transcript-dl-mcp/issues)
- Documentation: [Full API documentation](https://github.com/your-username/yt-transcript-dl-mcp/wiki)
- Examples: [Usage examples](https://github.com/your-username/yt-transcript-dl-mcp/tree/main/examples)

## Changelog

### v1.0.0
- Initial release
- MCP server with stdio, SSE, and HTTP transports
- Single video and bulk transcript extraction
- Docker containerization
- Comprehensive test suite
- TypeScript support
- Caching and rate limiting
- Multiple output formats (text, JSON, SRT)