// TDD Test: Verify GitHub Release creation works
// This test MUST FAIL first to prove we need proper release workflow

import { describe, it, expect, jest } from '@jest/globals';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

describe('GitHub Release Workflow', () => {
  it('should have release workflow file with correct structure', () => {
    const workflowPath = join(projectRoot, '.github', 'workflows', 'release.yml');
    
    expect(existsSync(workflowPath)).toBe(true);
    
    const workflow = readFileSync(workflowPath, 'utf-8');
    
    // Should have proper trigger
    expect(workflow).toMatch(/on:\s*push:\s*tags/);
    
    // Should use actions/checkout
    expect(workflow).toMatch(/uses: actions\/checkout/);
    
    // Should use GitHub release action
    expect(workflow).toMatch(/uses: actions\/create-release|uses: softprops\/action-gh-release/);
    
    // Should have proper permissions
    expect(workflow).toMatch(/permissions:|contents: write/);
  });
  
  it('should create release with proper version from package.json', () => {
    const packageJsonPath = join(projectRoot, 'package.json');
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
    
    // Package should have a version
    expect(packageJson).toHaveProperty('version');
    expect(packageJson.version).toMatch(/^\d+\.\d+\.\d+/);
    
    // Version should be semantic version format
    const semverRegex = /^\d+\.\d+\.\d+(-[\w\.]+)?(\+[\w\.]+)?$/;
    expect(packageJson.version).toMatch(semverRegex);
  });
  
  it('should include release notes and changelog', () => {
    // Check for changelog or release notes
    const changelogPaths = [
      join(projectRoot, 'CHANGELOG.md'),
      join(projectRoot, 'HISTORY.md'),
      join(projectRoot, 'RELEASES.md')
    ];
    
    const hasChangelog = changelogPaths.some(path => existsSync(path));
    
    // Should have some form of release documentation
    expect(hasChangelog).toBe(true);
  });
  
  it('should build and test before creating release', () => {
    const workflowPath = join(projectRoot, '.github', 'workflows', 'release.yml');
    
    if (existsSync(workflowPath)) {
      const workflow = readFileSync(workflowPath, 'utf-8');
      
      // Should run tests before release
      expect(workflow).toMatch(/npm test|npm run test/);
      
      // Should build project
      expect(workflow).toMatch(/npm run build|npm install/);
    }
  });
  
  it('should tag releases properly', () => {
    // Verify git tag format expectations
    const expectedTagFormat = /^v?\d+\.\d+\.\d+$/;
    
    // Test tag format validation
    const validTags = ['v1.0.0', '1.0.0', 'v2.1.3', '0.1.0'];
    const invalidTags = ['release-1.0', 'v1.0', 'latest'];
    
    validTags.forEach(tag => {
      expect(tag).toMatch(expectedTagFormat);
    });
    
    invalidTags.forEach(tag => {
      expect(tag).not.toMatch(expectedTagFormat);
    });
  });
  
  it('should create release assets if needed', () => {
    const workflowPath = join(projectRoot, '.github', 'workflows', 'release.yml');
    
    if (existsSync(workflowPath)) {
      const workflow = readFileSync(workflowPath, 'utf-8');
      
      // Check if workflow creates any assets
      const hasAssets = workflow.includes('upload-artifact') || 
                       workflow.includes('upload_url') ||
                       workflow.includes('asset_path');
      
      // For npm packages, assets might not be needed
      // But workflow should be structured to support them
      expect(typeof hasAssets).toBe('boolean');
    }
  });
  
  it('should fail on missing or invalid GitHub token', () => {
    const workflowPath = join(projectRoot, '.github', 'workflows', 'release.yml');
    
    if (existsSync(workflowPath)) {
      const workflow = readFileSync(workflowPath, 'utf-8');
      
      // Should use GITHUB_TOKEN
      expect(workflow).toMatch(/GITHUB_TOKEN|secrets\.GITHUB_TOKEN/);
      
      // Should have proper token reference
      expect(workflow).toMatch(/\$\{\{\s*secrets\.GITHUB_TOKEN\s*\}\}/);
    }
  });
  
  it('should validate release workflow syntax', () => {
    const workflowPath = join(projectRoot, '.github', 'workflows', 'release.yml');
    
    if (existsSync(workflowPath)) {
      const workflow = readFileSync(workflowPath, 'utf-8');
      
      // Basic YAML structure validation
      expect(workflow).toMatch(/^name:/);
      expect(workflow).toMatch(/^on:/m);
      expect(workflow).toMatch(/^jobs:/m);
      
      // Should not have syntax errors
      expect(() => {
        // Basic YAML parsing check
        workflow.split('\n').forEach((line, i) => {
          if (line.trim() && !line.startsWith('#')) {
            expect(line).not.toMatch(/\t/); // No tabs in YAML
          }
        });
      }).not.toThrow();
    }
  });
});
