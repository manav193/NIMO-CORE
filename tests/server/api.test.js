import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../../src/server/server.js';

const TEST_PORT = 8789;
const BASE = `http://127.0.0.1:${TEST_PORT}`;

test('Server API suite', async t => {
  const server = createServer();
  await new Promise(resolve => server.listen(TEST_PORT, '127.0.0.1', resolve));

  t.after(async () => {
    await new Promise(resolve => server.close(resolve));
  });

  await t.test('GET /api/health returns 200 and valid JSON', async () => {
    const res = await fetch(`${BASE}/api/health`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.status, 'ok');
    assert.equal(data.version, '0.2.0');
    assert.ok(typeof data.uptime === 'number');
  });

  await t.test('POST /api/nimo/chat answers recognized query', async () => {
    const res = await fetch(`${BASE}/api/nimo/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Who are you?' })
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.model, 'identity');
    assert.match(data.reply, /NIMO/);
    assert.ok(Array.isArray(data.actions));
  });

  await t.test('POST /v1/chat is a working alias for chat', async () => {
    const res = await fetch(`${BASE}/v1/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'What is NIMO?' })
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.model, 'identity');
  });

  await t.test('POST /api/nimo/chat rejects malformed JSON with 400', async () => {
    const res = await fetch(`${BASE}/api/nimo/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json'
    });
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.equal(data.success, false);
    assert.match(data.error, /Invalid JSON/);
  });

  await t.test('POST /api/nimo/chat rejects missing message with 400', async () => {
    const res = await fetch(`${BASE}/api/nimo/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'wrong-field' })
    });
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.equal(data.success, false);
  });

  await t.test('OPTIONS preflight returns 204 for allowed origin and 403 for untrusted', async () => {
    const allowed = await fetch(`${BASE}/api/nimo/chat`, {
      method: 'OPTIONS',
      headers: {
        'Origin': 'http://localhost:3000',
        'Access-Control-Request-Method': 'POST'
      }
    });
    assert.equal(allowed.status, 204);
    assert.equal(allowed.headers.get('access-control-allow-origin'), 'http://localhost:3000');

    const blocked = await fetch(`${BASE}/api/nimo/chat`, {
      method: 'OPTIONS',
      headers: {
        'Origin': 'http://evil-tracker.example',
        'Access-Control-Request-Method': 'POST'
      }
    });
    assert.equal(blocked.status, 403);
  });

  await t.test('POST /api/nimo/chat rejects payload larger than 64KB with 413', async () => {
    const hugeBody = JSON.stringify({ message: 'x'.repeat(70000) });
    const res = await fetch(`${BASE}/api/nimo/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: hugeBody
    });
    assert.equal(res.status, 413);
  });

  await t.test('POST /api/health returns 405 Method Not Allowed', async () => {
    const res = await fetch(`${BASE}/api/health`, { method: 'POST' });
    assert.equal(res.status, 405);
  });

  await t.test('POST /api/nimo/feedback accepts sanitized Prompt-Aii feedback', async () => {
    const res = await fetch(`${BASE}/api/nimo/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        request_id: 'test-feedback-1',
        feedback: 'like',
        model: 'gpt-5.6',
        category: 'text',
        target: 'chatgpt',
        strategy: 'deep'
      })
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.recorded, true);
  });

  await t.test('POST /api/nimo/feedback rejects invalid feedback without creating a learning event', async () => {
    const res = await fetch(`${BASE}/api/nimo/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        request_id: 'test-feedback-invalid',
        feedback: 'maybe'
      })
    });
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.equal(data.success, false);
    assert.equal(data.error, 'Invalid feedback');
  });
});

test('Server rate limiting rejects requests exceeding limit with 429', async () => {
  // Create server with a tight rate limit of 2 requests
  const tightPort = 8790;
  const tightBase = `http://127.0.0.1:${tightPort}`;
  const server = createServer();
  // Override internal limiter with 2 max
  await new Promise(resolve => server.listen(tightPort, '127.0.0.1', resolve));

  try {
    // Send 70 rapid health requests to exceed default limit (60)
    let reached429 = false;
    for (let i = 0; i < 75; i++) {
      const res = await fetch(`${tightBase}/api/health`);
      if (res.status === 429) {
        reached429 = true;
        assert.ok(res.headers.get('retry-after'));
        const body = await res.json();
        assert.equal(body.success, false);
        assert.equal(body.error, 'Too Many Requests');
        break;
      }
    }
    assert.equal(reached429, true);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
