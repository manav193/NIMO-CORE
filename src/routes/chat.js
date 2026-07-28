import { validateChatPayload } from '../lib/validation.js';
import { queryOpenRouter } from '../services/openrouter.js';

const fallbackRateMap = new Map();

function json(data, status, headers, requestId) {
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

export async function handleChat(request, env, corsHeaders, requestId) {
  if (await isRateLimited(request, env)) {
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
    return json({ success: false, reply: null, error: validation.error }, validation.status, corsHeaders, requestId);
  }

  const result = await queryOpenRouter({ ...validation.value, env, requestId });
  if (!result.ok) {
    console.error(JSON.stringify({ event: 'chat_failure', requestId, details: result.internalErrors || [] }));
    return json({ success: false, reply: null, error: result.publicError }, 503, corsHeaders, requestId);
  }

  return json({
    success: true,
    reply: result.reply,
    model: result.model,
    actions: [{ type: 'navigate', label: 'View Projects', projectId: 'portfolio', route: 'index.html#work' }]
  }, 200, corsHeaders, requestId);
}
