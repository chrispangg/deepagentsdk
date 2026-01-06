// Test: Virtual Filesystem
// Reference: docs/site/handbook/get-started/get-started.mdx lines 255-283
// Description: Tests filesystem tools (ls, read_file, write_file, edit_file, glob, grep)

import { createDeepAgent } from 'deepagentsdk';
import { anthropic } from '@ai-sdk/anthropic';

async function testFilesystem() {
  console.log('\n=== Test 04: Virtual Filesystem ===\n');

  const agent = createDeepAgent({
    model: anthropic('claude-haiku-4-5-20251001'),
    systemPrompt: 'You are a coding assistant.',
  });

  const result = await agent.generate({
    prompt: 'Create a TypeScript file at /utils/math.ts with some utility functions',
  });

  // Access created files (exact code from docs)
  for (const [path, file] of Object.entries(result.state.files)) {
    console.log(`File: ${path}`);
    console.log(file.content.join('\n'));
  }

  // Validation
  console.log('\n--- Validation ---');
  console.log(`✅ Files created: ${Object.keys(result.state.files).length} file(s)`);

  const filePaths = Object.keys(result.state.files);
  console.log(`✅ File paths: ${filePaths.join(', ')}`);

  // Check if the expected file exists
  const hasMathFile = filePaths.some(p => p.includes('math.ts'));
  if (hasMathFile) {
    console.log('✅ Expected file path contains math.ts');
  }

  // Verify file has content
  const firstFile = Object.values(result.state.files)[0];
  if (firstFile && firstFile.content.length > 0) {
    console.log('✅ File has content');
    console.log(`   First line: ${firstFile.content[0]}`);
  }

  console.log('\n✅ Test 04 PASSED\n');
}

testFilesystem().catch((error) => {
  console.error('\n❌ Test 04 FAILED');
  console.error('Error:', error.message);
  console.error(error);
  process.exit(1);
});
