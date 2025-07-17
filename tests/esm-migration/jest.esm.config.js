/**
 * Jest configuration for ESM migration tests
 * This configuration is specifically for testing ESM compatibility
 */

export default {
  preset: 'ts-jest/presets/default-esm',
  extensionsToTreatAsEsm: ['.ts'],
  testEnvironment: 'node',
  
  // ESM-specific settings
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1'
  },
  
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      useESM: true,
      tsconfig: {
        module: 'ES2022',
        target: 'ES2022',
        moduleResolution: 'node',
        allowSyntheticDefaultImports: true,
        esModuleInterop: true
      }
    }]
  },
  
  // Test patterns for ESM migration tests
  testMatch: [
    '**/tests/esm-migration/**/*.test.ts'
  ],
  
  // Test setup
  setupFilesAfterEnv: ['<rootDir>/setup.esm.ts'],
  
  // Coverage
  collectCoverageFrom: [
    'src/**/*.{ts,js}',
    '!src/**/*.d.ts',
    '!src/**/*.test.ts'
  ],
  
  coverageDirectory: 'coverage/esm-migration',
  coverageReporters: ['text', 'lcov', 'html'],
  
  // Timeouts for integration tests
  testTimeout: 30000,
  
  // Module file extensions
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  
  // Ignore patterns
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/coverage/'
  ],
  
  // ESM resolver
  resolver: undefined, // Use default ESM resolver
  
  // Verbose output for debugging
  verbose: true
};