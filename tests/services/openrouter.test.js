import test from 'node:test';
import assert from 'node:assert/strict';
import {
  OpenRouterProvider,
  createOpenRouterProvider,
  sanitizeModelOutput
} from '../../src/services/openrouter.js';

test('sanitizeModelOutput strips reasoning and think blocks', () => {
  const raw = '<think>I should tell the user about the project</think>This is the actual answer.';
  assert.equal(sanitizeModelOutput(raw), 'This is the actual answer.');

  const codeBlockRaw = '```reasoning\nstep 1: analyze\n```Final output';
  assert.equal(sanitizeModelOutput(codeBlockRaw), 'Final output');
});

test('OpenRouter returns MISSING_API_KEY if no key provided', async () => {
  const provider = createOpenRouterProvider({ apiKey: null });
  const result = await provider.complete({ messages: [{ role: 'user', content: 'hello' }] });
  assert.equal(result.success, false);
  assert.equal(result.error, 'MISSING_API_KEY');
});

test('OpenRouter completes successfully and formats response contract', async () => {
  const mockFetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      model: 'google/gemini-2.5-flash',
      choices: [{ message: { content: 'Hello! I am NIMO AI assistant.' } }]
    })
  });

  const provider = new OpenRouterProvider({
    apiKey: 'test-key',
    fetchFn: mockFetch
  });

  const result = await provider.complete({ messages: [{ role: 'user', content: 'hi' }] });
  assert.equal(result.success, true);
  assert.equal(result.reply, 'Hello! I am NIMO AI assistant.');
  assert.equal(result.source, 'openrouter');
  assert.equal(result.model, 'google/gemini-2.5-flash');
  assert.ok(typeof result.latencyMs === 'number');
});

test('OpenRouter automatically fails over to second model when first model returns 500', async () => {
  const calledModels = [];
  const mockFetch = async (url, opts) => {
    const body = JSON.parse(opts.body);
    calledModels.push(body.model);

    if (body.model === 'model-primary') {
      return { ok: false, status: 500, json: async () => ({}) };
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({
        model: 'model-fallback',
        choices: [{ message: { content: 'Fallback response' } }]
      })
    };
  };

  const provider = new OpenRouterProvider({
    apiKey: 'test-key',
    models: ['model-primary', 'model-fallback'],
    fetchFn: mockFetch
  });

  const result = await provider.complete({ messages: [{ role: 'user', content: 'test' }] });
  assert.equal(result.success, true);
  assert.equal(result.reply, 'Fallback response');
  assert.equal(result.model, 'model-fallback');
  assert.ok(calledModels.includes('model-primary'));
  assert.ok(calledModels.includes('model-fallback'));
});

test('OpenRouter does not retry non-retryable 401 Unauthorized', async () => {
  let callCount = 0;
  const mockFetch = async () => {
    callCount++;
    return { ok: false, status: 401, json: async () => ({}) };
  };

  const provider = new OpenRouterProvider({
    apiKey: 'invalid-key',
    models: ['single-model'],
    fetchFn: mockFetch
  });

  const result = await provider.complete({ messages: [{ role: 'user', content: 'test' }] });
  assert.equal(result.success, false);
  assert.equal(callCount, 1); // Only called once, no retry on 401
});

test('OpenRouter handles AbortController timeout gracefully', async () => {
  const mockFetch = async (url, opts) => {
    return new Promise((resolve, reject) => {
      opts.signal.addEventListener('abort', () => {
        const error = new Error('The operation was aborted');
        error.name = 'AbortError';
        reject(error);
      });
    });
  };

  const provider = new OpenRouterProvider({
    apiKey: 'test-key',
    models: ['test-model'],
    timeoutMs: 50,
    fetchFn: mockFetch
  });

  const result = await provider.complete({ messages: [{ role: 'user', content: 'test' }] });
  assert.equal(result.success, false);
  assert.equal(result.error, 'ALL_MODELS_FAILED');
});

test('classifyHttpError categorizes HTTP status codes correctly', async () => {
  const { classifyHttpError } = await import('../../src/services/openrouter.js');
  assert.equal(classifyHttpError(401), 'AUTHENTICATION_ERROR');
  assert.equal(classifyHttpError(402), 'INSUFFICIENT_CREDITS');
  assert.equal(classifyHttpError(403), 'FORBIDDEN');
  assert.equal(classifyHttpError(404), 'MODEL_NOT_FOUND');
  assert.equal(classifyHttpError(408), 'REQUEST_TIMEOUT');
  assert.equal(classifyHttpError(429), 'RATE_LIMITED');
  assert.equal(classifyHttpError(500), 'UPSTREAM_SERVER_ERROR');
  assert.equal(classifyHttpError(503), 'UPSTREAM_SERVER_ERROR');
  assert.equal(classifyHttpError(400), 'HTTP_CLIENT_ERROR');
});

test('OpenRouter trims whitespace and newlines from API key', () => {
  const provider = new OpenRouterProvider({ apiKey: '  sk-or-test-key\n\r ' });
  assert.equal(provider.apiKey, 'sk-or-test-key');
});

test('OpenRouter correctly parses array-structured choices content', async () => {
  const mockFetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      model: 'google/gemini-2.5-flash',
      choices: [{
        message: {
          content: [
            { type: 'text', text: 'First line.' },
            { type: 'text', text: 'Second line.' }
          ]
        }
      }]
    })
  });

  const provider = new OpenRouterProvider({
    apiKey: 'test-key',
    fetchFn: mockFetch
  });

  const result = await provider.complete({ messages: [{ role: 'user', content: 'hi' }] });
  assert.equal(result.success, true);
  assert.match(result.reply, /First line\.\nSecond line\./);
});

test('OpenRouter detects and fails on API error object inside 200 response', async () => {
  const mockFetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      error: { message: 'Provider rate limit exceeded' }
    })
  });

  const provider = new OpenRouterProvider({
    apiKey: 'test-key',
    models: ['test-model'],
    fetchFn: mockFetch
  });

  const result = await provider.complete({ messages: [{ role: 'user', content: 'hi' }] });
  assert.equal(result.success, false);
  assert.equal(result.error, 'ALL_MODELS_FAILED');
});
