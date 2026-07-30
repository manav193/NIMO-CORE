import { handleChat } from './routes/chat.js';

const DEFAULT_ORIGINS = [
  'https://manavagarwal.me',
  'https://www.manavagarwal.me',
  'http://localhost:8080',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'http://localhost:4173'
];

function getCors(request, env) {
  const allowed = String(env.ALLOWED_ORIGINS || '')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean);
  const origins = allowed.length ? allowed : DEFAULT_ORIGINS;
  const origin = request.headers.get('Origin');

  if (!origin) return { allowed: true, headers: {} };
  if (!origins.includes(origin)) return { allowed: false, headers: {} };

  return {
    allowed: true,
    headers: {
      'Access-Control-Allow-Origin': origin,
      Vary: 'Origin',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400'
    }
  };
}

function json(data, status = 200, headers = {}, requestId = crypto.randomUUID()) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Request-Id': requestId,
      ...headers
    }
  });
}

export default {
  async fetch(request, env = {}) {
    const requestId = request.headers.get('X-Request-Id')?.slice(0, 80) || crypto.randomUUID();
    const cors = getCors(request, env);

    if (!cors.allowed) return json({ success: false, error: 'Origin not allowed.' }, 403, {}, requestId);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors.headers });

    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/api/health') {
      return json({
        status: 'ok',
        service: 'NIMO Core',
        version: '1.1.0',
        features: ['deterministic-facts', 'response-cache', 'chat-telemetry', 'provider-failover']
      }, 200, cors.headers, requestId);
    }

    if (request.method === 'POST' && (url.pathname === '/api/nimo/chat' || url.pathname === '/v1/chat')) {
      return handleChat(request, env, cors.headers, requestId);
    }

    return json({ success: false, error: 'Endpoint not found.' }, 404, cors.headers, requestId);
  }
};