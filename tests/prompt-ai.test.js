import test from 'node:test';
import assert from 'node:assert/strict';
import { PromptAIClient, createPromptAINimoBridge } from '../src/index.js';

test('PromptAIClient compiles a valid execution plan', async () => {
  const client = new PromptAIClient({
    baseUrl: 'https://prompt-ai.test',
    integrationKey: 'test-key',
    fetchFn: async (url, init) => {
      assert.equal(url, 'https://prompt-ai.test/api/integrations/nimo/prompt');
      assert.equal(init.headers['X-NIMO-Integration-Key'], 'test-key');
      const body = JSON.parse(init.body);
      assert.equal(body.execution_target, 'browser');
      assert.equal(body.message, 'Open GitHub and search for NIMO-CORE');
      return new Response(JSON.stringify({
        success: true,
        bridge_version: '1.0.0',
        goal: 'Search GitHub for NIMO-CORE',
        steps: [{ action: 'open', target: 'https://github.com', input: null, condition: null }, { action: 'search', target: null, input: 'NIMO-CORE', condition: null }],
        success_criteria: ['NIMO-CORE results are visible'],
        safety_notes: []
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
  });

  const result = await client.compile({ message: 'Open GitHub and search for NIMO-CORE' });
  assert.equal(result.success, true);
  assert.equal(result.steps.length, 2);
  assert.equal(result.source, 'prompt-ai');
});

test('PromptAIClient fails closed when not configured', async () => {
  const client = new PromptAIClient({ baseUrl: 'https://prompt-ai.test' });
  const result = await client.compile({ message: 'Open GitHub' });
  assert.equal(result.success, false);
  assert.equal(result.error, 'PROMPT_AI_NOT_CONFIGURED');
});

test('NIMO bridge delegates to PromptAI client', async () => {
  const calls = [];
  const bridge = createPromptAINimoBridge({
    client: { compile: async args => { calls.push(args); return { success: true, goal: 'x', steps: [] }; } }
  });
  const result = await bridge.compile('Open Chrome', { requestId: 'req-1' });
  assert.equal(result.success, true);
  assert.equal(calls[0].message, 'Open Chrome');
  assert.equal(calls[0].requestId, 'req-1');
});
