import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

// --- OpenRouter ---

if (!process.env.OPENROUTER_API_KEY) {
  throw new Error(
    'Missing required environment variable: OPENROUTER_API_KEY\n' +
      'Set it in .env.local: OPENROUTER_API_KEY=<your-key>'
  );
}

export const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

// --- Cerebras ---

if (!process.env.CEREBRAS_API_KEY) {
  throw new Error(
    'Missing required environment variable: CEREBRAS_API_KEY\n' +
      'Set it in .env.local: CEREBRAS_API_KEY=<your-key>'
  );
}

export const cerebras = createOpenAICompatible({
  name: 'cerebras',
  baseURL: 'https://api.cerebras.ai/v1',
  apiKey: process.env.CEREBRAS_API_KEY,
});

// --- Model references ---

/** Main agent: classify, persona, collect, revision */
export const mainAgentModel = openrouter('google/gemini-3-flash-preview');

/** Simulation generation + comments */
export const simulationModel = cerebras('zai-glm-4.7');

/** Simulation evaluation */
export const evaluationModel = openrouter('google/gemini-3.1-pro-preview');
