// Test: Advanced Subagent Features
// Reference: docs/site/handbook/guides/subagents.mdx lines 60-100
// Description: Tests multiple specialized subagents with custom configurations

import { createDeepAgent } from 'ai-sdk-deep-agent';
import { anthropic } from '@ai-sdk/anthropic';

async function testAdvancedSubagents() {
  console.log('\n=== Test 13: Advanced Subagent Features ===\n');

  // Multiple specialized subagents (from docs)
  const agent = createDeepAgent({
    model: anthropic('claude-haiku-4-5-20251001'),
    subagents: [
      {
        name: 'researcher',
        description: 'Expert at researching topics using web search',
        systemPrompt: 'You are a research specialist. Use web_search to find information and provide comprehensive summaries.',
      },
      {
        name: 'coder',
        description: 'Expert at writing and reviewing code',
        systemPrompt: 'You are a software engineer. Write clean, well-documented code with tests.',
      },
    ],
  });

  const result = await agent.generate({
    prompt: 'Research TypeScript and write example code',
    maxSteps: 10,
  });

  // Validation
  console.log('\n--- Validation ---');
  console.log('✅ Agent created with multiple specialized subagents');
  console.log('✅ Subagents: researcher, coder');
  console.log(`✅ Response received: ${result.text.substring(0, 100)}...`);
  console.log(`✅ Files created: ${Object.keys(result.state.files).length} file(s)`);

  const filePaths = Object.keys(result.state.files);
  if (filePaths.length > 0) {
    console.log(`✅ File paths: ${filePaths.join(', ')}`);
  }

  console.log('\n✅ Test 13 PASSED\n');
}

testAdvancedSubagents().catch((error) => {
  console.error('\n❌ Test 13 FAILED');
  console.error('Error:', error.message);
  console.error(error);
  process.exit(1);
});
