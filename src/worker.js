import { createNimoEngine } from './core/nimo-engine.js';
import { createOpenRouterProvider, VERIFIED_FREE_CHAT_MODELS } from './services/openrouter.js';
import { ARCADE_OS_PROJECTS_SOURCE } from './knowledge/sources/arcade-os-projects.js';
import { PROMPT_AII_SOURCE } from './knowledge/sources/prompt-aii.js';
import { createGenericProjectAdapter } from './adapters/generic-project-adapter.js';
import { EVENT_TYPES, createLearningEvent, extractSafeInputMetadata } from './learning/events.js';
import { OUTCOMES } from './learning/outcomes.js';

const MAX_BODY_SIZE = 64 * 1024; // 64 KB limit
const DEFAULT_RATE_LIMIT = 60; // requests per minute
const RATE_WINDOW_MS = 60 * 1000;

/**
 * In-memory fallback rate limiter for isolate-level throttling.
 */
export class RateLimiter {
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

const DEFAULT_LIMITER = new RateLimiter();

const DASHBOARD_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>NIMO-CORE • Cloudflare Worker</title>
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
        <span class="badge">Cloudflare Worker</span>
      </div>
      <div style="font-size: 0.85rem; color: var(--muted);">Edge Runtime v0.2.0</div>
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
function getAllowedOrigins(env = {}) {
  const custom = env.ALLOWED_ORIGINS || (globalThis.process?.env?.ALLOWED_ORIGINS);
  if (custom) {
    return new Set(custom.split(',').map(o => o.trim()).filter(Boolean));
  }
  return new Set([
    'https://manavagarwal.me',
    'https://www.manavagarwal.me',
    'https://prompt-aii.vercel.app',
    'http://localhost:8787',
    'http://127.0.0.1:8787',
    'http://localhost:3000',
    'http://localhost:5173',
    'http://localhost:8080',
    'http://localhost:5500',
    'http://127.0.0.1:5500',
    'http://localhost:4173'
  ]);
}

/**
 * Helper to build JSON responses with security and CORS headers.
 */
function jsonResponse(data, status = 200, corsHeaders = {}, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
      ...extraHeaders
    }
  });
}

/**
 * Main request handler for Cloudflare Workers.
 */
export async function handleWorkerRequest(request, env = {}, ctx = {}, options = {}) {
  const origin = request.headers.get('origin');
  const allowedOrigins = getAllowedOrigins(env);
  const isAllowedOrigin = origin && allowedOrigins.has(origin);
  const requestId = request.headers.get('x-request-id') ||
    `req-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;

  // Standard security headers
  const securityHeaders = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Request-ID': requestId
  };

  const corsHeaders = {
    ...securityHeaders,
    ...(isAllowedOrigin ? { 'Access-Control-Allow-Origin': origin, 'Vary': 'Origin' } : {})
  };

  // Handle Preflight
  if (request.method === 'OPTIONS') {
    if (origin && !isAllowedOrigin) {
      return jsonResponse({ error: 'Origin not allowed' }, 403, securityHeaders);
    }
    return new Response(null, {
      status: 204,
      headers: {
        ...corsHeaders,
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Request-ID',
        'Access-Control-Max-Age': '86400'
      }
    });
  }

  // Rate Limiting
  const clientIp = request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    '127.0.0.1';

  if (env.RATE_LIMITER && typeof env.RATE_LIMITER.limit === 'function') {
    const cfRate = await env.RATE_LIMITER.limit({ key: clientIp });
    if (!cfRate.success) {
      return jsonResponse({
        success: false,
        error: 'Too Many Requests',
        retryAfter: 60
      }, 429, corsHeaders, { 'Retry-After': '60' });
    }
  } else {
    const limiter = options.rateLimiter || DEFAULT_LIMITER;
    const rateCheck = limiter.isAllowed(clientIp);
    if (!rateCheck.allowed) {
      return jsonResponse({
        success: false,
        error: 'Too Many Requests',
        retryAfter: rateCheck.retryAfter
      }, 429, corsHeaders, { 'Retry-After': String(rateCheck.retryAfter) });
    }
  }

  const url = new URL(request.url);
  const pathname = url.pathname;

  // GET / (Developer Portal & API summary)
  if (pathname === '/') {
    if (request.method !== 'GET') {
      return jsonResponse({ error: 'Method Not Allowed' }, 405, corsHeaders);
    }
    const accept = request.headers.get('accept') || '';
    if (accept.includes('application/json') && !accept.includes('text/html')) {
      return jsonResponse({
        name: '@nimo/core',
        status: 'ok',
        version: '0.2.0',
        runtime: 'cloudflare-worker',
        endpoints: {
          health: '/api/health',
          chat: '/api/nimo/chat',
          chat_alias: '/v1/chat'
        }
      }, 200, corsHeaders);
    }
    return new Response(DASHBOARD_HTML, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        ...corsHeaders
      }
    });
  }

  // GET /api/health
  if (pathname === '/api/health') {
    if (request.method !== 'GET') {
      return jsonResponse({ error: 'Method Not Allowed' }, 405, corsHeaders);
    }
    return jsonResponse({
      status: 'ok',
      version: '0.2.0',
      runtime: 'cloudflare-worker',
      timestamp: new Date().toISOString()
    }, 200, corsHeaders);
  }

  // POST /api/nimo/chat or POST /v1/chat
  if (pathname === '/api/nimo/chat' || pathname === '/v1/chat') {
    if (request.method !== 'POST') {
      return jsonResponse({ error: 'Method Not Allowed' }, 405, corsHeaders);
    }

    // Check Content-Length header if present
    const contentLength = request.headers.get('content-length');
    if (contentLength && Number(contentLength) > MAX_BODY_SIZE) {
      return jsonResponse({ success: false, error: 'Payload Too Large' }, 413, corsHeaders);
    }

    let rawBody;
    try {
      rawBody = await request.text();
    } catch {
      return jsonResponse({ success: false, error: 'Failed to read request body' }, 400, corsHeaders);
    }

    if (rawBody.length > MAX_BODY_SIZE) {
      return jsonResponse({ success: false, error: 'Payload Too Large' }, 413, corsHeaders);
    }

    let parsed;
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      return jsonResponse({ success: false, error: 'Invalid JSON payload' }, 400, corsHeaders);
    }

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return jsonResponse({ success: false, error: 'Request body must be an object' }, 400, corsHeaders);
    }

    const message = typeof parsed.message === 'string' ? parsed.message.trim() : null;
    if (message == null || message === '') {
      return jsonResponse({ success: false, error: 'Missing or invalid "message" string' }, 400, corsHeaders);
    }

    const context = parsed.context && typeof parsed.context === 'object' && !Array.isArray(parsed.context)
      ? parsed.context
      : {};

    const learningStore = options.learningStore || env.learningStore || null;
    const nimoEngine = options.engine || createNimoEngine({
      adapters: [
      createGenericProjectAdapter({ source: ARCADE_OS_PROJECTS_SOURCE }),
      createGenericProjectAdapter({ source: PROMPT_AII_SOURCE })
    ],
      learningStore
    });

    const response = nimoEngine.respond(message, { ...context, requestId });

    const hasConfiguredApiKey = Boolean(
      (typeof env.OPENROUTER_API_KEY === 'string' && env.OPENROUTER_API_KEY.trim()) ||
      (typeof globalThis.process?.env?.OPENROUTER_API_KEY === 'string' && globalThis.process.env.OPENROUTER_API_KEY.trim())
    );

    console.log(JSON.stringify({
      level: 'info',
      event: 'core_route_resolved',
      requestId,
      intent: response.intent,
      hasApiKey: hasConfiguredApiKey,
      messageLength: message.length
    }));

    // If deterministic response was fallback and AI is configured, attempt remote fallback
    const apiKey = (typeof env.OPENROUTER_API_KEY === 'string' && env.OPENROUTER_API_KEY.trim()) ||
      (typeof globalThis.process?.env?.OPENROUTER_API_KEY === 'string' && globalThis.process.env.OPENROUTER_API_KEY.trim()) ||
      null;

    if (response.intent === 'fallback') {
      if (!apiKey && !options.aiProvider) {
        console.warn(JSON.stringify({
          level: 'warn',
          event: 'ai_fallback_skipped',
          reason: 'OPENROUTER_API_KEY not configured in environment',
          requestId,
          intent: response.intent
        }));
      } else {
        const models = env.OPENROUTER_MODELS
          ? env.OPENROUTER_MODELS.split(',').map(m => m.trim()).filter(Boolean)
          : undefined;
        const timeoutMs = env.PROVIDER_TIMEOUT_MS ? Number(env.PROVIDER_TIMEOUT_MS) : undefined;
        const appUrl = env.PUBLIC_APP_URL || 'https://manavagarwal.me';

        let provider = null;
        try {
          provider = options.aiProvider || createOpenRouterProvider({
            apiKey,
            models,
            allowedModels: VERIFIED_FREE_CHAT_MODELS,
            timeoutMs,
            appUrl
          });
        } catch (initErr) {
          console.error(JSON.stringify({
            level: 'error',
            event: 'ai_fallback_exception',
            errorType: 'PROVIDER_INIT_EXCEPTION',
            errorMessage: initErr.message,
            requestId,
            fallbackToDeterministic: true
          }));
        }

        if (provider?.apiKey || options.aiProvider) {
          const hasApiKey = Boolean(provider?.apiKey);
          const sanitizedKeyLength = provider?.apiKey ? provider.apiKey.length : 0;

          console.log(JSON.stringify({
            level: 'info',
            event: 'ai_fallback_started',
            requestId,
            models: provider.models || models || 'default',
            hasApiKey,
            sanitizedKeyLength
          }));

          try {
            const aiResult = await provider.complete({
              messages: [{ role: 'user', content: message }],
              requestId
            });

            if (aiResult?.success) {
              console.log(JSON.stringify({
                level: 'info',
                event: 'ai_fallback_completed',
                model: aiResult.model,
                latencyMs: aiResult.latencyMs,
                requestId
              }));

              if (learningStore && typeof learningStore.record === 'function') {
                Promise.resolve(learningStore.record(createLearningEvent({
                  requestId,
                  eventType: EVENT_TYPES.AI_SUCCESS,
                  source: 'openrouter',
                  intent: 'ai_fallback',
                  inputMetadata: extractSafeInputMetadata(message),
                  responseMetadata: { length: aiResult.reply?.length || 0, model: aiResult.model },
                  modelMetadata: { model: aiResult.model, provider: 'openrouter', latencyMs: aiResult.latencyMs },
                  outcome: OUTCOMES.UNKNOWN,
                  latency: aiResult.latencyMs
                }))).catch(() => {});
              }

              return jsonResponse({
                success: true,
                reply: aiResult.reply,
                model: aiResult.model,
                source: 'openrouter',
                actions: aiResult.actions || [],
                context: response.context
              }, 200, corsHeaders);
            } else {
              console.warn(JSON.stringify({
                level: 'warn',
                event: 'ai_fallback_failed',
                error: aiResult?.error || 'UNKNOWN_PROVIDER_ERROR',
                requestId,
                fallbackToDeterministic: true
              }));

              if (learningStore && typeof learningStore.record === 'function') {
                Promise.resolve(learningStore.record(createLearningEvent({
                  requestId,
                  eventType: EVENT_TYPES.AI_FAILURE,
                  source: 'openrouter',
                  intent: 'ai_fallback',
                  inputMetadata: extractSafeInputMetadata(message),
                  outcome: OUTCOMES.FAILURE,
                  errorCode: aiResult?.error || 'UNKNOWN_PROVIDER_ERROR'
                }))).catch(() => {});
              }
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

            if (learningStore && typeof learningStore.record === 'function') {
              Promise.resolve(learningStore.record(createLearningEvent({
                requestId,
                eventType: EVENT_TYPES.AI_FAILURE,
                source: 'openrouter',
                intent: 'ai_fallback',
                inputMetadata: extractSafeInputMetadata(message),
                outcome: OUTCOMES.FAILURE,
                errorCode: 'UNCAUGHT_PROVIDER_EXCEPTION'
              }))).catch(() => {});
            }
          }
        } else if (provider) {
          console.warn(JSON.stringify({
            level: 'warn',
            event: 'ai_fallback_skipped',
            reason: 'OPENROUTER_API_KEY is empty or invalid after sanitization',
            hasApiKey: false,
            sanitizedKeyLength: 0,
            requestId
          }));
        }
      }
    }

    // Return deterministic core response
    return jsonResponse({
      success: true,
      reply: response.text,
      model: response.intent,
      source: 'core',
      actions: response.actions || [],
      recommendations: response.recommendations || [],
      context: response.context
    }, 200, corsHeaders);
  }

  // 404 Not Found for any other path
  return jsonResponse({ error: 'Not Found' }, 404, corsHeaders);
}

export default {
  async fetch(request, env = {}, ctx = {}) {
    return handleWorkerRequest(request, env, ctx);
  }
};
