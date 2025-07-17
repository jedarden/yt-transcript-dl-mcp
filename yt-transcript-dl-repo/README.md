# YouTube Transcript Extractor

A robust YouTube transcript extraction service with MCP (Model Context Protocol) server support. Extract transcripts from YouTube videos with support for multiple languages, output formats, bulk processing, and playlist extraction.

## Features

- 🎥 **Single Video Extraction**: Extract transcripts from individual YouTube videos
- 📋 **Playlist Support**: Extract transcripts from entire YouTube playlists
- 🚀 **Bulk Processing**: Process multiple videos concurrently with progress tracking
- 🌍 **Multi-language Support**: Specify preferred transcript language
- 📄 **Multiple Output Formats**: Export as text, JSON, SRT, or WebVTT
- 💾 **Smart Caching**: LRU cache with configurable TTL to reduce API calls
- 🔄 **Rate Limiting**: Built-in rate limiting to respect YouTube's limits
- 🛡️ **Error Handling**: Comprehensive error handling for private/deleted videos
- 🤖 **MCP Server**: Integrate with AI assistants via Model Context Protocol
- 🖥️ **CLI Tool**: Standalone command-line interface for direct usage

## Installation

```bash
npm install youtube-transcript-extractor
```

## Quick Start

### As a Library

```typescript
import { YouTubeExtractorService, FormatterService } from 'youtube-transcript-extractor';

// Create extractor instance
const extractor = new YouTubeExtractorService({
  cache: { ttl: 3600, maxSize: 100 },
  rateLimit: { maxRequests: 10, windowMs: 60000 }
});

// Extract transcript
const transcript = await extractor.extractTranscript('dQw4w9WgXcQ', {
  lang: 'en'
});

// Format as text
const formatter = new FormatterService();
const text = formatter.format(transcript, {
  format: 'text',
  includeTimestamps: true
});

console.log(text);
```

### As MCP Server

1. Add to your MCP client configuration:

```json
{
  "mcpServers": {
    "youtube-transcript": {
      "command": "npx",
      "args": ["youtube-transcript-extractor", "mcp"]
    }
  }
}
```

2. Available MCP tools:
- `extract_transcript`: Extract transcript from a single video
- `extract_playlist`: Extract transcripts from a playlist
- `bulk_extract`: Extract transcripts from multiple videos
- `get_cache_stats`: View cache statistics
- `clear_cache`: Clear cached transcripts
- `get_rate_limit_status`: Check rate limit status

### CLI Usage

```bash
# Extract single video
yt-transcript extract dQw4w9WgXcQ -f text -o transcript.txt

# Extract playlist
yt-transcript playlist PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf -f srt -o ./subtitles/

# Bulk extract from file
yt-transcript bulk video-ids.txt -f json -o ./transcripts/ -c 5

# View cache stats
yt-transcript cache --stats

# Clear cache
yt-transcript cache --clear
```

## API Reference

### YouTubeExtractorService

#### Constructor Options

```typescript
interface ExtractorConfig {
  cache?: {
    ttl?: number;        // Cache TTL in seconds (default: 3600)
    maxSize?: number;    // Max cached items (default: 100)
    namespace?: string;  // Cache namespace (default: 'transcripts')
  };
  rateLimit?: {
    maxRequests: number;   // Max requests per window (default: 10)
    windowMs: number;      // Time window in ms (default: 60000)
    delayAfterLimit?: number; // Delay when limited (default: 1000)
  };
  userAgent?: string;      // Custom user agent
  proxy?: string;          // Proxy URL
  timeout?: number;        // Request timeout in ms (default: 30000)
  retryAttempts?: number;  // Retry attempts (default: 3)
  retryDelay?: number;     // Retry delay in ms (default: 1000)
}
```

#### Methods

##### extractTranscript(videoId, options)
Extract transcript from a single video.

```typescript
const transcript = await extractor.extractTranscript('VIDEO_ID', {
  lang: 'en',              // Preferred language
  country: 'US',          // Country code
  preserveFormatting: true // Preserve text formatting
});
```

##### extractPlaylistInfo(playlistId)
Get playlist information and video list.

```typescript
const playlist = await extractor.extractPlaylistInfo('PLAYLIST_ID');
```

### BulkProcessorService

#### processBulk(options)
Process multiple videos with progress tracking.

```typescript
const results = await bulkProcessor.processBulk({
  videoIds: ['VIDEO_ID_1', 'VIDEO_ID_2'],
  options: { lang: 'en' },
  format: { format: 'srt' },
  concurrency: 3,
  onProgress: (progress) => {
    console.log(`${progress.completed}/${progress.total}`);
  }
});
```

#### processPlaylist(playlistId, options)
Process all videos in a playlist.

```typescript
const result = await bulkProcessor.processPlaylist(
  'PLAYLIST_ID',
  { lang: 'en' },
  { format: 'vtt' },
  3 // concurrency
);
```

### FormatterService

#### format(transcript, options)
Format transcript in various output formats.

```typescript
const formatted = formatter.format(transcript, {
  format: 'srt',           // 'text' | 'json' | 'srt' | 'vtt'
  includeTimestamps: true, // For text format
  includeMetadata: true,   // Include video metadata
  prettify: true          // Pretty print JSON
});
```

## Output Formats

### Text Format
```
[00:00] Hello, welcome to my video.
[00:05] Today we'll be discussing...
```

### SRT Format
```
1
00:00:00,000 --> 00:00:05,000
Hello, welcome to my video.

2
00:00:05,000 --> 00:00:10,000
Today we'll be discussing...
```

### WebVTT Format
```
WEBVTT

00:00:00.000 --> 00:00:05.000
Hello, welcome to my video.

00:00:05.000 --> 00:00:10.000
Today we'll be discussing...
```

### JSON Format
```json
{
  "videoId": "dQw4w9WgXcQ",
  "title": "Video Title",
  "language": "en",
  "segments": [
    {
      "text": "Hello, welcome to my video.",
      "start": 0,
      "duration": 5
    }
  ]
}
```

## Error Handling

The service provides detailed error information:

```typescript
try {
  const transcript = await extractor.extractTranscript('VIDEO_ID');
} catch (error) {
  if (error instanceof TranscriptError) {
    switch (error.code) {
      case ErrorCode.VIDEO_NOT_FOUND:
        console.log('Video not found');
        break;
      case ErrorCode.TRANSCRIPT_NOT_AVAILABLE:
        console.log('No transcript available');
        break;
      case ErrorCode.PRIVATE_VIDEO:
        console.log('Video is private');
        break;
      // ... handle other errors
    }
  }
}
```

## Environment Variables

Configure the service using environment variables:

```bash
# Cache settings
CACHE_TTL=3600
CACHE_MAX_SIZE=100
CACHE_NAMESPACE=transcripts

# Rate limiting
RATE_LIMIT_MAX_REQUESTS=10
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_DELAY=1000

# Request settings
USER_AGENT="Custom User Agent"
PROXY_URL=http://proxy.example.com:8080
REQUEST_TIMEOUT=30000
RETRY_ATTEMPTS=3
RETRY_DELAY=1000

# Logging
LOG_LEVEL=info
```

## Advanced Usage

### Custom Progress Tracking

```typescript
const results = await bulkProcessor.processBulk({
  videoIds: ['VIDEO1', 'VIDEO2', 'VIDEO3'],
  onProgress: (progress) => {
    console.log(`Progress: ${progress.completed}/${progress.total}`);
    console.log(`Failed: ${progress.failed}`);
    console.log(`Current: ${progress.currentVideo}`);
    
    if (progress.errors.length > 0) {
      console.log('Errors:', progress.errors);
    }
  }
});
```

### Export Results

```typescript
// Export to different formats
const jsonExport = bulkProcessor.exportResults(results, 'json');
const csvExport = bulkProcessor.exportResults(results, 'csv');
const textExport = bulkProcessor.exportResults(results, 'txt');

// Generate summary report
const report = bulkProcessor.generateReport(results);
console.log(`Success rate: ${report.successRate}%`);
console.log(`Languages found:`, report.languages);
```

### Segment Processing

```typescript
// Merge adjacent segments
const merged = formatter.mergeSegments(transcript.segments, 0.5);

// Split long segments
const split = formatter.splitLongSegments(transcript.segments, 100);
```

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Run in development mode
npm run dev

# Lint code
npm run lint

# Format code
npm run format
```

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.