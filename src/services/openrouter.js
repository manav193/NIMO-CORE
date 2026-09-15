/**
 * Production-grade OpenRouter provider client with model failover,
 * exponential backoff retry for transient errors, strict output validation,
 * and zero secret leakage.
 */

const DEFAULT_MODELS = [
  'google/gemini-2.5-flash',
  'meta-llama/llama-3.3-70b-instruct'
];

const DEFAULT_TIMEOUT_MS = 10000;
const MAX_RETRY_COUNT = 1;

/**
 * Remove reasoning tags and potential prompt extraction leakage.
 */
export function sanitizeModelOutput(text) {
  if (typeof text !== 'string') return '';
  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/```(?:reasoning|thought)[\s\S]*?```/gi, '')
    .trim();
}

/**
 * Classify HTTP status codes for safe retry behavior.
 */
function isRetryableStatus(status) {
  return status === 408 || status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

export class OpenRouterProvider {
  constructor({
    apiKey = globalThis.process?.env?.OPENROUTER_API_KEY || null,
    models = null,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    fetchFn = globalThis.fetch
  } = {}) {
    this.apiKey = apiKey;
    this.models = models && models.length
      ? models
      : (globalThis.process?.env?.OPENROUTER_MODELS
          ? globalThis.process.env.OPENROUTER_MODELS.split(',').map(m => m.trim()).filter(Boolean)
          : DEFAULT_MODELS);
    this.timeoutMs = timeoutMs;
    this.fetch = fetchFn;
  }

  async complete({
    messages = [],
    temperature = 0.3,
    maxTokens = 800,
    requestId = null
  } = {}) {
    if (!this.apiKey) {
      return {
        success: false,
        reply: 'AI provider is not configured.',
        model: 'none',
        source: 'openrouter',
        error: 'MISSING_API_KEY',
        actions: []
      };
    }

    if (!Array.isArray(messages) || !messages.length) {
      return {
        success: false,
        reply: 'Invalid message request.',
        model: 'none',
        source: 'openrouter',
        error: 'INVALID_INPUT',
        actions: []
      };
    }

    const errors = [];

    for (const model of this.models) {
      let attempts = 0;
      while (attempts <= MAX_RETRY_COUNT) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.timeoutMs);
        const startTime = Date.now();

        try {
          const response = await this.fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${this.apiKey}`,
              'HTTP-Referer': 'https://nimo-core.local',
              'X-Title': 'NIMO Core',
              ...(requestId ? { 'X-Request-ID': requestId } : {})
            },
            body: JSON.stringify({
              model,
              messages,
              temperature,
              max_tokens: maxTokens
            }),
            signal: controller.signal
          });

          clearTimeout(timer);

          if (!response.ok) {
            const status = response.status;
            if (isRetryableStatus(status) && attempts < MAX_RETRY_COUNT) {
              attempts++;
              await new Promise(r => setTimeout(r, 400 * attempts));
              continue;
            }
            errors.push({ model, status, message: `HTTP ${status}` });
            break; // Try next model in failover chain
          }

          const data = await response.json();
          const content = data?.choices?.[0]?.message?.content;

          if (typeof content !== 'string' || !content.trim()) {
            errors.push({ model, message: 'Empty or malformed choice content' });
            break; // Try next model
          }

          const sanitizedReply = sanitizeModelOutput(content);
          const latencyMs = Date.now() - startTime;

          return {
            success: true,
            reply: sanitizedReply,
            model: data.model || model,
            source: 'openrouter',
            latencyMs,
            actions: []
          };
        } catch (err) {
          clearTimeout(timer);
          const isAbort = err.name === 'AbortError';
          errors.push({ model, message: isAbort ? 'Request timeout' : 'Network failure' });
          if (attempts < MAX_RETRY_COUNT && !isAbort) {
            attempts++;
            await new Promise(r => setTimeout(r, 300 * attempts));
            continue;
          }
          break; // Move to next model
        }
      }
    }

    // All models failed in failover chain
    return {
      success: false,
      reply: 'I could not reach the AI service at this moment. Please try again.',
      model: 'none',
      source: 'openrouter',
      error: 'ALL_MODELS_FAILED',
      actions: []
    };
  }
}

export function createOpenRouterProvider(options) {
  return new OpenRouterProvider(options);
}

export async function queryOpenRouter({ message, history = [], context = {}, env = {}, requestId = null }) {
  const apiKey = env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return { ok: false, publicError: 'Assistant service is not configured.', internalErrors: ['missing_api_key'] };
  }
  const models = env.OPENROUTER_MODELS
    ? env.OPENROUTER_MODELS.split(',').map(m => m.trim()).filter(Boolean)
    : DEFAULT_MODELS;
  const timeoutMs = Number(env.PROVIDER_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS;
  const provider = new OpenRouterProvider({ apiKey, models, timeoutMs });

  const messages = [
    ...(Array.isArray(history) ? history : []),
    { role: 'user', content: String(message || '') }
  ];

  const result = await provider.complete({ messages, requestId });
  if (result.success) {
    return { ok: true, reply: result.reply, model: result.model, latencyMs: result.latencyMs };
  }
  return { ok: false, publicError: 'NIMO is temporarily unavailable. Please try again shortly.', internalErrors: [result.error] };
}
