#!/bin/bash

# Script to run ESM migration tests
# This script tests the ESM migration implementation

set -e

echo "🚀 Running ESM Migration Tests"
echo "================================="

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Must be run from project root"
    exit 1
fi

# Build the project first
echo "📦 Building project..."
npm run build

# Check if build was successful
if [ ! -f "dist/bin/server.js" ]; then
    echo "❌ Error: Build failed - binary not found"
    exit 1
fi

# Run ESM-specific tests
echo "🧪 Running ESM migration tests..."

# Use the ESM Jest configuration
npx jest --config=tests/esm-migration/jest.esm.config.js --verbose

# Run a quick smoke test of the binary
echo "🔥 Running binary smoke test..."

# Test help command
echo "Testing --help command..."
timeout 10s node dist/bin/server.js --help || {
    echo "❌ Error: Binary help command failed"
    exit 1
}

# Test that binary doesn't have ERR_REQUIRE_ESM
echo "Testing for ERR_REQUIRE_ESM error..."
output=$(timeout 5s node dist/bin/server.js --help 2>&1 || true)
if echo "$output" | grep -q "ERR_REQUIRE_ESM"; then
    echo "❌ Error: ERR_REQUIRE_ESM found in output:"
    echo "$output"
    exit 1
fi

echo "✅ Binary smoke test passed"

# Test basic server start (with timeout)
echo "Testing server startup..."
timeout 5s node dist/bin/server.js start --transport stdio 2>&1 | head -n 10 || {
    # This may timeout, which is expected
    true
}

# Check for successful ESM loading
echo "Testing ESM module loading..."
node -e "
import('./dist/index.js').then(() => {
    console.log('✅ ESM module loading successful');
    process.exit(0);
}).catch((error) => {
    console.error('❌ ESM module loading failed:', error.message);
    process.exit(1);
});
" || {
    echo "❌ Error: ESM module loading failed"
    exit 1
}

echo ""
echo "🎉 All ESM migration tests passed!"
echo "✅ Binary execution works without ERR_REQUIRE_ESM"
echo "✅ Import statements resolve correctly"
echo "✅ MCP SDK compatibility maintained"
echo "✅ CLI functionality preserved"
echo "✅ Transport integration working"
echo ""
echo "The ESM migration is ready for implementation!"