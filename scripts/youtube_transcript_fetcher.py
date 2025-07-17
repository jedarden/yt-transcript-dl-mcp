#!/usr/bin/env python3
"""
YouTube Transcript Fetcher Script
Uses the Python youtube-transcript-api to fetch transcripts for the Node.js MCP server
"""

import json
import sys
import argparse
from youtube_transcript_api import YouTubeTranscriptApi, TranscriptsDisabled, VideoUnavailable, NoTranscriptFound

def fetch_transcript(video_id, language='en'):
    """Fetch transcript for a single video"""
    try:
        # Try to get transcript in the specified language
        transcript = YouTubeTranscriptApi.get_transcript(video_id, languages=[language])
        
        return {
            'success': True,
            'videoId': video_id,
            'language': language,
            'transcript': transcript,
            'metadata': {
                'extractedAt': None,  # Will be set by Node.js
                'source': 'youtube-transcript-api',
                'itemCount': len(transcript),
                'duration': sum(item['duration'] for item in transcript)
            }
        }
        
    except TranscriptsDisabled:
        return {
            'success': False,
            'videoId': video_id,
            'language': language,
            'error': 'Transcripts are disabled for this video',
            'transcript': []
        }
    except VideoUnavailable:
        return {
            'success': False,
            'videoId': video_id,
            'language': language,
            'error': 'Video is unavailable',
            'transcript': []
        }
    except NoTranscriptFound:
        return {
            'success': False,
            'videoId': video_id,
            'language': language,
            'error': f'No transcript found for language: {language}',
            'transcript': []
        }
    except Exception as e:
        return {
            'success': False,
            'videoId': video_id,
            'language': language,
            'error': str(e),
            'transcript': []
        }

def list_transcripts(video_id):
    """List available transcripts for a video"""
    try:
        transcript_list = YouTubeTranscriptApi.list_transcripts(video_id)
        
        transcripts = []
        for transcript in transcript_list:
            transcripts.append({
                'language': transcript.language,
                'language_code': transcript.language_code,
                'is_generated': transcript.is_generated,
                'is_translatable': transcript.is_translatable
            })
        
        return {
            'success': True,
            'videoId': video_id,
            'transcripts': transcripts
        }
        
    except Exception as e:
        return {
            'success': False,
            'videoId': video_id,
            'error': str(e),
            'transcripts': []
        }

def fetch_bulk_transcripts(video_ids, language='en'):
    """Fetch transcripts for multiple videos"""
    results = []
    errors = []
    
    for video_id in video_ids:
        result = fetch_transcript(video_id, language)
        if result['success']:
            results.append(result)
        else:
            errors.append({
                'videoId': video_id,
                'error': result['error']
            })
    
    return {
        'success': True,
        'results': results,
        'errors': errors,
        'summary': {
            'total': len(video_ids),
            'successful': len(results),
            'failed': len(errors)
        }
    }

def main():
    parser = argparse.ArgumentParser(description='YouTube Transcript Fetcher')
    parser.add_argument('action', choices=['fetch', 'list', 'bulk'], help='Action to perform')
    parser.add_argument('--video-id', required=False, help='YouTube video ID')
    parser.add_argument('--video-ids', required=False, help='Comma-separated list of video IDs for bulk fetch')
    parser.add_argument('--language', default='en', help='Language code (default: en)')
    parser.add_argument('--output', default='json', choices=['json'], help='Output format')
    
    args = parser.parse_args()
    
    try:
        if args.action == 'fetch':
            if not args.video_id:
                print(json.dumps({'success': False, 'error': 'video-id required for fetch action'}))
                sys.exit(1)
            result = fetch_transcript(args.video_id, args.language)
            
        elif args.action == 'list':
            if not args.video_id:
                print(json.dumps({'success': False, 'error': 'video-id required for list action'}))
                sys.exit(1)
            result = list_transcripts(args.video_id)
            
        elif args.action == 'bulk':
            if not args.video_ids:
                print(json.dumps({'success': False, 'error': 'video-ids required for bulk action'}))
                sys.exit(1)
            video_ids = [vid.strip() for vid in args.video_ids.split(',')]
            result = fetch_bulk_transcripts(video_ids, args.language)
        
        print(json.dumps(result, ensure_ascii=False))
        
    except Exception as e:
        print(json.dumps({'success': False, 'error': str(e)}))
        sys.exit(1)

if __name__ == '__main__':
    main()