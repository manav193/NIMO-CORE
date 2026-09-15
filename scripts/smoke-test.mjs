import assert from 'node:assert/strict';
import { createServer } from '../src/server/server.js';

const TEST_PORT = 8788; // Use non-conflicting port for smoke test
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

console.log('Starting NIMO-CORE local smoke test on port', TEST_PORT);

const server = createServer();

await new Promise(resolve => server.listen(TEST_PORT, '127.0.0.1', resolve));

try {
  // 1. Health check
  console.log('1. Verifying /api/health endpoint...');
  const healthRes = await fetch(`${BASE_URL}/api/health`);
  assert.equal(healthRes.status, 200);
  const healthData = await healthRes.json();
  assert.equal(healthData.status, 'ok');
  assert.equal(healthData.version, '0.2.0');
  console.log('   Pass: Health returned ok');

  // 2. Deterministic chat query
  console.log('2. Verifying /api/nimo/chat deterministic response...');
  const chatRes = await fetch(`${BASE_URL}/api/nimo/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'Who are you?' })
  });
  assert.equal(chatRes.status, 200);
  const chatData = await chatRes.json();
  assert.equal(chatData.success, true);
  assert.equal(chatData.model, 'identity');
  assert.match(chatData.reply, /NIMO/);
  console.log('   Pass: Deterministic chat replied correctly');

  // 3. API alias /v1/chat
  console.log('3. Verifying /v1/chat endpoint compatibility...');
  const v1Res = await fetch(`${BASE_URL}/v1/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'What is NIMO?' })
  });
  assert.equal(v1Res.status, 200);
  const v1Data = await v1Res.json();
  assert.equal(v1Data.success, true);
  console.log('   Pass: /v1/chat compatibility confirmed');

  // 4. Invalid JSON payload
  console.log('4. Verifying invalid JSON handling...');
  const badJsonRes = await fetch(`${BASE_URL}/api/nimo/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: 'this is not valid json'
  });
  assert.equal(badJsonRes.status, 400);
  const badJsonData = await badJsonRes.json();
  assert.equal(badJsonData.success, false);
  console.log('   Pass: 400 returned on malformed JSON');

  // 5. Missing message field
  console.log('5. Verifying missing message handling...');
  const missingMsgRes = await fetch(`${BASE_URL}/api/nimo/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ context: {} })
  });
  assert.equal(missingMsgRes.status, 400);
  console.log('   Pass: 400 returned on missing message');

  // 6. CORS preflight
  console.log('6. Verifying CORS OPTIONS preflight...');
  const corsAllowedRes = await fetch(`${BASE_URL}/api/nimo/chat`, {
    method: 'OPTIONS',
    headers: {
      'Origin': 'http://localhost:3000',
      'Access-Control-Request-Method': 'POST'
    }
  });
  assert.equal(corsAllowedRes.status, 204);
  assert.equal(corsAllowedRes.headers.get('access-control-allow-origin'), 'http://localhost:3000');

  const corsBlockedRes = await fetch(`${BASE_URL}/api/nimo/chat`, {
    method: 'OPTIONS',
    headers: {
      'Origin': 'http://malicious-site.example',
      'Access-Control-Request-Method': 'POST'
    }
  });
  assert.equal(corsBlockedRes.status, 403);
  console.log('   Pass: CORS allowed valid origin and rejected untrusted origin');

  // 7. Unknown route 404
  console.log('7. Verifying 404 handling...');
  const notFoundRes = await fetch(`${BASE_URL}/api/unknown-route`);
  assert.equal(notFoundRes.status, 404);
  console.log('   Pass: 404 returned for unknown routes');

  console.log('\nAll smoke test assertions passed successfully!');
} finally {
  await new Promise(resolve => server.close(resolve));
  console.log('Server shut down cleanly.');
}
