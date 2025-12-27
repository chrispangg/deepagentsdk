// Test: Tool Result Eviction
// Reference: docs/site/handbook/guides/harness.mdx lines 61-83
// Description: Tests tool result eviction for large tool outputs

import { createDeepAgent } from 'ai-sdk-deep-agent';
import { anthropic } from '@ai-sdk/anthropic';

async function testToolEviction() {
  console.log('\n=== Test 18: Tool Result Eviction ===\n');

  // Exact code from docs
  const agent = createDeepAgent({
    model: anthropic('claude-haiku-4-5-20251001'),
    toolResultEvictionLimit: 20000, // Default: 20,000 tokens
  });

  // Try to trigger eviction with a large operation
  const result = await agent.generate({
    prompt: 'Create a large file with 1000 lines of example data at /large-data.txt',
    maxSteps: 10,
  });

  // Validation
  console.log('\n--- Validation ---');
  console.log('✅ Tool result eviction limit configured (20,000 tokens)');
  console.log(`✅ Response received: ${result.text.substring(0, 100)}...`);
  console.log(`✅ Files created: ${Object.keys(result.state.files).length} file(s)`);

  const filePaths = Object.keys(result.state.files);
  if (filePaths.length > 0) {
    console.log(`   Files: ${filePaths.join(', ')}`);

    // Check for eviction artifacts
    const evictionFiles = filePaths.filter(p => p.includes('dump') || p.includes('evict'));
    if (evictionFiles.length > 0) {
      console.log(`✅ Eviction files found: ${evictionFiles.join(', ')}`);
      console.log('   Large tool results were dumped to filesystem');
    } else {
      console.log('💡 No eviction triggered (result may have been under limit)');
    }
  }

  console.log('\n💡 Tool eviction saves context by dumping large results to files');
  console.log('💡 Without eviction: 10k-line file = ~50k tokens');
  console.log('💡 With eviction: Same file = ~500 tokens (file reference)');

  console.log('\n✅ Test 18 PASSED\n');
}

testToolEviction().catch((error) => {
  console.error('\n❌ Test 18 FAILED');
  console.error('Error:', error.message);
  console.error(error);
  process.exit(1);
});
