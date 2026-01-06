// Test: Basic Agent Creation
// Reference: docs/site/handbook/get-started/get-started.mdx lines 154-187
// Description: Tests basic agent creation with createDeepAgent and simple generate() call

import { createDeepAgent } from 'deepagentsdk';
import { anthropic } from '@ai-sdk/anthropic';

async function testBasicAgent() {
  console.log('\n=== Test 01: Basic Agent ===\n');

  // Create the agent (exact code from docs)
  const agent = createDeepAgent({
    model: anthropic('claude-haiku-4-5-20250929'),
    systemPrompt: 'You are a helpful research assistant.',
  });

  // Run the agent (exact code from docs)
  const result = await agent.generate({
    prompt: 'Research the benefits of TypeScript and write a summary to /summary.md',
    maxSteps: 10,
  });

  // Output the results (exact code from docs)
  console.log('Response:', result.text);
  console.log('Todos:', result.state.todos);
  console.log('Files:', Object.keys(result.state.files));

  // Validation
  console.log('\n--- Validation ---');
  console.log('✅ Agent created successfully');
  console.log('✅ Generate completed without errors');
  console.log(`✅ Response received: ${result.text.substring(0, 100)}...`);
  console.log(`✅ Todos tracked: ${result.state.todos.length} todo(s)`);
  console.log(`✅ Files created: ${Object.keys(result.state.files).length} file(s)`);

  if (result.state.files['/summary.md']) {
    console.log('✅ Expected file /summary.md exists');
  }

  console.log('\n✅ Test 01 PASSED\n');
}

testBasicAgent().catch((error) => {
  console.error('\n❌ Test 01 FAILED');
  console.error('Error:', error.message);
  console.error(error);
  process.exit(1);
});
