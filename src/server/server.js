import http from 'node:http';
import { createNimoEngine } from '../core/nimo-engine.js';
import { createOpenRouterProvider } from '../services/openrouter.js';
import { ARCADE_OS_PROJECTS_SOURCE } from '../knowledge/sources/arcade-os-projects.js';
import { createGenericProjectAdapter } from '../adapters/generic-project-adapter.js';

const DEFAULT_PORT = 8787;
const MAX_BODY_SIZE = 64 * 1024; // 64 KB limit
const DEFAULT_RATE_LIMIT = 60; // requests per minute
const RATE_WINDOW_MS = 60 * 1000;

// Rate limiter with bounded memory and automatic pruning
class RateLimiter {
  #requests = new Map();
  #maxRequests;
  #windowMs;

  constructor(maxRequests = DEFAULT_RATE_LIMIT, windowMs = RATE_WINDOW_MS) {
    this.#maxRequests = maxRequests;
    this.#windowMs = windowMs;
  }

  isAllowed(key) {
    const now = Date.now();
    const entry = this.#requests.get(key);

    if (!entry || now - entry.startTime > this.#windowMs) {
      this.#requests.set(key, { count: 1, startTime: now });
      this.#prune(now);
      return { allowed: true, remaining: this.#maxRequests - 1, retryAfter: 0 };
    }

    if (entry.count >= this.#maxRequests) {
      const retryAfter = Math.ceil((entry.startTime + this.#windowMs - now) / 1000);
      return { allowed: false, remaining: 0, retryAfter: Math.max(1, retryAfter) };
    }

    entry.count++;
    return { allowed: true, remaining: this.#maxRequests - entry.count, retryAfter: 0 };
  }

  #prune(now) {
    if (this.#requests.size > 2000) {
      for (const [k, v] of this.#requests.entries()) {
        if (now - v.startTime > this.#windowMs) this.#requests.delete(k);
      }
    }
  }

  reset() {
    this.#requests.clear();
  }
}

/**
 * Resolve allowed origins from environment.
 */
function getAllowedOrigins() {
  const custom = process.env.ALLOWED_ORIGINS;
  if (custom) {
    return new Set(custom.split(',').map(o => o.trim()).filter(Boolean));
  }
  return new Set([
    'http://localhost:8787',
    'http://127.0.0.1:8787',
    'http://localhost:3000',
    'http://localhost:5173',
    'http://127.0.0.1:5500',
    'http://localhost:8080'
  ]);
}

export function createServer({
  engine = null,
  aiProvider = null,
  rateLimiter = null
} = {}) {
  const nimoEngine = engine || createNimoEngine({
    adapters: [createGenericProjectAdapter({ source: ARCADE_OS_PROJECTS_SOURCE })]
  });

  const provider = aiProvider || createOpenRouterProvider();
  const limiter = rateLimiter || new RateLimiter();
  const allowedOrigins = getAllowedOrigins();

  const server = http.createServer(async (req, res) => {
    const origin = req.headers['origin'];
    const isAllowedOrigin = origin && allowedOrigins.has(origin);
    const requestId = req.headers['x-request-id'] || `req-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    // Standard security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-Request-ID', requestId);

    if (isAllowedOrigin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
    }

    // Handle Preflight
    if (req.method === 'OPTIONS') {
      if (origin && !isAllowedOrigin) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Origin not allowed' }));
        return;
      }
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Request-ID');
      res.setHeader('Access-Control-Max-Age', '86400');
      res.writeHead(204);
      res.end();
      return;
    }

    // Rate Limiting
    const clientIp = req.socket?.remoteAddress || '127.0.0.1';
    const rateCheck = limiter.isAllowed(clientIp);
    if (!rateCheck.allowed) {
      res.writeHead(429, {
        'Content-Type': 'application/json',
        'Retry-After': String(rateCheck.retryAfter)
      });
      res.end(JSON.stringify({
        success: false,
        error: 'Too Many Requests',
        retryAfter: rateCheck.retryAfter
      }));
      return;
    }

    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = url.pathname;

    // GET /api/health
    if (pathname === '/api/health') {
      if (req.method !== 'GET') {
        res.writeHead(405, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Method Not Allowed' }));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'ok',
        version: '0.2.0',
        runtime: 'node',
        uptime: Math.round(process.uptime()),
        timestamp: new Date().toISOString()
      }));
      return;
    }

    // POST /api/nimo/chat or POST /v1/chat
    if (pathname === '/api/nimo/chat' || pathname === '/v1/chat') {
      if (req.method !== 'POST') {
        res.writeHead(405, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Method Not Allowed' }));
        return;
      }

      // Read bounded body
      let body = '';
      let bytesRead = 0;
      let bodyTooLarge = false;

      req.on('data', chunk => {
        bytesRead += chunk.length;
        if (bytesRead > MAX_BODY_SIZE) {
          bodyTooLarge = true;
          req.pause();
          res.writeHead(413, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Payload Too Large' }));
          return;
        }
        body += chunk;
      });

      req.on('end', async () => {
        if (bodyTooLarge) return;

        let parsed;
        try {
          parsed = JSON.parse(body);
        } catch {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Invalid JSON payload' }));
          return;
        }

        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Request body must be an object' }));
          return;
        }

        const message = typeof parsed.message === 'string' ? parsed.message.trim() : null;
        if (message == null) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Missing or invalid "message" string' }));
          return;
        }

        const context = parsed.context && typeof parsed.context === 'object' && !Array.isArray(parsed.context)
          ? parsed.context
          : {};

        // Execute deterministic core intelligence
        const response = nimoEngine.respond(message, context);

        // If deterministic response was fallback and AI is configured, attempt remote fallback
        if (response.intent === 'fallback' && provider?.apiKey) {
          const aiResult = await provider.complete({
            messages: [{ role: 'user', content: message }],
            requestId
          });

          if (aiResult.success) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              success: true,
              reply: aiResult.reply,
              model: aiResult.model,
              source: 'openrouter',
              actions: aiResult.actions || [],
              context: response.context
            }));
            return;
          }
        }

        // Return deterministic response
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          reply: response.text,
          model: response.intent,
          source: 'core',
          actions: response.actions || [],
          recommendations: response.recommendations || [],
          context: response.context
        }));
      });
      return;
    }

    // 404 Not Found for any other path
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not Found' }));
  });

  return server;
}

export function startServer(port = process.env.PORT || DEFAULT_PORT, options = {}) {
  const server = createServer(options);
  server.listen(port, () => {
    console.log(`NIMO-CORE local server running at http://localhost:${port}`);
  });
  return server;
}

// Direct execution entry point
if (process.argv[1] && process.argv[1].endsWith('server.js')) {
  startServer();
}
