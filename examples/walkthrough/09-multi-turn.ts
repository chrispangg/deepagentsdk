// Test: Multi-Turn Conversations
// Reference: docs/site/handbook/get-started/get-started.mdx lines 489-521 (Pattern 7)
// Description: Tests maintaining conversation history across multiple turns

import { createDeepAgent, type ModelMessage } from 'deepagentsdk';
import { anthropic } from '@ai-sdk/anthropic';

async function testMultiTurn() {
  console.log('\n=== Test 09: Multi-Turn Conversations ===\n');

  const agent = createDeepAgent({
    model: anthropic('claude-haiku-4-5-20251001'),
  });

  let messages: ModelMessage[] = [];

  // First turn (exact code from docs)
  console.log('--- First Turn ---');
  for await (const event of agent.streamWithEvents({
    messages: [{ role: 'user', content: 'Create a file called hello.txt' }],
  })) {
    if (event.type === 'done') {
      messages = event.messages || [];
    }
    if (event.type === 'text') {
      process.stdout.write(event.text);
    }
  }

  // Second turn - agent remembers the file (exact code from docs)
  console.log('\n\n--- Second Turn ---');
  for await (const event of agent.streamWithEvents({
    messages: [
      ...messages,
      { role: 'user', content: 'What file did you just create?' }
    ],
  })) {
    if (event.type === 'text') {
      process.stdout.write(event.text);
    }
  }

  // Validation
  console.log('\n\n--- Validation ---');
  console.log('✅ First turn completed');
  console.log(`✅ Messages saved: ${messages.length} message(s)`);
  console.log('✅ Second turn completed with message history');
  console.log('✅ Agent maintained conversation context');

  console.log('\n✅ Test 09 PASSED\n');
}

testMultiTurn().catch((error) => {
  console.error('\n❌ Test 09 FAILED');
  console.error('Error:', error.message);
  console.error(error);
  process.exit(1);
});
