# ESM Migration Test Suite

This directory contains comprehensive **Test-Driven Development (TDD)** tests for the ESM migration of the YouTube Transcript MCP Server. These tests **MUST PASS** after implementing the ESM migration to ensure the exact ERR_REQUIRE_ESM error is fixed.

## 🎯 Test Purpose

The primary goal is to prevent and test the fix for this exact error:
```
ERR_REQUIRE_ESM: require() of ES modules is not supported
```

## 📋 Test Categories

### 1. Binary Execution Tests (`binary-execution.test.ts`)
**Focus**: ERR_REQUIRE_ESM prevention when running the binary

**Key Tests**:
- ✅ Package.json has `type: "module"` for ESM support
- ✅ Binary has correct shebang and uses ESM imports (not require)
- ✅ Binary executes without ERR_REQUIRE_ESM error
- ✅ Server starts with stdio transport without import errors
- ✅ Test command handles dynamic imports correctly
- ✅ Environment variables work with ESM context

### 2. Import Resolution Tests (`import-resolution.test.ts`)
**Focus**: Import statements resolve correctly with .js extensions and ESM compatibility

**Key Tests**:
- ✅ TypeScript configuration set to ESNext/ES2022 modules
- ✅ Source files use ESM import syntax (not CommonJS require)
- ✅ Compiled output has .js extensions for relative imports
- ✅ MCP SDK imports work with ESM syntax
- ✅ Third-party CommonJS packages import correctly
- ✅ Dynamic imports function properly
- ✅ No .ts file references in compiled output

### 3. MCP SDK Compatibility Tests (`mcp-sdk-compatibility.test.ts`)
**Focus**: MCP SDK imports, server initialization, and transport functionality

**Key Tests**:
- ✅ Server class imports correctly from MCP SDK
- ✅ Transport modules (stdio, SSE) import without errors
- ✅ Protocol types and schemas accessible
- ✅ Server initialization works with ESM imports
- ✅ Request handlers set up without import/export issues
- ✅ Tool registration and execution work properly
- ✅ Error handling maintains MCP compatibility
- ✅ TypeScript types work in ESM context

### 4. CLI Functionality Tests (`cli-functionality.test.ts`)
**Focus**: Command parsing, argument handling, and CLI execution with ESM

**Key Tests**:
- ✅ Help and version commands work without ESM errors
- ✅ Start command options parse correctly
- ✅ Test command handles video ID argument
- ✅ Environment variables respected
- ✅ Signal handling (SIGINT/SIGTERM) works
- ✅ Error validation provides meaningful messages
- ✅ No ERR_REQUIRE_ESM in any CLI operation

### 5. Transport Integration Tests (`transport-integration.test.ts`)
**Focus**: stdio, SSE, and HTTP transport integration with ESM

**Key Tests**:
- ✅ Stdio transport initializes without import errors
- ✅ HTTP transport starts and handles port binding
- ✅ SSE transport works (if supported)
- ✅ Multi-transport mode functions correctly
- ✅ Invalid transport handling graceful
- ✅ Transport modules load correctly
- ✅ Async transport initialization works
- ✅ Transport cleanup on shutdown

## 🚀 Running the Tests

### Run All ESM Migration Tests
```bash
# Use the dedicated test script
./tests/esm-migration/run-esm-tests.sh

# Or use Jest directly
npx jest --config=tests/esm-migration/jest.esm.config.js
```

### Run Individual Test Categories
```bash
# Binary execution tests
npx jest tests/esm-migration/binary-execution.test.ts

# Import resolution tests  
npx jest tests/esm-migration/import-resolution.test.ts

# MCP SDK compatibility tests
npx jest tests/esm-migration/mcp-sdk-compatibility.test.ts

# CLI functionality tests
npx jest tests/esm-migration/cli-functionality.test.ts

# Transport integration tests
npx jest tests/esm-migration/transport-integration.test.ts
```

### Quick Smoke Test
```bash
# Test the binary directly (should NOT show ERR_REQUIRE_ESM)
node dist/bin/server.js --help

# Test server startup
timeout 5s node dist/bin/server.js start --transport stdio
```

## 📝 Test Configuration

### Jest ESM Configuration (`jest.esm.config.js`)
- Uses `ts-jest/presets/default-esm` preset
- Enables `extensionsToTreatAsEsm: ['.ts']`
- Maps `.js` imports to TypeScript files
- ESM-compatible transform settings
- Extended timeout for integration tests

### Test Setup (`setup.esm.ts`)
- ESM-compatible mocking with `jest.unstable_mockModule`
- Error handlers for ESM-specific issues
- Mock functions for winston and youtube-transcript

## 🎯 Expected Results

### ✅ BEFORE ESM Migration (Current State)
These tests will **FAIL** because:
- Package.json has `"module": "commonjs"`  
- TypeScript compiles to CommonJS
- Binary uses `require()` statements
- ERR_REQUIRE_ESM error occurs when running binary

### ✅ AFTER ESM Migration (Target State)  
These tests will **PASS** because:
- Package.json has `"type": "module"`
- TypeScript compiles to ESNext modules
- Binary uses `import` statements with .js extensions
- No ERR_REQUIRE_ESM errors occur
- All functionality preserved

## 🔧 Implementation Checklist

Use these tests to guide the ESM migration implementation:

### 1. Package Configuration
- [ ] Add `"type": "module"` to package.json
- [ ] Update tsconfig.json: `"module": "ESNext"`
- [ ] Ensure Node.js version >= 18 in engines

### 2. Source Code Changes
- [ ] Replace `require()` with `import` statements
- [ ] Use relative imports with `.js` extensions
- [ ] Update `require.main === module` checks
- [ ] Handle dynamic imports for conditional loading

### 3. Build Configuration  
- [ ] Update TypeScript to output ESM-compatible code
- [ ] Ensure compiled .js files have proper import extensions
- [ ] Update binary shebang and imports

### 4. Test Updates
- [ ] Update existing tests for ESM compatibility
- [ ] Fix any CommonJS-specific test patterns
- [ ] Update Jest configuration for ESM

## 🐛 Common Issues to Avoid

1. **Missing .js Extensions**: Relative imports MUST have .js extensions
2. **CommonJS Patterns**: No `require()`, `module.exports`, or `__dirname`
3. **Mixed Modules**: Don't mix CommonJS and ESM in same project
4. **Test Configuration**: Jest needs special ESM configuration
5. **Dynamic Imports**: Use `import()` for conditional loading

## 📊 Test Coverage

The tests cover:
- ✅ Binary execution and ERR_REQUIRE_ESM prevention
- ✅ Import/export syntax and resolution  
- ✅ MCP SDK compatibility and integration
- ✅ CLI command parsing and execution
- ✅ Transport layer functionality
- ✅ Error handling and edge cases
- ✅ Environment variable handling
- ✅ Signal handling and graceful shutdown

## 🎉 Success Criteria

The ESM migration is successful when:
1. **All tests in this suite PASS**
2. **No ERR_REQUIRE_ESM errors occur anywhere**
3. **Binary executes correctly with all commands**
4. **MCP SDK integration remains functional**
5. **All transport modes work properly**
6. **Existing functionality is preserved**

---

**Remember**: These are TDD tests - they define the success criteria for the ESM migration. Implement the migration to make these tests pass!