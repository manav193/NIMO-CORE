import http from 'node:http';
import { startServer } from './server.js';
import { handleReversePrompt } from './reverse-prompt-handler.js';

const PORT = Number(process.env.PORT || 8787);
const INTERNAL_PORT = PORT + 1;
const limiter = new Map();
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 12;

function allowedOrigin(origin) {
  if (!origin) return null;
  const configured = (process.env.ALLOWED_ORIGINS || '').split(',').map(v => v.trim()).filter(Boolean);
  if (configured.length) return configured.includes(origin) ? origin : null;
  return origin === 'http://localhost:3000' || origin === 'http://localhost:5173' ? origin : null;
}

function isAllowed(ip) {
  const now = Date.now();
  const entry = limiter.get(ip);
  if (!entry || now - entry.start > WINDOW_MS) {
    limiter.set(ip, { start: now, count: 1 });
    return true;
  }
  if (entry.count >= MAX_REQUESTS) return false;
  entry.count += 1;
  return true;
}

function proxy(req, res) {
  const upstream = http.request({
    hostname: '127.0.0.1',
    port: INTERNAL_PORT,
    path: req.url,
    method: req.method,
    headers: { ...req.headers, host: `127.0.0.1:${INTERNAL_PORT}` }
  }, upstreamRes => {
    res.writeHead(upstreamRes.statusCode || 502, upstreamRes.headers);
    upstreamRes.pipe(res);
  });
  upstream.on('error', () => {
    if (!res.headersSent) res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'UPSTREAM_SERVER_UNAVAILABLE' }));
  });
  req.pipe(upstream);
}

export function startGateway(port = PORT) {
  startServer(INTERNAL_PORT);
  const gateway = http.createServer(async (req, res) => {
    const origin = req.headers.origin;
    const corsOrigin = allowedOrigin(origin);
    if (corsOrigin) {
      res.setHeader('Access-Control-Allow-Origin', corsOrigin);
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Request-ID, X-Client');
      res.setHeader('Vary', 'Origin');
    }
    if (req.method === 'OPTIONS') {
      res.writeHead(origin && !corsOrigin ? 403 : 204);
      res.end();
      return;
    }

    if (req.url === '/api/nimo/reverse-prompt') {
      if (!isAllowed(req.socket?.remoteAddress || 'unknown')) {
        res.writeHead(429, { 'Content-Type': 'application/json', 'Retry-After': '60' });
        res.end(JSON.stringify({ success: false, error: 'RATE_LIMITED' }));
        return;
      }
      await handleReversePrompt(req, res, { requestId: req.headers['x-request-id'] || null });
      return;
    }

    proxy(req, res);
  });
  gateway.listen(port, () => console.log(`NIMO-CORE gateway running at http://localhost:${port}`));
  return gateway;
}

if (import.meta.url === `file://${process.argv[1]}`) startGateway();
