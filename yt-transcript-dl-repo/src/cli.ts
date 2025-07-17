#!/usr/bin/env node

import { Command } from 'commander';
import { 
  YouTubeExtractorService, 
  BulkProcessorService,
  FormatterService,
  ExtractorConfig,
  FormatOptions
} from './services/index.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const program = new Command();

// Create service instances
const config: ExtractorConfig = {
  cache: {
    ttl: 3600,
    maxSize: 100
  },
  rateLimit: {
    maxRequests: 10,
    windowMs: 60000
  }
};

const extractor = new YouTubeExtractorService(config);
const bulkProcessor = new BulkProcessorService(extractor);
const formatter = new FormatterService();

program
  .name('yt-transcript')
  .description('YouTube Transcript Extractor CLI')
  .version('1.0.0');

// Extract single video
program
  .command('extract <videoId>')
  .description('Extract transcript from a YouTube video')
  .option('-l, --lang <language>', 'Preferred language code (e.g., "en", "es")')
  .option('-f, --format <format>', 'Output format (text, json, srt, vtt)', 'text')
  .option('-o, --output <file>', 'Output file path')
  .option('--timestamps', 'Include timestamps in text format')
  .option('--metadata', 'Include video metadata')
  .action(async (videoId, options) => {
    try {
      console.log(`Extracting transcript for video: ${videoId}`);
      
      const transcript = await extractor.extractTranscript(videoId, {
        lang: options.lang
      });

      const formatOptions: FormatOptions = {
        format: options.format,
        includeTimestamps: options.timestamps,
        includeMetadata: options.metadata,
        prettify: true
      };

      const formatted = formatter.format(transcript, formatOptions);

      if (options.output) {
        writeFileSync(options.output, formatted);
        console.log(`Transcript saved to: ${options.output}`);
      } else {
        console.log(formatted);
      }
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Extract playlist
program
  .command('playlist <playlistId>')
  .description('Extract transcripts from all videos in a playlist')
  .option('-l, --lang <language>', 'Preferred language code')
  .option('-f, --format <format>', 'Output format (text, json, srt, vtt)', 'text')
  .option('-o, --output <directory>', 'Output directory')
  .option('-c, --concurrency <number>', 'Number of concurrent requests', '3')
  .action(async (playlistId, options) => {
    try {
      console.log(`Extracting transcripts from playlist: ${playlistId}`);
      
      const formatOptions: FormatOptions = {
        format: options.format,
        includeTimestamps: false,
        includeMetadata: true,
        prettify: true
      };

      const result = await bulkProcessor.processPlaylist(
        playlistId,
        { lang: options.lang },
        formatOptions,
        parseInt(options.concurrency),
        (progress) => {
          console.log(`Progress: ${progress.completed}/${progress.total} (${progress.failed} failed)`);
        }
      );

      const report = bulkProcessor.generateReport(result.results);
      console.log(`\nCompleted: ${report.successful}/${report.total} videos`);
      console.log(`Success rate: ${report.successRate.toFixed(1)}%`);

      if (options.output) {
        // Create output directory if it doesn't exist
        if (!existsSync(options.output)) {
          require('fs').mkdirSync(options.output, { recursive: true });
        }

        // Save each transcript
        for (const res of result.results) {
          if (res.success && res.formatted) {
            const filename = `${res.videoId}.${options.format === 'json' ? 'json' : 'txt'}`;
            const filepath = resolve(options.output, filename);
            writeFileSync(filepath, res.formatted);
          }
        }

        console.log(`Transcripts saved to: ${options.output}`);
      }
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Bulk extract
program
  .command('bulk <file>')
  .description('Extract transcripts from a list of video IDs (one per line)')
  .option('-l, --lang <language>', 'Preferred language code')
  .option('-f, --format <format>', 'Output format (text, json, srt, vtt)', 'text')
  .option('-o, --output <directory>', 'Output directory')
  .option('-c, --concurrency <number>', 'Number of concurrent requests', '3')
  .action(async (file, options) => {
    try {
      // Read video IDs from file
      const content = readFileSync(file, 'utf-8');
      const videoIds = content.split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#'));

      console.log(`Extracting transcripts for ${videoIds.length} videos`);

      const formatOptions: FormatOptions = {
        format: options.format,
        includeTimestamps: false,
        includeMetadata: true,
        prettify: true
      };

      const results = await bulkProcessor.processBulk({
        videoIds,
        options: { lang: options.lang },
        format: formatOptions,
        concurrency: parseInt(options.concurrency),
        onProgress: (progress) => {
          console.log(`Progress: ${progress.completed}/${progress.total} (${progress.failed} failed)`);
        }
      });

      const report = bulkProcessor.generateReport(results);
      console.log(`\nCompleted: ${report.successful}/${report.total} videos`);
      console.log(`Success rate: ${report.successRate.toFixed(1)}%`);

      if (report.errors.length > 0) {
        console.log('\nErrors:');
        report.errors.forEach(err => {
          console.log(`  ${err.videoId}: ${err.error}`);
        });
      }

      if (options.output) {
        // Create output directory if it doesn't exist
        if (!existsSync(options.output)) {
          require('fs').mkdirSync(options.output, { recursive: true });
        }

        // Save each transcript
        for (const res of results) {
          if (res.success && res.formatted) {
            const filename = `${res.videoId}.${options.format === 'json' ? 'json' : 'txt'}`;
            const filepath = resolve(options.output, filename);
            writeFileSync(filepath, res.formatted);
          }
        }

        // Save report
        const reportPath = resolve(options.output, 'report.json');
        writeFileSync(reportPath, JSON.stringify(report, null, 2));

        console.log(`\nTranscripts saved to: ${options.output}`);
        console.log(`Report saved to: ${reportPath}`);
      }
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Cache management
program
  .command('cache')
  .description('Manage transcript cache')
  .option('--stats', 'Show cache statistics')
  .option('--clear', 'Clear all cached transcripts')
  .action(async (options) => {
    if (options.stats) {
      const stats = extractor.getCacheStats();
      console.log('Cache Statistics:');
      console.log(JSON.stringify(stats, null, 2));
    } else if (options.clear) {
      extractor.clearCache();
      console.log('Cache cleared successfully');
    } else {
      console.log('Please specify --stats or --clear');
    }
  });

// Rate limit status
program
  .command('status')
  .description('Show rate limit status')
  .action(async () => {
    const status = extractor.getRateLimitStatus();
    console.log('Rate Limit Status:');
    console.log(JSON.stringify(status, null, 2));
  });

program.parse();