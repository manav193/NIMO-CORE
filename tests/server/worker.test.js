import test from 'node:test';
import assert from 'node:assert/strict';
import worker, { handleWorkerRequest, RateLimiter } from '../../src/worker.js';

test('Cloudflare Worker test suite', async t => {
  const defaultEnv = {
    ALLOWED_ORIGINS: 'http://localhost:3000,http://localhost:8787,https://manavagarwal.me'
  };

  await t.test('GET / returns Developer Portal HTML by default', async () => {
    const req = new Request('http://localhost:8787/', {
      method: 'GET',
      headers: { 'Accept': 'text/html,application/xhtml+xml' }
    });
    const res = await worker.fetch(req, defaultEnv);
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /text\/html/);
    const html = await res.text();
    assert.match(html, /NIMO-CORE/);
    assert.match(html, /Cloudflare Worker/);
  });

  await t.test('GET / returns JSON API summary when Accept: application/json', async () => {
    const req = new Request('http://localhost:8787/', {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });
    const res = await worker.fetch(req, defaultEnv);
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /application\/json/);
    const data = await res.json();
    assert.equal(data.name, '@nimo/core');
    assert.equal(data.status, 'ok');
    assert.equal(data.version, '0.2.0');
    assert.equal(data.runtime, 'cloudflare-worker');
    assert.equal(data.endpoints.health, '/api/health');
    assert.equal(data.endpoints.chat, '/api/nimo/chat');
    assert.equal(data.endpoints.chat_alias, '/v1/chat');
  });

  await t.test('POST / returns 405 Method Not Allowed', async () => {
    const req = new Request('http://localhost:8787/', { method: 'POST' });
    const res = await worker.fetch(req, defaultEnv);
    assert.equal(res.status, 405);
    const data = await res.json();
    assert.equal(data.error, 'Method Not Allowed');
  });

  await t.test('GET /api/health returns 200 and valid JSON health payload', async () => {
    const req = new Request('http://localhost:8787/api/health', { method: 'GET' });
    const res = await worker.fetch(req, defaultEnv);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.status, 'ok');
    assert.equal(data.version, '0.2.0');
    assert.equal(data.runtime, 'cloudflare-worker');
    assert.ok(data.timestamp);
  });

  await t.test('POST /api/health returns 405 Method Not Allowed', async () => {
    const req = new Request('http://localhost:8787/api/health', { method: 'POST' });
    const res = await worker.fetch(req, defaultEnv);
    assert.equal(res.status, 405);
  });

  await t.test('POST /api/nimo/chat responds to deterministic queries', async () => {
    const req = new Request('http://localhost:8787/api/nimo/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Who are you?' })
    });
    const res = await worker.fetch(req, defaultEnv);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.model, 'identity');
    assert.match(data.reply, /NIMO/);
    assert.equal(data.source, 'core');
    assert.ok(Array.isArray(data.actions));
  });

  await t.test('POST /v1/chat is an exact alias for /api/nimo/chat', async () => {
    const req = new Request('http://localhost:8787/v1/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'What is NIMO?' })
    });
    const res = await worker.fetch(req, defaultEnv);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.model, 'identity');
  });

  await t.test('POST /api/nimo/chat handles OpenRouter AI fallback when intent is fallback', async () => {
    const mockAiProvider = {
      apiKey: 'test-key',
      complete: async ({ messages, requestId }) => ({
        success: true,
        reply: 'Remote AI response',
        model: 'google/gemini-2.5-flash',
        actions: []
      })
    };

    const req = new Request('http://localhost:8787/api/nimo/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'random unknown gibberish prompt 987654321' })
    });

    const res = await handleWorkerRequest(req, { OPENROUTER_API_KEY: 'test-key' }, {}, { aiProvider: mockAiProvider });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.source, 'openrouter');
    assert.equal(data.reply, 'Remote AI response');
    assert.equal(data.model, 'google/gemini-2.5-flash');
  });

  await t.test('POST /api/nimo/chat returns deterministic fallback reply when OPENROUTER_API_KEY is not configured', async () => {
    const req = new Request('http://localhost:8787/api/nimo/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'random unknown query 12345' })
    });
    // Call without OPENROUTER_API_KEY in env
    const res = await handleWorkerRequest(req, { ALLOWED_ORIGINS: 'http://localhost:8787' }, {}, {});
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.model, 'fallback');
    assert.equal(data.source, 'core');
    assert.match(data.reply, /information/);
  });

  await t.test('POST /api/nimo/chat gracefully falls back to deterministic reply when provider fails', async () => {
    const mockFailingAiProvider = {
      apiKey: 'test-key',
      complete: async () => ({
        success: false,
        reply: 'I could not reach the AI service',
        model: 'none',
        error: 'ALL_MODELS_FAILED'
      })
    };

    const req = new Request('http://localhost:8787/api/nimo/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'random unknown query 67890' })
    });

    const res = await handleWorkerRequest(
      req,
      { OPENROUTER_API_KEY: 'test-key', ALLOWED_ORIGINS: 'http://localhost:8787' },
      {},
      { aiProvider: mockFailingAiProvider }
    );
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.model, 'fallback');
    assert.equal(data.source, 'core');
    assert.match(data.reply, /information/);
  });

  await t.test('POST /api/nimo/chat rejects malformed JSON with 400', async () => {
    const req = new Request('http://localhost:8787/api/nimo/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not a valid json string{'
    });
    const res = await worker.fetch(req, defaultEnv);
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.equal(data.success, false);
    assert.match(data.error, /Invalid JSON/);
  });

  await t.test('POST /api/nimo/chat rejects non-object JSON with 400', async () => {
    const req = new Request('http://localhost:8787/api/nimo/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(['not', 'an', 'object'])
    });
    const res = await worker.fetch(req, defaultEnv);
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.equal(data.success, false);
    assert.match(data.error, /Request body must be an object/);
  });

  await t.test('POST /api/nimo/chat rejects missing or empty message with 400', async () => {
    const req1 = new Request('http://localhost:8787/api/nimo/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wrongField: 'hello' })
    });
    const res1 = await worker.fetch(req1, defaultEnv);
    assert.equal(res1.status, 400);
    const data1 = await res1.json();
    assert.equal(data1.success, false);
    assert.match(data1.error, /Missing or invalid "message"/);

    const req2 = new Request('http://localhost:8787/api/nimo/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: '   ' })
    });
    const res2 = await worker.fetch(req2, defaultEnv);
    assert.equal(res2.status, 400);
  });

  await t.test('POST /api/nimo/chat rejects payload larger than 64KB with 413', async () => {
    const hugeBody = JSON.stringify({ message: 'x'.repeat(70000) });
    const req = new Request('http://localhost:8787/api/nimo/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: hugeBody
    });
    const res = await worker.fetch(req, defaultEnv);
    assert.equal(res.status, 413);
    const data = await res.json();
    assert.equal(data.success, false);
    assert.equal(data.error, 'Payload Too Large');
  });

  await t.test('POST /api/nimo/chat rejects oversized Content-Length header with 413', async () => {
    const req = new Request('http://localhost:8787/api/nimo/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': '70000'
      },
      body: JSON.stringify({ message: 'small' })
    });
    const res = await worker.fetch(req, defaultEnv);
    assert.equal(res.status, 413);
  });

  await t.test('GET /api/nimo/chat returns 405 Method Not Allowed', async () => {
    const req = new Request('http://localhost:8787/api/nimo/chat', { method: 'GET' });
    const res = await worker.fetch(req, defaultEnv);
    assert.equal(res.status, 405);
  });

  await t.test('GET /unknown-route returns 404 Not Found', async () => {
    const req = new Request('http://localhost:8787/unknown-route', { method: 'GET' });
    const res = await worker.fetch(req, defaultEnv);
    assert.equal(res.status, 404);
    const data = await res.json();
    assert.equal(data.error, 'Not Found');
  });

  await t.test('OPTIONS preflight returns 204 for allowed origin and 403 for untrusted', async () => {
    const allowed = await worker.fetch(new Request('http://localhost:8787/api/nimo/chat', {
      method: 'OPTIONS',
      headers: {
        'Origin': 'http://localhost:3000',
        'Access-Control-Request-Method': 'POST'
      }
    }), defaultEnv);
    assert.equal(allowed.status, 204);
    assert.equal(allowed.headers.get('access-control-allow-origin'), 'http://localhost:3000');
    assert.equal(allowed.headers.get('access-control-allow-methods'), 'GET, POST, OPTIONS');

    const blocked = await worker.fetch(new Request('http://localhost:8787/api/nimo/chat', {
      method: 'OPTIONS',
      headers: {
        'Origin': 'http://untrusted-site.com',
        'Access-Control-Request-Method': 'POST'
      }
    }), defaultEnv);
    assert.equal(blocked.status, 403);
    const blockedData = await blocked.json();
    assert.equal(blockedData.error, 'Origin not allowed');
  });

  await t.test('Security headers and Request-ID propagation', async () => {
    const customId = 'custom-request-id-12345';
    const req = new Request('http://localhost:8787/api/health', {
      method: 'GET',
      headers: { 'X-Request-ID': customId }
    });
    const res = await worker.fetch(req, defaultEnv);
    assert.equal(res.headers.get('x-request-id'), customId);
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(res.headers.get('x-frame-options'), 'DENY');
    assert.equal(res.headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
  });

  await t.test('Rate limiting with mock Cloudflare RATE_LIMITER binding', async () => {
    const mockRateLimiter = {
      limit: async ({ key }) => ({ success: false })
    };
    const req = new Request('http://localhost:8787/api/health', {
      method: 'GET',
      headers: { 'cf-connecting-ip': '203.0.113.195' }
    });
    const res = await worker.fetch(req, { RATE_LIMITER: mockRateLimiter });
    assert.equal(res.status, 429);
    assert.equal(res.headers.get('retry-after'), '60');
    const data = await res.json();
    assert.equal(data.success, false);
    assert.equal(data.error, 'Too Many Requests');
  });

  await t.test('Rate limiting with isolate fallback limiter', async () => {
    const tightLimiter = new RateLimiter(2, 60000);
    const env = { ALLOWED_ORIGINS: 'http://localhost:8787' };

    const req1 = new Request('http://localhost:8787/api/health', {
      method: 'GET',
      headers: { 'cf-connecting-ip': '198.51.100.1' }
    });
    const res1 = await handleWorkerRequest(req1, env, {}, { rateLimiter: tightLimiter });
    assert.equal(res1.status, 200);

    const req2 = new Request('http://localhost:8787/api/health', {
      method: 'GET',
      headers: { 'cf-connecting-ip': '198.51.100.1' }
    });
    const res2 = await handleWorkerRequest(req2, env, {}, { rateLimiter: tightLimiter });
    assert.equal(res2.status, 200);

    const req3 = new Request('http://localhost:8787/api/health', {
      method: 'GET',
      headers: { 'cf-connecting-ip': '198.51.100.1' }
    });
    const res3 = await handleWorkerRequest(req3, env, {}, { rateLimiter: tightLimiter });
    assert.equal(res3.status, 429);
    const data3 = await res3.json();
    assert.equal(data3.success, false);
    assert.equal(data3.error, 'Too Many Requests');
    assert.ok(res3.headers.get('retry-after'));
  });
});
