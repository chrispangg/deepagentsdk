/**
 * Node.js Streaming Example for Deep Agent SDK
 * 
 * This example demonstrates real-time streaming with Node.js runtime.
 * 
 * Setup:
 * 1. npm install deepagentsdk @ai-sdk/anthropic dotenv
 * 2. npm install --save-dev tsx @types/node
 * 3. Create a .env file with: ANTHROPIC_API_KEY=your-key
 * 4. Run: npx tsx examples/nodejs-streaming.ts
 */

import 'dotenv/config';
import { createDeepAgent } from '../src/index.js';
import { anthropic } from '@ai-sdk/anthropic';

async function main() {
  console.log('🚀 Deep Agent SDK - Node.js Streaming Example\n');

  const agent = createDeepAgent({
    model: anthropic('claude-sonnet-4-5-20250929'),
    systemPrompt: 'You are a creative writing assistant.',
  });

  console.log('📝 Streaming agent response...\n');
  console.log('━'.repeat(50));

  // Stream with events
  for await (const event of agent.streamWithEvents({
    prompt: 'Write a short story about a developer who discovers that their code comes to life at night.',
  })) {
    switch (event.type) {
      case 'text':
        // Stream text directly to stdout (no newline)
        process.stdout.write(event.text);
        break;

      case 'tool-call':
        console.log(`\n\n🔧 [Tool Called: ${event.toolName}]`);
        break;

      case 'todos-changed':
        console.log('\n\n📋 [Todos Updated]');
        break;

      case 'file-written':
        console.log(`\n\n📁 [File Created: ${event.path}]`);
        break;

      case 'file-edited':
        console.log(`\n\n✏️ [File Edited: ${event.path}]`);
        break;

      case 'done':
        console.log('\n\n━'.repeat(50));
        console.log('✅ [Streaming Complete]\n');
        
        // Access final state
        if (event.state) {
          if (event.state.todos.length > 0) {
            console.log('📋 Todos:');
            event.state.todos.forEach(todo => {
              console.log(`  - [${todo.status}] ${todo.content}`);
            });
          }
          
          const fileCount = Object.keys(event.state.files).length;
          if (fileCount > 0) {
            console.log(`\n📁 Files created: ${fileCount}`);
          }
        }
        break;

      case 'error':
        console.error('\n\n❌ Error:', event.error);
        break;
    }
  }

  console.log('\n✨ Streaming demo complete! Running on Node.js.');
}

main().catch((error) => {
  console.error('\n❌ Error:', error.message);
  process.exit(1);
});
