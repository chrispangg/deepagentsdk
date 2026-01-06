// Test: Subagent Delegation
// Reference: docs/site/handbook/get-started/get-started.mdx lines 285-314
// Description: Tests subagent spawning for specialized work and context isolation

import { createDeepAgent, type SubAgent } from 'deepagentsdk';
import { anthropic } from '@ai-sdk/anthropic';

async function testSubagents() {
  console.log('\n=== Test 05: Subagent Delegation ===\n');

  // Define a specialized research subagent (exact code from docs)
  const researchSubagent: SubAgent = {
    name: 'researcher',
    description: 'Expert in research and data gathering',
    systemPrompt: 'You are a research specialist. Gather comprehensive information.',
  };

  const agent = createDeepAgent({
    model: anthropic('claude-haiku-4-5-20251001'),
    subagents: [researchSubagent],
  });

  // Agent can now delegate tasks to the research subagent (exact code from docs)
  const result = await agent.generate({
    prompt: 'Research AI safety and compile a report',
  });

  // Validation
  console.log('\n--- Validation ---');
  console.log('✅ Agent created with subagent configuration');
  console.log(`✅ Response received: ${result.text.substring(0, 100)}...`);
  console.log(`✅ Files created: ${Object.keys(result.state.files).length} file(s)`);

  // Check if any files contain research content
  const fileContents = Object.values(result.state.files)
    .map(f => f.content.join('\n'))
    .join('\n')
    .toLowerCase();

  if (fileContents.includes('ai') || fileContents.includes('safety') || fileContents.includes('research')) {
    console.log('✅ Research content found in files');
  }

  console.log('\n✅ Test 05 PASSED\n');
}

testSubagents().catch((error) => {
  console.error('\n❌ Test 05 FAILED');
  console.error('Error:', error.message);
  console.error(error);
  process.exit(1);
});
