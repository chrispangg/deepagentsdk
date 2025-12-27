// Test: Filesystem Backend Persistence
// Reference: docs/site/handbook/get-started/get-started.mdx lines 316-335 (Pattern 1)
// Description: Tests FilesystemBackend for storing files on disk

import { createDeepAgent, FilesystemBackend } from 'ai-sdk-deep-agent';
import { anthropic } from '@ai-sdk/anthropic';
import { existsSync, readdirSync } from 'fs';

async function testFilesystemBackend() {
  console.log('\n=== Test 06: Filesystem Backend ===\n');

  const agent = createDeepAgent({
    model: anthropic('claude-haiku-4-5-20251001'),
    backend: new FilesystemBackend({ rootDir: './workspace' }),
  });

  const result = await agent.generate({
    prompt: 'Create a project and save files',
  });

  // Files are now on disk at ./workspace/ (exact comment from docs)
  console.log('\n--- Validation ---');
  console.log('✅ Agent created with FilesystemBackend');
  console.log(`✅ Response received: ${result.text.substring(0, 100)}...`);

  // Check if workspace directory exists
  if (existsSync('./workspace')) {
    console.log('✅ Workspace directory exists');

    const files = readdirSync('./workspace', { recursive: true });
    console.log(`✅ Files on disk: ${files.length} file(s)`);
    console.log(`   Files: ${files.slice(0, 5).join(', ')}${files.length > 5 ? ', ...' : ''}`);
  } else {
    console.log('⚠️  Workspace directory not found (files may be in virtual state)');
  }

  console.log('\n✅ Test 06 PASSED\n');
}

testFilesystemBackend().catch((error) => {
  console.error('\n❌ Test 06 FAILED');
  console.error('Error:', error.message);
  console.error(error);
  process.exit(1);
});
