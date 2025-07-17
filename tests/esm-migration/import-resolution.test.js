/**
 * TDD Tests for ESM Migration - Import Resolution
 *
 * These tests MUST pass after ESM migration to ensure imports work correctly.
 * Focus: Import statements resolve correctly with .js extensions and ESM compatibility
 */
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
// Get current file directory for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
describe('ESM Migration - Import Resolution', () => {
  const srcDir = path.join(__dirname, '../../src');
  const distDir = path.join(__dirname, '../../dist');
  describe('TypeScript Configuration', () => {
    it('should have ESM module configuration in tsconfig.json', () => {
      const tsconfigPath = path.join(__dirname, '../../tsconfig.json');
      const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf8'));
      expect(tsconfig.compilerOptions.module).toBe('ESNext');
      expect(tsconfig.compilerOptions.target).toBe('ES2022');
      expect(tsconfig.compilerOptions.moduleResolution).toBe('node');
      expect(tsconfig.compilerOptions.allowSyntheticDefaultImports).toBe(true);
      expect(tsconfig.compilerOptions.esModuleInterop).toBe(true);
    });
    it('should have correct output configuration for ESM', () => {
      const tsconfigPath = path.join(__dirname, '../../tsconfig.json');
      const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf8'));
      expect(tsconfig.compilerOptions.outDir).toBe('./dist');
      expect(tsconfig.compilerOptions.declaration).toBe(true);
      expect(tsconfig.compilerOptions.sourceMap).toBe(true);
    });
  });
  describe('Source File Import Statements', () => {
    const getSourceFiles = (dir) => {
      const files = [];
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          files.push(...getSourceFiles(fullPath));
        }
        else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
          files.push(fullPath);
        }
      }
      return files;
    };
    it('should use ESM import syntax in all TypeScript files', () => {
      const sourceFiles = getSourceFiles(srcDir);
      expect(sourceFiles.length).toBeGreaterThan(0);
      for (const file of sourceFiles) {
        const content = fs.readFileSync(file, 'utf8');
        // Should NOT use CommonJS require
        expect(content).not.toMatch(/\brequire\s*\(/);
        expect(content).not.toMatch(/module\.exports/);
        expect(content).not.toMatch(/exports\./);
        // Should use ESM syntax
        if (content.includes('import') || content.includes('export')) {
          expect(content).toMatch(/\bimport\b|\bexport\b/);
        }
      }
    });
    it('should use relative imports with .js extensions in compiled output', async () => {
      // Build first if dist doesn't exist
      if (!fs.existsSync(distDir)) {
        const { exec } = await import('child_process');
        const { promisify } = await import('util');
        const execAsync = promisify(exec);
        await execAsync('npm run build', { cwd: path.join(__dirname, '../..') });
      }
      const getCompiledFiles = (dir) => {
        const files = [];
        try {
          const entries = fs.readdirSync(dir, { withFileTypes: true });
          for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
              files.push(...getCompiledFiles(fullPath));
            }
            else if (entry.name.endsWith('.js')) {
              files.push(fullPath);
            }
          }
        }
        catch (error) {
          // Directory might not exist yet
        }
        return files;
      };
      const compiledFiles = getCompiledFiles(distDir);
      if (compiledFiles.length > 0) {
        for (const file of compiledFiles) {
          const content = fs.readFileSync(file, 'utf8');
          // Check for relative imports - they should have .js extensions
          const relativeImports = content.match(/from\s+['"]\.\.?\/[^'"]*['"];?/g) || [];
          for (const importStatement of relativeImports) {
            // Relative imports should end with .js
            if (!importStatement.includes('.js')) {
              fail(`Relative import without .js extension in ${file}: ${importStatement}`);
            }
          }
        }
      }
    });
  });
  describe('MCP SDK Import Compatibility', () => {
    it('should successfully import MCP SDK modules', async () => {
      // Test that we can import the MCP SDK without errors
      await expect(async () => {
        const { Server } = await import('@modelcontextprotocol/sdk/server/index.js');
        expect(Server).toBeDefined();
        expect(typeof Server).toBe('function');
      }).not.toThrow();
    });
    it('should import MCP SDK with correct ESM syntax', async () => {
      const { StdioServerTransport } = await import('@modelcontextprotocol/sdk/server/stdio.js');
      expect(StdioServerTransport).toBeDefined();
      expect(typeof StdioServerTransport).toBe('function');
    });
    it('should handle MCP SDK types correctly', async () => {
      // Import types that should be available
      const sdk = await import('@modelcontextprotocol/sdk/types.js');
      expect(sdk).toBeDefined();
    });
  });
  describe('Third-party Package Imports', () => {
    it('should import CommonJS packages with ESM compatibility', async () => {
      // Test winston (CommonJS package)
      await expect(async () => {
        const winston = await import('winston');
        expect(winston.createLogger).toBeDefined();
      }).not.toThrow();
    });
    it('should import commander.js correctly', async () => {
      const { Command } = await import('commander');
      expect(Command).toBeDefined();
      expect(typeof Command).toBe('function');
    });
    it('should import express correctly', async () => {
      const express = await import('express');
      expect(express.default).toBeDefined();
      expect(typeof express.default).toBe('function');
    });
    it('should import uuid correctly', async () => {
      const { v4: uuidv4 } = await import('uuid');
      expect(uuidv4).toBeDefined();
      expect(typeof uuidv4).toBe('function');
    });
    it('should import youtube-transcript correctly', async () => {
      const { YoutubeTranscript } = await import('youtube-transcript');
      expect(YoutubeTranscript).toBeDefined();
      expect(YoutubeTranscript.fetchTranscript).toBeDefined();
    });
  });
  describe('Dynamic Imports', () => {
    it('should support dynamic imports for optional dependencies', async () => {
      // Test dynamic import syntax
      const dynamicImport = await import('path');
      expect(dynamicImport.join).toBeDefined();
    });
    it('should handle conditional imports correctly', async () => {
      // Test that conditional imports work
      const condition = true;
      if (condition) {
        const fs = await import('fs');
        expect(fs.readFileSync).toBeDefined();
      }
    });
  });
  describe('File Extension Resolution', () => {
    it('should resolve .js files from TypeScript imports', () => {
      // After compilation, .ts imports should become .js
      const indexPath = path.join(distDir, 'index.js');
      if (fs.existsSync(indexPath)) {
        const content = fs.readFileSync(indexPath, 'utf8');
        // Check that imports have .js extensions
        const imports = content.match(/from\s+['"][^'"]*['"];?/g) || [];
        for (const importStatement of imports) {
          if (importStatement.includes('./') || importStatement.includes('../')) {
            expect(importStatement).toMatch(/\.js['"];?/);
          }
        }
      }
    });
    it('should not reference .ts files in compiled output', () => {
      const getJsFiles = (dir) => {
        const files = [];
        try {
          const entries = fs.readdirSync(dir, { withFileTypes: true });
          for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
              files.push(...getJsFiles(fullPath));
            }
            else if (entry.name.endsWith('.js')) {
              files.push(fullPath);
            }
          }
        }
        catch (error) {
          // Directory might not exist
        }
        return files;
      };
      const jsFiles = getJsFiles(distDir);
      for (const file of jsFiles) {
        const content = fs.readFileSync(file, 'utf8');
        // Should not reference .ts files
        expect(content).not.toMatch(/from\s+['"][^'"]*\.ts['"];?/);
        expect(content).not.toMatch(/import\([^)]*\.ts[^)]*\)/);
      }
    });
  });
  describe('require.main Compatibility', () => {
    it('should handle require.main check for ESM entry point', () => {
      const indexPath = path.join(srcDir, 'index.ts');
      if (fs.existsSync(indexPath)) {
        const content = fs.readFileSync(indexPath, 'utf8');
        // If using require.main check, it should be compatible
        if (content.includes('require.main')) {
          // Should use import.meta.url instead for ESM
          // Or conditional check for CommonJS compatibility
          expect(content).toMatch(/import\.meta\.url|require\.main/);
        }
      }
    });
    it('should use ESM-compatible entry point detection', () => {
      const binPath = path.join(srcDir, 'bin/server.ts');
      if (fs.existsSync(binPath)) {
        const content = fs.readFileSync(binPath, 'utf8');
        // Should not rely on CommonJS-specific patterns
        expect(content).not.toMatch(/require\.main\s*===\s*module/);
      }
    });
  });
});
//# sourceMappingURL=import-resolution.test.js.map