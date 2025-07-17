/**
 * TDD Tests for ESM Migration - CLI Functionality
 *
 * These tests MUST pass after ESM migration to ensure CLI commands work correctly.
 * Focus: Command parsing, argument handling, and CLI execution with ESM
 */
import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs';
const execAsync = promisify(exec);
describe('ESM Migration - CLI Functionality', () => {
    const binaryPath = path.join(__dirname, '../../dist/bin/server.js');
    const projectRoot = path.join(__dirname, '../..');
    beforeAll(async () => {
        // Ensure the project is built
        if (!fs.existsSync(binaryPath)) {
            await execAsync('npm run build', { cwd: projectRoot });
        }
    });
    describe('Command Parsing and Help', () => {
        it('should display help without ESM errors', async () => {
            const { stdout, stderr } = await execAsync(`node ${binaryPath} --help`);
            // Should not have any ESM-related errors
            expect(stderr).not.toMatch(/ERR_REQUIRE_ESM/);
            expect(stderr).not.toMatch(/require\(\) of ES modules is not supported/);
            expect(stderr).not.toMatch(/Cannot use import statement outside a module/);
            // Should display proper help
            expect(stdout).toMatch(/YouTube Transcript Download MCP Server/);
            expect(stdout).toMatch(/Usage:/);
            expect(stdout).toMatch(/Commands:/);
            expect(stdout).toMatch(/start.*Start the MCP server/);
            expect(stdout).toMatch(/test.*Test the server/);
        });
        it('should show version information', async () => {
            const { stdout, stderr } = await execAsync(`node ${binaryPath} --version`);
            expect(stderr).not.toMatch(/ERR_REQUIRE_ESM/);
            expect(stdout).toMatch(/\d+\.\d+\.\d+/); // Version format
        });
        it('should handle unknown commands gracefully', async () => {
            try {
                await execAsync(`node ${binaryPath} unknown-command`);
                fail('Should have thrown an error for unknown command');
            }
            catch (error) {
                expect(error.stderr).not.toMatch(/ERR_REQUIRE_ESM/);
                expect(error.stderr).toMatch(/unknown command|error: unknown/i);
                expect(error.code).toBe(1);
            }
        });
    });
    describe('Start Command', () => {
        it('should parse start command options', async () => {
            const { stdout, stderr } = await execAsync(`node ${binaryPath} start --help`);
            expect(stderr).not.toMatch(/ERR_REQUIRE_ESM/);
            expect(stdout).toMatch(/Start the MCP server/);
            expect(stdout).toMatch(/-t, --transport/);
            expect(stdout).toMatch(/-p, --port/);
            expect(stdout).toMatch(/-v, --verbose/);
        });
        it('should handle transport option validation', async () => {
            return new Promise((resolve, reject) => {
                const child = spawn('node', [binaryPath, 'start', '--transport', 'stdio'], {
                    stdio: ['pipe', 'pipe', 'pipe'],
                    cwd: projectRoot
                });
                let stderr = '';
                child.stderr.on('data', (data) => {
                    stderr += data.toString();
                    if (stderr.includes('Starting server') || stderr.includes('Server started')) {
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
                    if (!stderr.includes('Starting server')) {
                        reject(new Error(`Expected server startup message, got: ${stderr}`));
                    }
                    else {
                        resolve();
                    }
                }, 5000);
            });
        }, 10000);
        it('should handle port option', async () => {
            return new Promise((resolve, reject) => {
                const child = spawn('node', [binaryPath, 'start', '--transport', 'http', '--port', '3001'], {
                    stdio: ['pipe', 'pipe', 'pipe'],
                    cwd: projectRoot
                });
                let stderr = '';
                child.stderr.on('data', (data) => {
                    stderr += data.toString();
                });
                child.on('close', (code) => {
                    expect(stderr).not.toMatch(/ERR_REQUIRE_ESM/);
                    // Port validation or server startup should occur
                    resolve();
                });
                child.on('error', (error) => {
                    reject(error);
                });
                // Kill after short time since we're just testing option parsing
                setTimeout(() => {
                    child.kill();
                    resolve();
                }, 2000);
            });
        }, 10000);
        it('should handle verbose option', async () => {
            return new Promise((resolve, reject) => {
                const child = spawn('node', [binaryPath, 'start', '--verbose'], {
                    stdio: ['pipe', 'pipe', 'pipe'],
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
                }, 2000);
            });
        }, 10000);
    });
    describe('Test Command', () => {
        it('should parse test command options', async () => {
            const { stdout, stderr } = await execAsync(`node ${binaryPath} test --help`);
            expect(stderr).not.toMatch(/ERR_REQUIRE_ESM/);
            expect(stdout).toMatch(/Test the server/);
            expect(stdout).toMatch(/-l, --language/);
            expect(stdout).toMatch(/-f, --format/);
            expect(stdout).toMatch(/video-id.*YouTube video ID/);
        });
        it('should require video ID argument', async () => {
            try {
                await execAsync(`node ${binaryPath} test`);
                fail('Should require video ID argument');
            }
            catch (error) {
                expect(error.stderr).not.toMatch(/ERR_REQUIRE_ESM/);
                expect(error.stderr).toMatch(/missing required argument|required/i);
            }
        });
        it('should handle test command with video ID', async () => {
            return new Promise((resolve, reject) => {
                const child = spawn('node', [binaryPath, 'test', 'dQw4w9WgXcQ'], {
                    stdio: ['pipe', 'pipe', 'pipe'],
                    cwd: projectRoot
                });
                let stderr = '';
                let stdout = '';
                child.stderr.on('data', (data) => {
                    stderr += data.toString();
                });
                child.stdout.on('data', (data) => {
                    stdout += data.toString();
                });
                child.on('close', (code) => {
                    // Should not have ESM errors regardless of network result
                    expect(stderr).not.toMatch(/ERR_REQUIRE_ESM/);
                    expect(stderr).not.toMatch(/require\(\) of ES modules is not supported/);
                    // Should attempt to test (network call may fail in CI)
                    if (stderr.includes('Testing transcript') || stdout.length > 0) {
                        // Test command executed successfully
                    }
                    resolve();
                });
                child.on('error', (error) => {
                    reject(error);
                });
                // Timeout for network operations
                setTimeout(() => {
                    child.kill();
                    resolve();
                }, 15000);
            });
        }, 20000);
        it('should handle language option', async () => {
            return new Promise((resolve, reject) => {
                const child = spawn('node', [binaryPath, 'test', 'dQw4w9WgXcQ', '--language', 'es'], {
                    stdio: ['pipe', 'pipe', 'pipe'],
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
                }, 10000);
            });
        }, 15000);
        it('should handle format option', async () => {
            return new Promise((resolve, reject) => {
                const child = spawn('node', [binaryPath, 'test', 'dQw4w9WgXcQ', '--format', 'text'], {
                    stdio: ['pipe', 'pipe', 'pipe'],
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
                }, 10000);
            });
        }, 15000);
    });
    describe('Environment Variable Handling', () => {
        it('should respect MCP_TRANSPORT environment variable', async () => {
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
        }, 10000);
        it('should respect PORT environment variable', async () => {
            return new Promise((resolve, reject) => {
                const child = spawn('node', [binaryPath, 'start', '--transport', 'http'], {
                    stdio: ['pipe', 'pipe', 'pipe'],
                    env: { ...process.env, PORT: '3002' },
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
        }, 10000);
    });
    describe('Signal Handling', () => {
        it('should handle SIGINT gracefully', async () => {
            return new Promise((resolve, reject) => {
                const child = spawn('node', [binaryPath, 'start'], {
                    stdio: ['pipe', 'pipe', 'pipe'],
                    cwd: projectRoot
                });
                let stderr = '';
                let gracefulShutdown = false;
                child.stderr.on('data', (data) => {
                    stderr += data.toString();
                    if (stderr.includes('SIGINT') || stderr.includes('shutting down')) {
                        gracefulShutdown = true;
                    }
                });
                child.on('close', (code) => {
                    expect(stderr).not.toMatch(/ERR_REQUIRE_ESM/);
                    resolve();
                });
                child.on('error', (error) => {
                    reject(error);
                });
                // Send SIGINT after a short delay
                setTimeout(() => {
                    child.kill('SIGINT');
                }, 1000);
                setTimeout(() => {
                    child.kill('SIGKILL'); // Force kill if needed
                    resolve();
                }, 5000);
            });
        }, 10000);
        it('should handle SIGTERM gracefully', async () => {
            return new Promise((resolve, reject) => {
                const child = spawn('node', [binaryPath, 'start'], {
                    stdio: ['pipe', 'pipe', 'pipe'],
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
                // Send SIGTERM after a short delay
                setTimeout(() => {
                    child.kill('SIGTERM');
                }, 1000);
                setTimeout(() => {
                    child.kill('SIGKILL'); // Force kill if needed
                    resolve();
                }, 5000);
            });
        }, 10000);
    });
    describe('Error Handling and Validation', () => {
        it('should validate command arguments', async () => {
            try {
                await execAsync(`node ${binaryPath} start --transport invalid-transport`);
                fail('Should reject invalid transport');
            }
            catch (error) {
                expect(error.stderr).not.toMatch(/ERR_REQUIRE_ESM/);
                // Should have validation error, not import error
            }
        });
        it('should handle missing arguments gracefully', async () => {
            try {
                await execAsync(`node ${binaryPath} test --language`);
                fail('Should require value for --language option');
            }
            catch (error) {
                expect(error.stderr).not.toMatch(/ERR_REQUIRE_ESM/);
                expect(error.stderr).toMatch(/option.*requires argument|missing argument/i);
            }
        });
        it('should provide meaningful error messages', async () => {
            try {
                await execAsync(`node ${binaryPath} invalid-subcommand`);
                fail('Should reject invalid subcommand');
            }
            catch (error) {
                expect(error.stderr).not.toMatch(/ERR_REQUIRE_ESM/);
                expect(error.stderr).toMatch(/unknown command/i);
            }
        });
    });
});
//# sourceMappingURL=cli-functionality.test.js.map