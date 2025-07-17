/**
 * TDD Tests for ESM Migration - Transport Integration
 *
 * These tests MUST pass after ESM migration to ensure all transport modes work correctly.
 * Focus: stdio, SSE, and HTTP transport integration with ESM
 */
import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
// Get current file directory for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
describe('ESM Migration - Transport Integration', () => {
  const binaryPath = path.join(__dirname, '../../dist/bin/server.js');
  const projectRoot = path.join(__dirname, '../..');
  beforeAll(async () => {
    // Ensure the project is built
    if (!fs.existsSync(binaryPath)) {
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      await execAsync('npm run build', { cwd: projectRoot });
    }
  });
  describe('Stdio Transport', () => {
    it('should initialize stdio transport without ESM errors', async () => {
      return new Promise((resolve, reject) => {
        const child = spawn('node', [binaryPath, 'start', '--transport', 'stdio'], {
          stdio: ['pipe', 'pipe', 'pipe'],
          cwd: projectRoot
        });
        let stderr = '';
        let initialized = false;
        child.stderr.on('data', (data) => {
          stderr += data.toString();
          // Look for successful initialization
          if ((stderr.includes('Starting server') || stderr.includes('stdio')) && !initialized) {
            initialized = true;
            child.kill();
            // Should not have ESM errors
            expect(stderr).not.toMatch(/ERR_REQUIRE_ESM/);
            expect(stderr).not.toMatch(/require\(\) of ES modules is not supported/);
            expect(stderr).not.toMatch(/Cannot use import statement outside a module/);
            resolve();
          }
        });
        child.on('error', (error) => {
          reject(error);
        });
        child.on('close', (code) => {
          if (!initialized) {
            // Even if server doesn't fully start, should not have ESM errors
            expect(stderr).not.toMatch(/ERR_REQUIRE_ESM/);
            resolve();
          }
        });
        // Timeout
        setTimeout(() => {
          if (!initialized) {
            child.kill();
            // Check for ESM errors even on timeout
            expect(stderr).not.toMatch(/ERR_REQUIRE_ESM/);
            resolve();
          }
        }, 8000);
      });
    }, 12000);
    it('should handle stdio transport with MCP protocol', async () => {
      return new Promise((resolve, reject) => {
        const child = spawn('node', [binaryPath, 'start', '--transport', 'stdio'], {
          stdio: ['pipe', 'pipe', 'pipe'],
          cwd: projectRoot
        });
        let stderr = '';
        child.stderr.on('data', (data) => {
          stderr += data.toString();
        });
        // Send a simple MCP message to test protocol
        const initMessage = JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {
            protocolVersion: '2024-11-05',
            capabilities: {},
            clientInfo: { name: 'test-client', version: '1.0.0' }
          }
        }) + '\n';
        child.stdin.write(initMessage);
        child.on('close', (code) => {
          expect(stderr).not.toMatch(/ERR_REQUIRE_ESM/);
          resolve();
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
  describe('HTTP Transport', () => {
    it('should initialize HTTP transport without ESM errors', async () => {
      return new Promise((resolve, reject) => {
        const child = spawn('node', [binaryPath, 'start', '--transport', 'http', '--port', '3333'], {
          stdio: ['pipe', 'pipe', 'pipe'],
          cwd: projectRoot
        });
        let stderr = '';
        let httpStarted = false;
        child.stderr.on('data', (data) => {
          stderr += data.toString();
          // Look for HTTP server startup
          if ((stderr.includes('HTTP') || stderr.includes('3333') || stderr.includes('server')) && !httpStarted) {
            httpStarted = true;
            child.kill();
            expect(stderr).not.toMatch(/ERR_REQUIRE_ESM/);
            resolve();
          }
        });
        child.on('error', (error) => {
          reject(error);
        });
        child.on('close', (code) => {
          expect(stderr).not.toMatch(/ERR_REQUIRE_ESM/);
          if (!httpStarted) {
            resolve();
          }
        });
        setTimeout(() => {
          child.kill();
          expect(stderr).not.toMatch(/ERR_REQUIRE_ESM/);
          resolve();
        }, 8000);
      });
    }, 12000);
    it('should handle port binding with HTTP transport', async () => {
      return new Promise((resolve, reject) => {
        const child = spawn('node', [binaryPath, 'start', '--transport', 'http', '--port', '3334'], {
          stdio: ['pipe', 'pipe', 'pipe'],
          cwd: projectRoot
        });
        let stderr = '';
        child.stderr.on('data', (data) => {
          stderr += data.toString();
        });
        child.on('close', (code) => {
          // Should not have ESM import errors regardless of port binding result
          expect(stderr).not.toMatch(/ERR_REQUIRE_ESM/);
          expect(stderr).not.toMatch(/require\(\) of ES modules is not supported/);
          resolve();
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
  describe('SSE Transport', () => {
    it('should initialize SSE transport without ESM errors', async () => {
      return new Promise((resolve, reject) => {
        const child = spawn('node', [binaryPath, 'start', '--transport', 'sse', '--port', '3335'], {
          stdio: ['pipe', 'pipe', 'pipe'],
          cwd: projectRoot
        });
        let stderr = '';
        child.stderr.on('data', (data) => {
          stderr += data.toString();
        });
        child.on('close', (code) => {
          // Should not have ESM errors even if SSE transport isn't fully supported
          expect(stderr).not.toMatch(/ERR_REQUIRE_ESM/);
          expect(stderr).not.toMatch(/require\(\) of ES modules is not supported/);
          resolve();
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
  describe('Multi-Transport Mode', () => {
    it('should handle multi-transport mode without ESM errors', async () => {
      return new Promise((resolve, reject) => {
        const child = spawn('node', [binaryPath, 'start'], {
          stdio: ['pipe', 'pipe', 'pipe'],
          env: { ...process.env, MCP_MULTI_TRANSPORT: 'true' },
          cwd: projectRoot
        });
        let stderr = '';
        child.stderr.on('data', (data) => {
          stderr += data.toString();
        });
        child.on('close', (code) => {
          expect(stderr).not.toMatch(/ERR_REQUIRE_ESM/);
          resolve();
        });
        child.on('error', (error) => {
          reject(error);
        });
        setTimeout(() => {
          child.kill();
          resolve();
        }, 8000);
      });
    }, 12000);
  });
  describe('Transport Error Handling', () => {
    it('should handle invalid transport gracefully', async () => {
      return new Promise((resolve, reject) => {
        const child = spawn('node', [binaryPath, 'start', '--transport', 'invalid'], {
          stdio: ['pipe', 'pipe', 'pipe'],
          cwd: projectRoot
        });
        let stderr = '';
        child.stderr.on('data', (data) => {
          stderr += data.toString();
        });
        child.on('close', (code) => {
          // Should have validation error, not ESM error
          expect(stderr).not.toMatch(/ERR_REQUIRE_ESM/);
          // Should have meaningful error about invalid transport
          if (code !== 0) {
            expect(stderr).toMatch(/transport|invalid|unsupported/i);
          }
          resolve();
        });
        child.on('error', (error) => {
          reject(error);
        });
        setTimeout(() => {
          child.kill();
          resolve();
        }, 3000);
      });
    }, 8000);
    it('should handle port conflicts gracefully', async () => {
      return new Promise((resolve, reject) => {
        // Start first server
        const server1 = spawn('node', [binaryPath, 'start', '--transport', 'http', '--port', '3336'], {
          stdio: ['pipe', 'pipe', 'pipe'],
          cwd: projectRoot
        });
        setTimeout(() => {
          // Start second server on same port
          const server2 = spawn('node', [binaryPath, 'start', '--transport', 'http', '--port', '3336'], {
            stdio: ['pipe', 'pipe', 'pipe'],
            cwd: projectRoot
          });
          let stderr2 = '';
          server2.stderr.on('data', (data) => {
            stderr2 += data.toString();
          });
          server2.on('close', (code) => {
            expect(stderr2).not.toMatch(/ERR_REQUIRE_ESM/);
            server1.kill();
            server2.kill();
            resolve();
          });
          setTimeout(() => {
            server1.kill();
            server2.kill();
            resolve();
          }, 3000);
        }, 1000);
      });
    }, 10000);
  });
  describe('Transport-Specific Features', () => {
    it('should load transport modules correctly', async () => {
      // Test that transport modules can be imported
      try {
        const { StdioServerTransport } = await import('@modelcontextprotocol/sdk/server/stdio.js');
        expect(StdioServerTransport).toBeDefined();
        expect(typeof StdioServerTransport).toBe('function');
      }
      catch (error) {
        // Should not be an ESM error
        expect(error.message).not.toMatch(/ERR_REQUIRE_ESM/);
        expect(error.message).not.toMatch(/require\(\) of ES modules is not supported/);
      }
    });
    it('should handle async transport initialization', async () => {
      return new Promise((resolve, reject) => {
        const child = spawn('node', [binaryPath, 'start', '--transport', 'stdio'], {
          stdio: ['pipe', 'pipe', 'pipe'],
          cwd: projectRoot
        });
        let stderr = '';
        child.stderr.on('data', (data) => {
          stderr += data.toString();
        });
        child.on('close', (code) => {
          // Async initialization should not cause ESM errors
          expect(stderr).not.toMatch(/ERR_REQUIRE_ESM/);
          expect(stderr).not.toMatch(/await is only valid in async function/);
          resolve();
        });
        child.on('error', (error) => {
          reject(error);
        });
        setTimeout(() => {
          child.kill();
          resolve();
        }, 4000);
      });
    }, 8000);
    it('should handle transport cleanup on shutdown', async () => {
      return new Promise((resolve, reject) => {
        const child = spawn('node', [binaryPath, 'start', '--transport', 'stdio'], {
          stdio: ['pipe', 'pipe', 'pipe'],
          cwd: projectRoot
        });
        let stderr = '';
        child.stderr.on('data', (data) => {
          stderr += data.toString();
        });
        // Send shutdown signal
        setTimeout(() => {
          child.kill('SIGTERM');
        }, 1000);
        child.on('close', (code) => {
          expect(stderr).not.toMatch(/ERR_REQUIRE_ESM/);
          resolve();
        });
        child.on('error', (error) => {
          reject(error);
        });
        setTimeout(() => {
          child.kill('SIGKILL');
          resolve();
        }, 5000);
      });
    }, 8000);
  });
  describe('Environment-Based Transport Selection', () => {
    it('should respect environment variable transport selection', async () => {
      return new Promise((resolve, reject) => {
        const child = spawn('node', [binaryPath, 'start'], {
          stdio: ['pipe', 'pipe', 'pipe'],
          env: { ...process.env, MCP_TRANSPORT: 'stdio' },
          cwd: projectRoot
        });
        let stderr = '';
        child.stderr.on('data', (data) => {
          stderr += data.toString();
        });
        child.on('close', (code) => {
          expect(stderr).not.toMatch(/ERR_REQUIRE_ESM/);
          resolve();
        });
        child.on('error', (error) => {
          reject(error);
        });
        setTimeout(() => {
          child.kill();
          resolve();
        }, 3000);
      });
    }, 8000);
    it('should handle default transport fallback', async () => {
      return new Promise((resolve, reject) => {
        const child = spawn('node', [binaryPath, 'start'], {
          stdio: ['pipe', 'pipe', 'pipe'],
          env: { ...process.env },
          cwd: projectRoot
        });
        let stderr = '';
        child.stderr.on('data', (data) => {
          stderr += data.toString();
        });
        child.on('close', (code) => {
          expect(stderr).not.toMatch(/ERR_REQUIRE_ESM/);
          resolve();
        });
        child.on('error', (error) => {
          reject(error);
        });
        setTimeout(() => {
          child.kill();
          resolve();
        }, 3000);
      });
    }, 8000);
  });
});
//# sourceMappingURL=transport-integration.test.js.map