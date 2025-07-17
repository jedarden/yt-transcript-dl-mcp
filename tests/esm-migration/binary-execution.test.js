/**
 * TDD Tests for ESM Migration - Binary Execution
 *
 * These tests MUST pass after ESM migration to ensure the binary works correctly.
 * Focus: ERR_REQUIRE_ESM error when running the binary
 */
import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs';
const execAsync = promisify(exec);
describe('ESM Migration - Binary Execution', () => {
  const binaryPath = path.join(__dirname, '../../dist/bin/server.js');
  const packageJsonPath = path.join(__dirname, '../../package.json');
  beforeAll(async () => {
    // Ensure the project is built
    if (!fs.existsSync(binaryPath)) {
      await execAsync('npm run build', { cwd: path.join(__dirname, '../..') });
    }
  });
  describe('Package.json Configuration', () => {
    it('should have type: "module" for ESM support', () => {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      expect(packageJson.type).toBe('module');
    });
    it('should have correct binary path and executable', () => {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      expect(packageJson.bin).toBeDefined();
      expect(packageJson.bin['yt-transcript-dl-mcp']).toBe('dist/bin/server.js');
    });
    it('should have Node.js version >= 18 for ESM support', () => {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      expect(packageJson.engines?.node).toMatch(/>=\s*18/);
    });
  });
  describe('Binary File Structure', () => {
    it('should have shebang line for node execution', () => {
      const binaryContent = fs.readFileSync(binaryPath, 'utf8');
      expect(binaryContent).toMatch(/^#!/);
      expect(binaryContent).toMatch(/node/);
    });
    it('should use ESM import statements (not require)', () => {
      const binaryContent = fs.readFileSync(binaryPath, 'utf8');
      // Should NOT contain CommonJS require statements
      expect(binaryContent).not.toMatch(/\brequire\s*\(/);
      // Should contain ESM import statements
      expect(binaryContent).toMatch(/\bimport\s+/);
    });
    it('should have .js extension with ESM imports', () => {
      expect(binaryPath).toMatch(/\.js$/);
      const binaryContent = fs.readFileSync(binaryPath, 'utf8');
      expect(binaryContent).toMatch(/from\s+['"][^'"]*\.js['"];/);
    });
  });
  describe('Binary Execution - ERR_REQUIRE_ESM Prevention', () => {
    it('should execute binary without ERR_REQUIRE_ESM error', async () => {
      return new Promise((resolve, reject) => {
        const child = spawn('node', [binaryPath, '--help'], {
          stdio: ['pipe', 'pipe', 'pipe'],
          cwd: path.join(__dirname, '../..')
        });
        let stdout = '';
        let stderr = '';
        child.stdout.on('data', (data) => {
          stdout += data.toString();
        });
        child.stderr.on('data', (data) => {
          stderr += data.toString();
        });
        child.on('close', (code) => {
          // Should NOT contain the ERR_REQUIRE_ESM error
          expect(stderr).not.toMatch(/ERR_REQUIRE_ESM/);
          expect(stderr).not.toMatch(/require\(\) of ES modules is not supported/);
          // Should show help output
          expect(stdout).toMatch(/YouTube Transcript Download MCP Server/);
          resolve();
        });
        child.on('error', (error) => {
          reject(error);
        });
        // Timeout after 10 seconds
        setTimeout(() => {
          child.kill();
          reject(new Error('Binary execution timeout'));
        }, 10000);
      });
    }, 15000);
    it('should start server with stdio transport', async () => {
      return new Promise((resolve, reject) => {
        const child = spawn('node', [binaryPath, 'start', '--transport', 'stdio'], {
          stdio: ['pipe', 'pipe', 'pipe'],
          cwd: path.join(__dirname, '../..')
        });
        let stderr = '';
        let started = false;
        child.stderr.on('data', (data) => {
          stderr += data.toString();
          // Check for successful startup
          if (stderr.includes('Starting server') && !started) {
            started = true;
            child.kill();
            // Verify no ERR_REQUIRE_ESM error
            expect(stderr).not.toMatch(/ERR_REQUIRE_ESM/);
            expect(stderr).not.toMatch(/require\(\) of ES modules is not supported/);
            resolve();
          }
        });
        child.on('error', (error) => {
          reject(error);
        });
        // Timeout after 10 seconds
        setTimeout(() => {
          if (!started) {
            child.kill();
            reject(new Error(`Server startup timeout. stderr: ${stderr}`));
          }
        }, 10000);
      });
    }, 15000);
    it('should handle test command without import errors', async () => {
      return new Promise((resolve, reject) => {
        const child = spawn('node', [binaryPath, 'test', 'dQw4w9WgXcQ'], {
          stdio: ['pipe', 'pipe', 'pipe'],
          cwd: path.join(__dirname, '../..')
        });
        let stderr = '';
        child.stderr.on('data', (data) => {
          stderr += data.toString();
        });
        child.on('close', (code) => {
          // Should NOT contain ESM-related errors
          expect(stderr).not.toMatch(/ERR_REQUIRE_ESM/);
          expect(stderr).not.toMatch(/require\(\) of ES modules is not supported/);
          expect(stderr).not.toMatch(/Cannot use import statement outside a module/);
          resolve();
        });
        child.on('error', (error) => {
          reject(error);
        });
        // Timeout after 15 seconds (may need time for API call)
        setTimeout(() => {
          child.kill();
          resolve(); // Don't fail on timeout for network-dependent test
        }, 15000);
      });
    }, 20000);
  });
  describe('Command Line Interface', () => {
    it('should parse commands correctly', async () => {
      const { stdout, stderr } = await execAsync(`node ${binaryPath} --help`);
      expect(stderr).not.toMatch(/ERR_REQUIRE_ESM/);
      expect(stdout).toMatch(/start.*Start the MCP server/);
      expect(stdout).toMatch(/test.*Test the server/);
    });
    it('should handle invalid commands gracefully', async () => {
      try {
        await execAsync(`node ${binaryPath} invalid-command`);
      }
      catch (error) {
        expect(error.stderr).not.toMatch(/ERR_REQUIRE_ESM/);
        expect(error.stderr).toMatch(/unknown command/i);
      }
    });
  });
  describe('Environment Variables', () => {
    it('should handle MCP_TRANSPORT environment variable', async () => {
      return new Promise((resolve, reject) => {
        const child = spawn('node', [binaryPath, 'start'], {
          stdio: ['pipe', 'pipe', 'pipe'],
          env: { ...process.env, MCP_TRANSPORT: 'stdio' },
          cwd: path.join(__dirname, '../..')
        });
        let stderr = '';
        child.stderr.on('data', (data) => {
          stderr += data.toString();
          if (stderr.includes('Starting server')) {
            child.kill();
            expect(stderr).not.toMatch(/ERR_REQUIRE_ESM/);
            resolve();
          }
        });
        child.on('error', (error) => {
          reject(error);
        });
        setTimeout(() => {
          child.kill();
          resolve();
        }, 5000);
      });
    }, 10000);
  });
});
//# sourceMappingURL=binary-execution.test.js.map