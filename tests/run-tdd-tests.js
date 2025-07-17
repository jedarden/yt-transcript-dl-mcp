#!/usr/bin/env node
// TDD Test Runner - Runs all tests and shows which ones fail first
// This proves our TDD approach by showing failing tests before implementation

import { spawn } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

const testFiles = [
  'jest-esm.test.js',
  'dependencies.test.js', 
  'mcp-sdk.test.js',
  'github-release.test.js',
  'docker-build.test.js'
];

const testResults = {};

console.log('🧪 Running TDD Tests - These SHOULD FAIL initially!');
console.log('=' .repeat(60));

for (const testFile of testFiles) {
  console.log(`\n📝 Running ${testFile}...`);
  
  try {
    const result = await runTest(testFile);
    testResults[testFile] = result;
    
    if (result.success) {
      console.log(`✅ ${testFile}: PASSED (${result.passedTests} tests)`);
    } else {
      console.log(`❌ ${testFile}: FAILED (${result.failedTests} failures)`);
      console.log(`   Reason: ${result.error}`);
    }
  } catch (error) {
    console.log(`💥 ${testFile}: ERROR - ${error.message}`);
    testResults[testFile] = { success: false, error: error.message };
  }
}

console.log('\n' + '=' .repeat(60));
console.log('📊 TDD Test Summary:');
console.log('=' .repeat(60));

let totalPassed = 0;
let totalFailed = 0;

Object.entries(testResults).forEach(([file, result]) => {
  if (result.success) {
    console.log(`✅ ${file}`);
    totalPassed++;
  } else {
    console.log(`❌ ${file} - ${result.error}`);
    totalFailed++;
  }
});

console.log(`\n📈 Results: ${totalPassed} passed, ${totalFailed} failed`);

if (totalFailed > 0) {
  console.log('\n🎯 TDD SUCCESS! Tests are failing as expected.');
  console.log('Now implement the fixes to make these tests pass!');
  process.exit(0); // Exit 0 because failing tests is expected in TDD
} else {
  console.log('\n⚠️  All tests passed - this might indicate tests need to be more strict.');
  process.exit(1);
}

function runTest(testFile) {
  return new Promise((resolve) => {
    const testPath = join(__dirname, testFile);
    const child = spawn('node', ['--experimental-vm-modules', testPath], {
      cwd: projectRoot,
      stdio: 'pipe'
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
      const success = code === 0;
      const output = stdout + stderr;
      
      const passedTests = (output.match(/✓|PASS/g) || []).length;
      const failedTests = (output.match(/✗|FAIL/g) || []).length;
      
      resolve({
        success,
        passedTests,
        failedTests,
        error: success ? null : `Exit code ${code}`,
        output
      });
    });
  });
}
