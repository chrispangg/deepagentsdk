/**
 * Node.js Quick Start Example for Deep Agent SDK
 * 
 * This example demonstrates how to use Deep Agent SDK with Node.js runtime.
 * 
 * Setup:
 * 1. npm install deepagentsdk @ai-sdk/anthropic dotenv
 * 2. npm install --save-dev tsx @types/node
 * 3. Create a .env file with: ANTHROPIC_API_KEY=your-key
 * 4. Run: npx tsx examples/nodejs-quickstart.ts
 * 
 * For complete Node.js guide, see: /docs/NODEJS-USAGE.md
 */

// Load environment variables from .env file
// (In Bun, this happens automatically; in Node.js, you need dotenv)
import 'dotenv/config';

import { createDeepAgent } from '../src/index.js';
import { anthropic } from '@ai-sdk/anthropic';

async function main() {
  console.log('🚀 Deep Agent SDK - Node.js Quick Start\n');

  // Create the agent
  const agent = createDeepAgent({
    model: anthropic('claude-sonnet-4-5-20250929'),
    systemPrompt: 'You are a helpful coding assistant.',
  });

  console.log('📝 Asking agent to create a plan...\n');

  // Run the agent
  const result = await agent.generate({
    prompt: 'Create a plan to build a simple TypeScript calculator library with add, subtract, multiply, and divide functions.',
    maxSteps: 10,
  });

  // Output the results
  console.log('\n✅ Agent Response:');
  console.log(result.text);

  console.log('\n📋 Todos Created:');
  result.state.todos.forEach((todo, index) => {
    const statusIcon = {
      'completed': '✅',
      'in_progress': '🔄',
      'pending': '⏳',
      'cancelled': '❌'
    }[todo.status] || '📌';
    
    console.log(`${statusIcon} [${index + 1}] ${todo.content} (${todo.status})`);
  });

  if (Object.keys(result.state.files).length > 0) {
    console.log('\n📁 Files Created:');
    for (const [path, file] of Object.entries(result.state.files)) {
      console.log(`  - ${path} (${file.content.length} lines)`);
    }
  }

  console.log('\n✨ Done! This agent ran on Node.js runtime.');
}

// Run the main function and handle errors
main().catch((error) => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
