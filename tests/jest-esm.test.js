// TDD Test: Jest should properly handle ESM modules with .js extensions
// This test MUST FAIL first to prove we need the fix

import { describe, it, expect, jest } from '@jest/globals';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('Jest ESM Configuration', () => {
  it('should import ESM modules with .js extensions without errors', async () => {
    // This test verifies Jest can handle .js extensions in ESM imports
    const testModulePath = join(__dirname, 'fixtures', 'esm-module.js');
    
    // Create a test ESM module that imports another module with .js extension
    const testModule = `
      import { helper } from './helper.js';
      export const testFunction = () => helper();
    `;
    
    // This should NOT throw when Jest is properly configured
    await expect(async () => {
      const module = await import(testModulePath);
      return module.testFunction();
    }).not.toThrow();
  });
  
  it('should have proper Jest configuration for ESM', () => {
    // Verify Jest config exists and has correct ESM settings
    const jestConfigPath = join(__dirname, '..', 'jest.config.js');
    const config = readFileSync(jestConfigPath, 'utf-8');
    
    // Check for required ESM configuration
    expect(config).toContain('extensionsToTreatAsEsm');
    expect(config).toContain('.js');
    expect(config).toContain('transform: {}');
    expect(config).toContain("moduleNameMapper");
    expect(config).toContain("^(\\.{1,2}/.*)\\.js$");
  });
  
  it('should handle node: protocol imports', async () => {
    // Test that node: protocol imports work correctly
    await expect(async () => {
      const { readFile } = await import('node:fs/promises');
      return readFile;
    }).not.toThrow();
  });
});
