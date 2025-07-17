// TDD Test: Verify youtube-captions-scraper is not needed
// This test MUST FAIL first to prove we need to remove the dependency

import { describe, it, expect } from '@jest/globals';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

describe('Dependency Management', () => {
  it('should NOT include youtube-captions-scraper in package.json', () => {
    // This test verifies we don't have unused dependencies
    const packageJsonPath = join(projectRoot, 'package.json');
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
    
    const allDeps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
      ...packageJson.peerDependencies
    };
    
    // youtube-captions-scraper should NOT be in any dependency list
    expect(allDeps).not.toHaveProperty('youtube-captions-scraper');
    expect(Object.keys(allDeps)).not.toContain('youtube-captions-scraper');
  });
  
  it('should only include dependencies that are actually used', () => {
    // Read all source files and check imports
    const packageJsonPath = join(projectRoot, 'package.json');
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
    
    // These are the expected dependencies based on actual usage
    const expectedDeps = [
      '@modelcontextprotocol/sdk',
      '@types/node',
      'commander',
      'cors',
      'express',
      'express-rate-limit',
      'helmet',
      'node-cache',
      'uuid',
      'winston',
      'zod'
    ];
    
    // Check that we only have dependencies we actually use
    if (packageJson.dependencies) {
      Object.keys(packageJson.dependencies).forEach(dep => {
        expect(expectedDeps).toContain(dep);
      });
    }
  });
  
  it('should have all required dependencies for MCP server', () => {
    const packageJsonPath = join(projectRoot, 'package.json');
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
    
    // Verify we have the MCP SDK dependency
    expect(packageJson.dependencies).toHaveProperty('@modelcontextprotocol/sdk');
    
    // Verify we have necessary dependencies (no longer need youtube-transcript as we use Python API)
    expect(packageJson.dependencies).toHaveProperty('@modelcontextprotocol/sdk');
  });
  
  it('should not have conflicting or duplicate functionality packages', () => {
    const packageJsonPath = join(projectRoot, 'package.json');
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
    
    const allDeps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies
    };
    
    // Should not have both youtube-transcript and youtube-captions-scraper
    const transcriptPackages = Object.keys(allDeps).filter(dep => 
      dep.includes('youtube') && (dep.includes('transcript') || dep.includes('caption'))
    );
    
    // We should have no Node.js transcript packages since we use Python API
    expect(transcriptPackages).toEqual([]);
  });
});
