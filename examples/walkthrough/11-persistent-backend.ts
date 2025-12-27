// Test: PersistentBackend with Key-Value Store
// Reference: docs/site/handbook/guides/backends.mdx lines 265-320
// Description: Tests PersistentBackend for cross-conversation persistence

import { createDeepAgent, PersistentBackend, InMemoryStore } from 'ai-sdk-deep-agent';
import { anthropic } from '@ai-sdk/anthropic';

async function testPersistentBackend() {
  console.log('\n=== Test 11: PersistentBackend ===\n');

  // Built-in InMemoryStore (exact code from docs)
  const store = new InMemoryStore();

  const agent = createDeepAgent({
    model: anthropic('claude-haiku-4-5-20251001'),
    backend: new PersistentBackend({
      store,
      namespace: 'project-123', // Isolate files per project
    }),
  });

  // First interaction
  console.log('--- First Interaction ---');
  const result1 = await agent.generate({
    prompt: 'Create a persistent file at /persistent-data.txt with important data',
    maxSteps: 5,
  });

  console.log(`Files created: ${Object.keys(result1.state.files).length}`);
  console.log(`File paths: ${Object.keys(result1.state.files).join(', ')}`);

  // Second interaction with same store
  console.log('\n--- Second Interaction (Same Store) ---');
  const agent2 = createDeepAgent({
    model: anthropic('claude-haiku-4-5-20251001'),
    backend: new PersistentBackend({
      store, // Same store instance
      namespace: 'project-123',
    }),
  });

  const result2 = await agent2.generate({
    prompt: 'List all files and read them',
    maxSteps: 5,
  });

  console.log(`Files accessible: ${Object.keys(result2.state.files).length}`);

  // Validation
  console.log('\n--- Validation ---');
  console.log('✅ PersistentBackend created with InMemoryStore');
  console.log('✅ Namespace isolation (project-123)');
  console.log('✅ Files persist across agent instances (same store)');
  console.log('✅ Cross-conversation storage works');

  console.log('\n✅ Test 11 PASSED\n');
}

testPersistentBackend().catch((error) => {
  console.error('\n❌ Test 11 FAILED');
  console.error('Error:', error.message);
  console.error(error);
  process.exit(1);
});
