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

/**
 * Classify HTTP status codes into structured error categories.
 */
export function classifyHttpError(status) {
  if (status === 401) return 'AUTHENTICATION_ERROR';
  if (status === 402) return 'INSUFFICIENT_CREDITS';
  if (status === 403) return 'FORBIDDEN';
  if (status === 404) return 'MODEL_NOT_FOUND';
  if (status === 408) return 'REQUEST_TIMEOUT';
  if (status === 429) return 'RATE_LIMITED';
  if (status >= 500 && status < 600) return 'UPSTREAM_SERVER_ERROR';
  return 'HTTP_CLIENT_ERROR';
}

export class OpenRouterProvider {
  constructor({
    apiKey = globalThis.process?.env?.OPENROUTER_API_KEY || null,
    models = null,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    fetchFn = globalThis.fetch,
    appUrl = 'https://manavagarwal.me',
    appName = 'NIMO Core'
  } = {}) {
    this.apiKey = typeof apiKey === 'string' ? apiKey.trim() : null;
    this.models = models && models.length
      ? models
      : (globalThis.process?.env?.OPENROUTER_MODELS
          ? globalThis.process.env.OPENROUTER_MODELS.split(',').map(m => m.trim()).filter(Boolean)
          : DEFAULT_MODELS);
    this.timeoutMs = timeoutMs;
    this.fetch = fetchFn;
    this.appUrl = appUrl;
    this.appName = appName;
  }

  async complete({
    messages = [],
    temperature = 0.3,
    maxTokens = 800,
    requestId = null
  } = {}) {
    if (!this.apiKey) {
      console.warn(JSON.stringify({
        level: 'warn',
        event: 'provider_missing_key',
        provider: 'openrouter',
        errorType: 'MISSING_API_KEY',
        requestId
      }));
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
      console.warn(JSON.stringify({
        level: 'warn',
        event: 'provider_invalid_input',
        provider: 'openrouter',
        errorType: 'INVALID_INPUT',
        requestId
      }));
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

        console.log(JSON.stringify({
          level: 'info',
          event: 'provider_request_started',
          provider: 'openrouter',
          model,
          attempt: attempts + 1,
          maxRetries: MAX_RETRY_COUNT,
          requestId
        }));

        try {
          const response = await this.fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${this.apiKey}`,
              'HTTP-Referer': this.appUrl,
              'X-Title': this.appName,
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
            const errorType = classifyHttpError(status);
            let errorDetails = `HTTP ${status}`;
            try {
              const errBody = await response.json();
              if (errBody?.error?.message) {
                errorDetails = String(errBody.error.message);
              }
            } catch {
              // Ignore non-JSON error bodies
            }

            console.error(JSON.stringify({
              level: 'error',
              event: 'provider_http_error',
              provider: 'openrouter',
              model,
              status,
              errorType,
              errorDetails,
              attempt: attempts + 1,
              requestId
            }));

            if (isRetryableStatus(status) && attempts < MAX_RETRY_COUNT) {
              attempts++;
              await new Promise(r => setTimeout(r, 400 * attempts));
              continue;
            }
            errors.push({ model, status, errorType, message: errorDetails });
            break; // Try next model in failover chain
          }

          console.log(JSON.stringify({
            level: 'info',
            event: 'provider_http_status_ok',
            provider: 'openrouter',
            model,
            status: response.status,
            requestId
          }));

          let data;
          try {
            data = await response.json();
          } catch (parseErr) {
            console.error(JSON.stringify({
              level: 'error',
              event: 'provider_json_parse_error',
              provider: 'openrouter',
              model,
              errorType: 'INVALID_JSON_RESPONSE',
              errorMessage: parseErr.message,
              requestId
            }));
            errors.push({ model, status: response.status, errorType: 'INVALID_JSON_RESPONSE', message: parseErr.message });
            break;
          }

          if (data?.error) {
            const apiMsg = data.error.message || 'API error returned inside 200 payload';
            console.error(JSON.stringify({
              level: 'error',
              event: 'provider_api_error_in_body',
              provider: 'openrouter',
              model,
              errorType: 'API_ERROR_IN_BODY',
              errorDetails: apiMsg,
              requestId
            }));
            errors.push({ model, status: response.status, errorType: 'API_ERROR_IN_BODY', message: apiMsg });
            break;
          }

          const rawContent = data?.choices?.[0]?.message?.content;
          let content = '';
          if (typeof rawContent === 'string') {
            content = rawContent;
          } else if (Array.isArray(rawContent)) {
            content = rawContent
              .filter(part => part && (part.type === 'text' || typeof part.text === 'string'))
              .map(part => part.text || '')
              .join('\n');
          }

          if (!content || !content.trim()) {
            console.error(JSON.stringify({
              level: 'error',
              event: 'provider_empty_content',
              provider: 'openrouter',
              model,
              errorType: 'EMPTY_CHOICE_CONTENT',
              requestId
            }));
            errors.push({ model, errorType: 'EMPTY_CHOICE_CONTENT', message: 'Empty or malformed choice content' });
            break; // Try next model
          }

          const sanitizedReply = sanitizeModelOutput(content);
          const latencyMs = Date.now() - startTime;

          console.log(JSON.stringify({
            level: 'info',
            event: 'provider_completion_success',
            provider: 'openrouter',
            model: data.model || model,
            replyLength: sanitizedReply.length,
            latencyMs,
            requestId
          }));

          return {
            success: true,
            reply: sanitizedReply || content.trim(),
            model: data.model || model,
            source: 'openrouter',
            latencyMs,
            actions: []
          };
        } catch (err) {
          clearTimeout(timer);
          const isAbort = err.name === 'AbortError';
          const errorType = isAbort ? 'REQUEST_TIMEOUT' : 'NETWORK_FAILURE';

          console.error(JSON.stringify({
            level: 'error',
            event: 'provider_fetch_exception',
            provider: 'openrouter',
            model,
            errorType,
            errorMessage: err.message,
            attempt: attempts + 1,
            requestId
          }));

          errors.push({ model, errorType, message: isAbort ? 'Request timeout' : 'Network failure' });
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
    console.error(JSON.stringify({
      level: 'error',
      event: 'provider_all_models_failed',
      provider: 'openrouter',
      modelsAttempted: this.models,
      errorCount: errors.length,
      errors: errors.map(e => ({ model: e.model, status: e.status, errorType: e.errorType, message: e.message })),
      requestId
    }));

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
