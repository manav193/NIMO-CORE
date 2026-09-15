import test from 'node:test';
import assert from 'node:assert/strict';
import { createBrowserClient, createNimoEngine } from '../../src/index.js';

test('createBrowserClient isolates remoteFallback network failures and falls back to local response', async () => {
  const engine = createNimoEngine();
  const client = createBrowserClient({
    engine,
    remoteFallback: async () => {
      throw new Error('Network failure: OpenRouter unreachable');
    }
  });

  const response = await client.ask('something completely unknown to trigger fallback');
  assert.equal(response.intent, 'fallback');
  assert.ok(typeof response.text === 'string');
});

test('createBrowserClient isolates remoteFallback timeout rejections', async () => {
  const engine = createNimoEngine();
  const client = createBrowserClient({
    engine,
    remoteFallback: () => Promise.reject(new Error('Timeout'))
  });

  const response = await client.ask('random query 12345');
  assert.equal(response.intent, 'fallback');
});

test('createBrowserClient handles successful remoteFallback', async () => {
  const engine = createNimoEngine();
  const client = createBrowserClient({
    engine,
    remoteFallback: async () => ({
      success: true,
      text: 'AI generated response',
      source: 'remote'
    })
  });

  const response = await client.ask('something unknown');
  assert.equal(response.source, 'remote');
  assert.equal(response.text, 'AI generated response');
});

test('createBrowserClient isolates executeAction errors without crashing', () => {
  const engine = createNimoEngine();
  const client = createBrowserClient({
    engine,
    executeAction: () => {
      throw new Error('DOM navigation failed');
    }
  });

  const result = client.execute({ type: 'navigate', target: '/test' });
  assert.equal(result.executed, false);
  assert.match(result.error, /DOM navigation failed/);
});

test('createBrowserClient returns unexecuted action when no handler provided', () => {
  const engine = createNimoEngine();
  const client = createBrowserClient({ engine });

  const result = client.execute({ type: 'navigate', target: '/test' });
  assert.equal(result.executed, false);
});
