/**
 * Node.js Express API Example for Deep Agent SDK
 * 
 * This example shows how to integrate Deep Agent SDK with Express.js.
 * 
 * Setup:
 * 1. npm install deepagentsdk @ai-sdk/anthropic dotenv express
 * 2. npm install --save-dev tsx @types/node @types/express
 * 3. Create a .env file with: ANTHROPIC_API_KEY=your-key
 * 4. Run: npx tsx examples/nodejs-express-api.ts
 * 5. Test: curl -X POST http://localhost:3000/api/agent -H "Content-Type: application/json" -d '{"prompt":"Hello!"}'
 */

import 'dotenv/config';
import express from 'express';
import { createDeepAgent } from '../src/index.js';
import { anthropic } from '@ai-sdk/anthropic';

const app = express();
app.use(express.json());

// Create a singleton agent instance
const agent = createDeepAgent({
  model: anthropic('claude-sonnet-4-5-20250929'),
  systemPrompt: 'You are a helpful API assistant.',
});

// Basic agent endpoint
app.post('/api/agent', async (req, res) => {
  try {
    const { prompt } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    console.log(`📝 Received request: ${prompt.substring(0, 50)}...`);

    const result = await agent.generate({
      prompt,
      maxSteps: 10,
    });

    res.json({
      response: result.text,
      todos: result.state.todos,
      files: Object.keys(result.state.files),
      usage: result.usage,
    });

  } catch (error: any) {
    console.error('❌ Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Streaming endpoint
app.post('/api/agent/stream', async (req, res) => {
  try {
    const { prompt } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    // Set headers for Server-Sent Events
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    console.log(`📡 Streaming request: ${prompt.substring(0, 50)}...`);

    // Stream events to client
    for await (const event of agent.streamWithEvents({ prompt })) {
      // Send event as Server-Sent Event
      res.write(`data: ${JSON.stringify(event)}\n\n`);
      
      if (event.type === 'done') {
        res.end();
        break;
      }
    }

  } catch (error: any) {
    console.error('❌ Error:', error);
    res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
    res.end();
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    runtime: 'nodejs',
    version: process.version,
  });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`
🚀 Deep Agent API Server Started!

Runtime: Node.js ${process.version}
Port: ${PORT}

Endpoints:
  POST /api/agent - Generate agent response
  POST /api/agent/stream - Stream agent response
  GET  /health - Health check

Test it:
  curl -X POST http://localhost:${PORT}/api/agent \\
    -H "Content-Type: application/json" \\
    -d '{"prompt": "Hello, create a plan!"}'

Stop with: Ctrl+C
  `);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down gracefully...');
  process.exit(0);
});
