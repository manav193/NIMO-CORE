import { validateChatPayload } from '../lib/validation.js';
import { queryOpenRouter } from '../services/openrouter.js';
import { resolveDeterministicReply } from '../services/deterministic.js';

const fallbackRateMap = new Map();
const CACHE_TTL_SECONDS = 300;
const CACHE_NAMESPACE = 'v2';

function json(data, status, headers, requestId, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Request-Id': requestId,
      ...headers,
      ...extraHeaders
    }
  });
}

function logEvent(event, details = {}) {
  console.log(JSON.stringify({ event, ...details }));
}

async function isRateLimited(request, env) {
  if (env.RATE_LIMITER?.limit) {
    const ip = request.headers.get('cf-connecting-ip') || 'unknown';
    const outcome = await env.RATE_LIMITER.limit({ key: ip });
    return !outcome.success;
  }

  const ip = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || 'unknown';
  const now = Date.now();
  const recent = (fallbackRateMap.get(ip) || []).filter(timestamp => now - timestamp < 60_000);
  if (recent.length >= 10) return true;
  recent.push(now);
  fallbackRateMap.set(ip, recent);
  if (fallbackRateMap.size > 2000) fallbackRateMap.clear();
  return false;
}

function getCache() {
  return globalThis.caches?.default || null;
}

async function createCacheKey(message, context) {
  const normalized = JSON.stringify({
    namespace: CACHE_NAMESPACE,
    message: String(message).trim().toLowerCase(),
    projectId: context.projectId || 'portfolio',
    pageId: context.pageId || 'home',
    language: context.language || 'en'
  });
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(normalized));
  const hash = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
  return new Request(`https://nimo-cache.internal/${CACHE_NAMESPACE}/${hash}`, { method: 'GET' });
}

async function readCachedReply(message, context) {
  const cache = getCache();
  if (!cache) return null;
  const key = await createCacheKey(message, context);
  const response = await cache.match(key);
  if (!response) return null;
  const data = await response.json().catch(() => null);
  return data?.reply ? data : null;
}

async function writeCachedReply(message, context, data) {
  const cache = getCache();
  if (!cache) return;
  const key = await createCacheKey(message, context);
  const response = new Response(JSON.stringify(data), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': `public, max-age=${CACHE_TTL_SECONDS}`
    }
  });
  await cache.put(key, response);
}

export async function handleChat(request, env, corsHeaders, requestId) {
  const startedAt = Date.now();

  if (await isRateLimited(request, env)) {
    logEvent('chat_rate_limited', { requestId });
    return json({ success: false, reply: null, error: 'Too many requests. Please retry shortly.' }, 429, corsHeaders, requestId);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ success: false, reply: null, error: 'Invalid JSON payload.' }, 400, corsHeaders, requestId);
  }

  const validation = validateChatPayload(body);
  if (!validation.ok) {
    logEvent('chat_validation_failure', { requestId, status: validation.status });
    return json({ success: false, reply: null, error: validation.error }, validation.status, corsHeaders, requestId);
  }

  const { message, history, context } = validation.value;
  const deterministic = resolveDeterministicReply(message, history);
  if (deterministic) {
    logEvent('chat_success', {
      requestId,
      source: deterministic.source,
      latencyMs: Date.now() - startedAt
    });
    return json({
      success: true,
      reply: deterministic.reply,
      model: null,
      source: deterministic.source,
      actions: []
    }, 200, corsHeaders, requestId, { 'X-NIMO-Source': deterministic.source });
  }

  const canCache = history.length === 0;
  if (canCache) {
    const cached = await readCachedReply(message, context);
    if (cached) {
      logEvent('chat_success', {
        requestId,
        source: 'cache',
        latencyMs: Date.now() - startedAt
      });
      return json({ ...cached, source: 'cache' }, 200, corsHeaders, requestId, { 'X-NIMO-Source': 'cache' });
    }
  }

  const result = await queryOpenRouter({ ...validation.value, env, requestId });
  if (!result.ok) {
    console.error(JSON.stringify({ event: 'chat_failure', requestId, details: result.internalErrors || [], latencyMs: Date.now() - startedAt }));
    return json({ success: false, reply: null, error: result.publicError }, 503, corsHeaders, requestId);
  }

  const responseData = {
    success: true,
    reply: result.reply,
    model: result.model,
    source: 'openrouter',
    actions: [{ type: 'navigate', label: 'View Projects', projectId: 'portfolio', route: 'index.html#work' }]
  };

  if (canCache) {
    await writeCachedReply(message, context, responseData).catch(error => {
      console.warn(JSON.stringify({ event: 'cache_write_failure', requestId, detail: error?.message || 'unknown' }));
    });
  }

  logEvent('chat_success', {
    requestId,
    source: 'openrouter',
    model: result.model,
    latencyMs: Date.now() - startedAt
  });

  return json(responseData, 200, corsHeaders, requestId, { 'X-NIMO-Source': 'openrouter' });
}
