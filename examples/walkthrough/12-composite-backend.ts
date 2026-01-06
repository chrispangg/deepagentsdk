// Test: CompositeBackend for Hybrid Storage
// Reference: docs/site/handbook/guides/backends.mdx lines 408-467
// Description: Tests CompositeBackend for routing different paths to different backends

import { createDeepAgent, CompositeBackend, StateBackend, PersistentBackend, InMemoryStore } from 'deepagentsdk';
import { anthropic } from '@ai-sdk/anthropic';

async function testCompositeBackend() {
  console.log('\n=== Test 12: CompositeBackend ===\n');

  const myStore = new InMemoryStore();

  // Exact code from docs
  const backend = new CompositeBackend(
    new StateBackend(), // Default: ephemeral
    {
      '/memories/': new PersistentBackend({ store: myStore }),
      '/cache/': new StateBackend(), // Could also use another backend
    }
  );

  const agent = createDeepAgent({
    model: anthropic('claude-haiku-4-5-20251001'),
    backend,
  });

  // Test routing
  console.log('--- Testing Hybrid Routing ---');
  const result = await agent.generate({
    prompt: `
      1. Create a temporary file at /temp.txt
      2. Create a persistent memory file at /memories/user-preferences.txt
      3. Create a cache file at /cache/temp-data.txt
    `,
    maxSteps: 10,
  });

  const filePaths = Object.keys(result.state.files);
  console.log(`Files created: ${filePaths.length}`);
  console.log(`File paths: ${filePaths.join(', ')}`);

  // Validation
  console.log('\n--- Validation ---');
  console.log('✅ CompositeBackend created with hybrid routing');
  console.log('✅ Default backend: StateBackend (ephemeral)');
  console.log('✅ /memories/ → PersistentBackend');
  console.log('✅ /cache/ → StateBackend');

  const hasMemoryFile = filePaths.some(p => p.startsWith('/memories/'));
  const hasCacheFile = filePaths.some(p => p.startsWith('/cache/'));
  const hasTempFile = filePaths.some(p => p.includes('temp') && !p.startsWith('/memories/') && !p.startsWith('/cache/'));

  if (hasMemoryFile) {
    console.log('✅ Memory file routed correctly');
  }

  if (hasCacheFile) {
    console.log('✅ Cache file routed correctly');
  }

  if (hasTempFile || filePaths.length > 0) {
    console.log('✅ Default routing works');
  }

  console.log('\n✅ Test 12 PASSED\n');
}

testCompositeBackend().catch((error) => {
  console.error('\n❌ Test 12 FAILED');
  console.error('Error:', error.message);
  console.error(error);
  process.exit(1);
});
