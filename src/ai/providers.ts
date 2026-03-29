import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

function getOpenRouterKey(): string {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) {
    throw new Error(
      'Missing required environment variable: OPENROUTER_API_KEY\n' +
        'Set it in .env.local: OPENROUTER_API_KEY=<your-key>',
    );
  }
  return key;
}

function getCerebrasKey(): string {
  const key = process.env.CEREBRAS_API_KEY;
  if (!key) {
    throw new Error(
      'Missing required environment variable: CEREBRAS_API_KEY\n' +
        'Set it in .env.local: CEREBRAS_API_KEY=<your-key>',
    );
  }
  return key;
}

export function getOpenRouter() {
  return createOpenRouter({ apiKey: getOpenRouterKey() });
}

export function getCerebras() {
  return createOpenAICompatible({
    name: 'cerebras',
    baseURL: 'https://api.cerebras.ai/v1',
    apiKey: getCerebrasKey(),
  });
}

/** Main agent: classify, persona, revision */
export function mainAgentModel() {
  return getOpenRouter()('google/gemini-3-flash-preview');
}

/** Collect question generation — Cerebras for speed (~1s/question) */
export function collectModel() {
  return getCerebras()('zai-glm-4.7');
}

/** Simulation generation + comments */
export function simulationModel() {
  return getCerebras()('zai-glm-4.7');
}

/** Simulation evaluation */
export function evaluationModel() {
  return getOpenRouter()('openai/gpt-5.4-mini');
}
