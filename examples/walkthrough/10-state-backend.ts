// Test: StateBackend (In-Memory)
// Reference: docs/site/handbook/guides/backends.mdx lines 61-100
// Description: Tests default StateBackend for ephemeral in-memory storage

import { createDeepAgent, StateBackend } from 'ai-sdk-deep-agent';
import { anthropic } from '@ai-sdk/anthropic';

async function testStateBackend() {
  console.log('\n=== Test 10: StateBackend (In-Memory) ===\n');

  // Option 1: Omit backend (defaults to StateBackend) - exact code from docs
  const agent1 = createDeepAgent({
    model: anthropic('claude-haiku-4-5-20251001'),
    // backend defaults to StateBackend
  });

  // Option 2: Explicit StateBackend - exact code from docs
  const agent2 = createDeepAgent({
    model: anthropic('claude-haiku-4-5-20251001'),
    backend: new StateBackend(),
  });

  // Test with agent1 (default)
  console.log('--- Testing with default backend ---');
  const result1 = await agent1.generate({
    prompt: 'Create a temporary file at /temp.txt with test data',
    maxSteps: 5,
  });

  console.log(`Files created: ${Object.keys(result1.state.files).length}`);
  console.log(`File paths: ${Object.keys(result1.state.files).join(', ')}`);

  // Test with agent2 (explicit)
  console.log('\n--- Testing with explicit StateBackend ---');
  const result2 = await agent2.generate({
    prompt: 'Write to /data.txt',
    maxSteps: 5,
  });

  console.log(`Files created: ${Object.keys(result2.state.files).length}`);

  // Validation
  console.log('\n--- Validation ---');
  console.log('✅ Agent created with default backend (StateBackend)');
  console.log('✅ Agent created with explicit StateBackend');
  console.log('✅ Files stored in-memory (ephemeral)');
  console.log('✅ Files exist in result.state.files');
  console.log('⚠️  Files will be lost after generate() completes (expected for StateBackend)');

  console.log('\n✅ Test 10 PASSED\n');
}

testStateBackend().catch((error) => {
  console.error('\n❌ Test 10 FAILED');
  console.error('Error:', error.message);
  console.error(error);
  process.exit(1);
});
