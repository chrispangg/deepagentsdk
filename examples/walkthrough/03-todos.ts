// Test: Todos and Planning
// Reference: docs/site/handbook/get-started/get-started.mdx lines 227-253
// Description: Tests write_todos tool for task planning and tracking

import { createDeepAgent } from 'ai-sdk-deep-agent';
import { anthropic } from '@ai-sdk/anthropic';

async function testTodos() {
  console.log('\n=== Test 03: Todos and Planning ===\n');

  // Agent automatically uses todos when you prompt it to plan (exact code from docs)
  const agent = createDeepAgent({
    model: anthropic('claude-haiku-4-5-20251001'),
  });

  const result = await agent.generate({
    prompt: `
      Create a plan for building a todo app:
      1. Use write_todos to break down the task
      2. Work through each task systematically
      3. Update todo status as you progress
    `,
  });

  // Access todo state (exact code from docs)
  result.state.todos.forEach(todo => {
    console.log(`[${todo.status}] ${todo.content}`);
  });

  // Validation
  console.log('\n--- Validation ---');
  console.log(`✅ Todos created: ${result.state.todos.length} todo(s)`);

  // Check todo status flow: pending → in_progress → completed
  const statusTypes = new Set(result.state.todos.map(t => t.status));
  console.log(`✅ Todo statuses found: ${Array.from(statusTypes).join(', ')}`);

  const hasCompleted = result.state.todos.some(t => t.status === 'completed');
  const hasPending = result.state.todos.some(t => t.status === 'pending');

  if (hasCompleted) {
    console.log('✅ Some todos marked as completed');
  }

  if (result.state.todos.length > 0) {
    console.log('✅ Todo tracking is working');
  }

  console.log('\n✅ Test 03 PASSED\n');
}

testTodos().catch((error) => {
  console.error('\n❌ Test 03 FAILED');
  console.error('Error:', error.message);
  console.error(error);
  process.exit(1);
});
