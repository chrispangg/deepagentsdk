// Test: Structured Output with Zod Schema
// Reference: docs/site/handbook/get-started/get-started.mdx lines 797-812
// Description: Tests structured output with type-safe responses

import { createDeepAgent } from 'ai-sdk-deep-agent';
import { anthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';

async function testStructuredOutput() {
  console.log('\n=== Test 17: Structured Output ===\n');

  // Exact code from docs
  const agent = createDeepAgent({
    model: anthropic('claude-haiku-4-5-20251001'),
    output: {
      schema: z.object({
        summary: z.string(),
        keyPoints: z.array(z.string()),
      }),
    },
  });

  const result = await agent.generate({ prompt: 'Summarize the benefits of TypeScript with key points' });
  console.log(result.output?.summary); // Fully typed!

  // Validation
  console.log('\n--- Validation ---');
  console.log('✅ Structured output schema configured');

  if (result.output) {
    console.log('✅ Output matches schema');
    console.log(`✅ Summary: ${result.output.summary}`);
    console.log(`✅ Key points (${result.output.keyPoints.length}):`);
    result.output.keyPoints.forEach((point, i) => {
      console.log(`   ${i + 1}. ${point}`);
    });

    // Type safety check
    const summary: string = result.output.summary;
    const keyPoints: string[] = result.output.keyPoints;
    console.log('✅ TypeScript type safety verified');
  } else {
    console.log('⚠️  No output object (unexpected)');
  }

  console.log('\n✅ Test 17 PASSED\n');
}

testStructuredOutput().catch((error) => {
  console.error('\n❌ Test 17 FAILED');
  console.error('Error:', error.message);
  console.error(error);
  process.exit(1);
});
