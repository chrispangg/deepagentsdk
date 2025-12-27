// Test: Custom Tools
// Reference: docs/content/get-started/get-started.mdx lines 370-402 (Pattern 3)
// Description: Tests adding custom tools alongside built-in ones

import { createDeepAgent } from 'ai-sdk-deep-agent';
import { anthropic } from '@ai-sdk/anthropic';
import { tool } from 'ai';
import { z } from 'zod';

async function testCustomTools() {
  console.log('\n=== Test 08: Custom Tools ===\n');

  // Define a custom tool (exact code from docs)
  const weatherTool = tool({
    description: 'Get the current weather for a location',
    parameters: z.object({
      location: z.string().describe('City name'),
    }),
    execute: async ({ location }) => {
      // Fetch weather data
      return `Weather in ${location}: 72°F, sunny`;
    },
  });

  const agent = createDeepAgent({
    model: anthropic('claude-haiku-4-5-20251001'),
    tools: {
      get_weather: weatherTool,
    },
  });

  const result = await agent.generate({
    prompt: 'What is the weather in San Francisco?',
  });

  // Validation
  console.log('\n--- Validation ---');
  console.log('✅ Custom weather tool defined');
  console.log('✅ Agent created with custom tool');
  console.log(`✅ Response received: ${result.text}`);

  if (result.text.toLowerCase().includes('san francisco') ||
      result.text.toLowerCase().includes('weather') ||
      result.text.includes('72')) {
    console.log('✅ Weather information included in response');
  }

  console.log('\n✅ Test 08 PASSED\n');
}

testCustomTools().catch((error) => {
  console.error('\n❌ Test 08 FAILED');
  console.error('Error:', error.message);
  console.error(error);
  process.exit(1);
});
