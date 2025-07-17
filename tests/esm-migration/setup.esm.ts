/**
 * ESM migration test setup
 * This file sets up the testing environment for ESM compatibility tests
 */

// Global test setup for ESM migration tests
declare global {
  var __TEST_ESM_ENVIRONMENT__: boolean;
}

// Mark environment as ESM test environment
globalThis.__TEST_ESM_ENVIRONMENT__ = true;

// Setup any ESM-specific configurations
export {};