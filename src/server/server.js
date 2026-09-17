import http from 'node:http';
import { createNimoEngine } from '../core/nimo-engine.js';
import { createOpenRouterProvider } from '../services/openrouter.js';
import { ARCADE_OS_PROJECTS_SOURCE } from '../knowledge/sources/arcade-os-projects.js';
import { PROMPT_AII_SOURCE } from '../knowledge/sources/prompt-aii.js';
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

const DASHBOARD_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>NIMO-CORE • Local Server</title>
  <style>
    :root {
      --bg: #090d16;
      --card: #131a2a;
      --border: #1e293b;
      --text: #f1f5f9;
      --muted: #94a3b8;
      --accent: #38bdf8;
      --accent-hover: #0ea5e9;
      --green: #22c55e;
      --code-bg: #0b1120;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    body { background: var(--bg); color: var(--text); padding: 2rem 1rem; line-height: 1.5; min-height: 100vh; display: flex; justify-content: center; }
    .container { max-width: 800px; width: 100%; }
    header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; border-bottom: 1px solid var(--border); padding-bottom: 1rem; }
    .title { display: flex; align-items: center; gap: 0.75rem; }
    .title h1 { font-size: 1.5rem; font-weight: 700; }
    .badge { background: rgba(34, 197, 94, 0.15); color: var(--green); border: 1px solid rgba(34, 197, 94, 0.3); padding: 0.25rem 0.6rem; border-radius: 9999px; font-size: 0.8rem; font-weight: 600; display: inline-flex; align-items: center; gap: 0.4rem; }
    .badge::before { content: ""; width: 7px; height: 7px; border-radius: 50%; background: var(--green); display: inline-block; }
    .card { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 1.5rem; margin-bottom: 1.5rem; box-shadow: 0 4px 20px rgba(0,0,0,0.3); }
    .card h2 { font-size: 1.1rem; margin-bottom: 1rem; color: var(--accent); }
    .endpoints { display: grid; gap: 0.5rem; }
    .endpoint-item { display: flex; align-items: center; justify-content: space-between; background: var(--code-bg); padding: 0.6rem 1rem; border-radius: 6px; border: 1px solid var(--border); }
    .method { font-size: 0.75rem; font-weight: 700; padding: 0.2rem 0.4rem; border-radius: 4px; }
    .get { background: rgba(56, 189, 248, 0.2); color: var(--accent); }
    .post { background: rgba(34, 197, 94, 0.2); color: var(--green); }
    .endpoint-path { font-family: monospace; font-size: 0.9rem; margin-left: 0.5rem; }
    .interactive-form { display: flex; flex-direction: column; gap: 1rem; }
    .input-row { display: flex; gap: 0.5rem; }
    input[type="text"] { flex: 1; background: var(--code-bg); border: 1px solid var(--border); color: var(--text); padding: 0.75rem 1rem; border-radius: 8px; font-size: 0.95rem; outline: none; }
    input[type="text"]:focus { border-color: var(--accent); }
    button { background: var(--accent); color: #090d16; font-weight: 600; border: none; padding: 0.75rem 1.25rem; border-radius: 8px; cursor: pointer; transition: background 0.15s; }
    button:hover { background: var(--accent-hover); }
    .pills { display: flex; flex-wrap: wrap; gap: 0.5rem; }
    .pill { background: var(--code-bg); border: 1px solid var(--border); color: var(--muted); font-size: 0.8rem; padding: 0.35rem 0.75rem; border-radius: 6px; cursor: pointer; transition: all 0.15s; }
    .pill:hover { border-color: var(--accent); color: var(--text); }
    pre { background: var(--code-bg); border: 1px solid var(--border); padding: 1rem; border-radius: 8px; font-family: monospace; font-size: 0.85rem; overflow-x: auto; color: #cbd5e1; min-height: 80px; }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div class="title">
        <h1>NIMO-CORE</h1>
        <span class="badge">Running</span>
      </div>
      <div style="font-size: 0.85rem; color: var(--muted);">Node.js v0.2.0</div>
    </header>

    <div class="card">
      <h2>Live Query Console</h2>
      <div class="interactive-form">
        <div class="input-row">
          <input type="text" id="queryInput" placeholder="Ask NIMO anything..." value="Who are you?" />
          <button id="sendBtn" onclick="sendQuery()">Send Query</button>
        </div>
        <div class="pills">
          <span style="font-size: 0.8rem; color: var(--muted); align-self: center;">Quick test:</span>
          <button class="pill" onclick="setQuery('Who are you?')">Who are you?</button>
          <button class="pill" onclick="setQuery('Tell me about SHIFT-ZERO')">Tell me about SHIFT-ZERO</button>
          <button class="pill" onclick="setQuery('ToolVerse ke baare mein batao')">ToolVerse ke baare mein batao</button>
          <button class="pill" onclick="setQuery('Which tool can compress images?')">Compress images</button>
        </div>
        <pre id="outputView">Click 'Send Query' to test NIMO response...</pre>
      </div>
    </div>

    <div class="card">
      <h2>Available Endpoints</h2>
      <div class="endpoints">
        <div class="endpoint-item">
          <div><span class="method get">GET</span><span class="endpoint-path"><a href="/api/health" style="color: inherit; text-decoration: none;">/api/health</a></span></div>
          <span style="color: var(--muted); font-size: 0.8rem;">Health & uptime check</span>
        </div>
        <div class="endpoint-item">
          <div><span class="method post">POST</span><span class="endpoint-path">/api/nimo/chat</span></div>
          <span style="color: var(--muted); font-size: 0.8rem;">Core intelligence & AI fallback</span>
        </div>
        <div class="endpoint-item">
          <div><span class="method post">POST</span><span class="endpoint-path">/v1/chat</span></div>
          <span style="color: var(--muted); font-size: 0.8rem;">Compatibility alias</span>
        </div>
      </div>
    </div>
  </div>

  <script>
    function setQuery(q) {
      document.getElementById('queryInput').value = q;
      sendQuery();
    }
    async function sendQuery() {
      const input = document.getElementById('queryInput').value.trim();
      const output = document.getElementById('outputView');
      const btn = document.getElementById('sendBtn');
      if (!input) return;
      btn.disabled = true;
      btn.innerText = 'Sending...';
      output.innerText = 'Processing query...';
      try {
        const res = await fetch('/api/nimo/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: input })
        });
        const data = await res.json();
        output.innerText = JSON.stringify(data, null, 2);
      } catch (err) {
        output.innerText = 'Error: ' + err.message;
      } finally {
        btn.disabled = false;
        btn.innerText = 'Send Query';
      }
    }
  </script>
</body>
</html>`;


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
    adapters: [
      createGenericProjectAdapter({ source: ARCADE_OS_PROJECTS_SOURCE }),
      createGenericProjectAdapter({ source: PROMPT_AII_SOURCE })
    ]
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

    // GET / (Developer Portal & Console)
    if (pathname === '/') {
      if (req.method !== 'GET') {
        res.writeHead(405, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Method Not Allowed' }));
        return;
      }
      const accept = req.headers['accept'] || '';
      if (accept.includes('application/json') && !accept.includes('text/html')) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          name: '@nimo/core',
          status: 'ok',
          version: '0.2.0',
          endpoints: {
            health: '/api/health',
            chat: '/api/nimo/chat',
            chat_alias: '/v1/chat'
          }
        }));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(DASHBOARD_HTML);
      return;
    }

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
        if (response.intent === 'fallback') {
          if (!provider?.apiKey) {
            console.warn(JSON.stringify({
              level: 'warn',
              event: 'ai_fallback_skipped',
              reason: 'OPENROUTER_API_KEY not configured',
              requestId,
              intent: response.intent
            }));
          } else {
            console.log(JSON.stringify({
              level: 'info',
              event: 'ai_fallback_started',
              requestId,
              models: provider.models
            }));

            try {
              const aiResult = await provider.complete({
                messages: [{ role: 'user', content: message }],
                requestId
              });

              if (aiResult.success) {
                console.log(JSON.stringify({
                  level: 'info',
                  event: 'ai_fallback_completed',
                  model: aiResult.model,
                  latencyMs: aiResult.latencyMs,
                  requestId
                }));

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
              } else {
                console.warn(JSON.stringify({
                  level: 'warn',
                  event: 'ai_fallback_failed',
                  error: aiResult.error,
                  requestId,
                  fallbackToDeterministic: true
                }));
              }
            } catch (providerErr) {
              console.error(JSON.stringify({
                level: 'error',
                event: 'ai_fallback_exception',
                errorType: 'UNCAUGHT_PROVIDER_EXCEPTION',
                errorMessage: providerErr.message,
                requestId,
                fallbackToDeterministic: true
              }));
            }
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
