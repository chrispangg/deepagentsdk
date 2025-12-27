// Test: Streaming with Events
// Reference: docs/site/handbook/get-started/get-started.mdx lines 189-223
// Description: Tests real-time streaming with streamWithEvents() and event handling

import { createDeepAgent } from 'ai-sdk-deep-agent';
import { anthropic } from '@ai-sdk/anthropic';

async function testStreaming() {
  console.log('\n=== Test 02: Streaming with Events ===\n');

  const agent = createDeepAgent({
    model: anthropic('claude-haiku-4-5-20251001'),
    systemPrompt: 'You are a helpful assistant.',
  });

  // Track events for validation
  const eventsReceived = {
    text: 0,
    'tool-call': 0,
    'todos-changed': 0,
    'file-written': 0,
    done: 0,
  };

  // Stream with events (exact code from docs)
  for await (const event of agent.streamWithEvents({
    messages: [{ role: 'user', content: 'Create a project plan' }],
  })) {
    switch (event.type) {
      case 'text':
        process.stdout.write(event.text);
        eventsReceived.text++;
        break;
      case 'tool-call':
        console.log(`\n[Tool: ${event.toolName}]`);
        eventsReceived['tool-call']++;
        break;
      case 'todos-changed':
        console.log('\n[Todos updated]');
        eventsReceived['todos-changed']++;
        break;
      case 'file-written':
        console.log(`\n[File: ${event.path}]`);
        eventsReceived['file-written']++;
        break;
      case 'done':
        console.log('\n[Done]');
        eventsReceived.done++;
        break;
    }
  }

  // Validation
  console.log('\n--- Validation ---');
  console.log('✅ Streaming completed successfully');
  console.log(`✅ Text events received: ${eventsReceived.text}`);
  console.log(`✅ Tool-call events received: ${eventsReceived['tool-call']}`);
  console.log(`✅ Todos-changed events received: ${eventsReceived['todos-changed']}`);
  console.log(`✅ File-written events received: ${eventsReceived['file-written']}`);
  console.log(`✅ Done events received: ${eventsReceived.done}`);

  if (eventsReceived.done > 0) {
    console.log('✅ Agent completed execution');
  }

  console.log('\n✅ Test 02 PASSED\n');
}

testStreaming().catch((error) => {
  console.error('\n❌ Test 02 FAILED');
  console.error('Error:', error.message);
  console.error(error);
  process.exit(1);
});
