/**
 * NIMO Core Learning Event Model
 * Lightweight, framework-free event abstraction for interaction observation,
 * outcome tracking, and privacy-preserving self-improvement telemetry.
 */

export const EVENT_TYPES = Object.freeze({
  INTERACTION_SUCCESS: 'interaction.success',
  INTERACTION_FAILURE: 'interaction.failure',
  USER_CORRECTION: 'user.correction',
  DETERMINISTIC_RESOLUTION: 'deterministic.resolution',
  AI_FALLBACK: 'ai.fallback',
  AI_SUCCESS: 'ai.success',
  AI_FAILURE: 'ai.failure',
  TOOL_SUCCESS: 'tool.success',
  TOOL_FAILURE: 'tool.failure'
});

const SENSITIVE_KEY_PATTERN = /password|secret|token|api[_-]?key|auth|bearer|credential|cookie|private|authorization/i;
const BEARER_TOKEN_PATTERN = /bearer\s+[a-zA-Z0-9_\-.~+/]+=*/i;
const API_KEY_PREFIX_PATTERN = /(?:sk-[a-zA-Z0-9_\-]{8,}|key-[a-zA-Z0-9_\-]{8,})/i;
const MAX_STRING_LENGTH = 512;
const MAX_EVENT_BYTES = 16 * 1024; // 16 KB

/**
 * Generate a safe unique event identifier.
 */
export function generateEventId() {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return `evt-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Sanitize a value by redacting sensitive data and enforcing string limits.
 */
function sanitizeValue(value, depth = 0) {
  if (depth > 6) return null; // Avoid circular/deep recursion
  if (value == null) return null;

  if (typeof value === 'string') {
    if (BEARER_TOKEN_PATTERN.test(value) || API_KEY_PREFIX_PATTERN.test(value)) {
      return '[REDACTED_CREDENTIAL]';
    }
    return value.length > MAX_STRING_LENGTH
      ? value.slice(0, MAX_STRING_LENGTH) + '...[truncated]'
      : value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.slice(0, 50).map(item => sanitizeValue(item, depth + 1));
  }

  if (typeof value === 'object') {
    const cleaned = {};
    for (const [k, v] of Object.entries(value)) {
      if (SENSITIVE_KEY_PATTERN.test(k)) {
        cleaned[k] = '[REDACTED]';
      } else {
        cleaned[k] = sanitizeValue(v, depth + 1);
      }
    }
    return cleaned;
  }

  return String(value).slice(0, MAX_STRING_LENGTH);
}

/**
 * Recursively sanitize metadata object against credentials, secrets, and oversized inputs.
 */
export function sanitizeMetadata(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return {};
  return sanitizeValue(obj, 0);
}

/**
 * Extract privacy-safe structural metadata from raw user query without persisting raw text by default.
 */
export function extractSafeInputMetadata(query) {
  if (typeof query !== 'string') {
    return { length: 0, wordCount: 0, hasCode: false };
  }
  const length = query.length;
  const wordCount = query.trim() ? query.trim().split(/\s+/).length : 0;
  const hasCode = /```|function\s*\(|const\s+\w+\s*=|=>|\bdef\s+\w+/i.test(query);
  const isQuestion = /[?¿]/.test(query);

  return {
    length,
    wordCount,
    hasCode,
    isQuestion,
    charCount: length
  };
}

/**
 * Extract privacy-safe response metadata from an engine or provider response.
 */
export function extractSafeResponseMetadata(response) {
  if (!response || typeof response !== 'object') {
    return { length: 0, intent: null };
  }

  const text = typeof response.text === 'string' ? response.text : (typeof response.reply === 'string' ? response.reply : '');
  return {
    length: text.length,
    intent: response.intent || null,
    entityId: response.entity?.id || null,
    recommendationCount: Array.isArray(response.recommendations) ? response.recommendations.length : 0,
    actionCount: Array.isArray(response.actions) ? response.actions.length : 0,
    language: response.language || null
  };
}

/**
 * Immutable Learning Event record.
 */
export class LearningEvent {
  constructor({
    id = generateEventId(),
    timestamp = new Date().toISOString(),
    requestId = null,
    eventType = EVENT_TYPES.DETERMINISTIC_RESOLUTION,
    source = 'core',
    intent = null,
    project = null,
    language = null,
    inputMetadata = {},
    responseMetadata = {},
    outcome = 'UNKNOWN',
    feedback = null,
    executionMetadata = {},
    modelMetadata = {},
    latency = null,
    errorCode = null
  } = {}) {
    if (!id || typeof id !== 'string') {
      throw new TypeError('LearningEvent requires a valid non-empty string "id"');
    }
    if (!eventType || typeof eventType !== 'string') {
      throw new TypeError('LearningEvent requires a valid non-empty string "eventType"');
    }

    this.id = id;
    this.timestamp = typeof timestamp === 'string' ? timestamp : new Date(timestamp).toISOString();
    this.requestId = requestId ? String(requestId).slice(0, 128) : null;
    this.eventType = eventType;
    this.source = String(source || 'core').slice(0, 64);
    this.intent = intent ? String(intent).slice(0, 128) : null;
    this.project = project ? String(project).slice(0, 128) : null;
    this.language = language ? String(language).slice(0, 32) : null;
    this.inputMetadata = Object.freeze(sanitizeMetadata(inputMetadata));
    this.responseMetadata = Object.freeze(sanitizeMetadata(responseMetadata));
    this.outcome = String(outcome || 'UNKNOWN').toUpperCase();
    this.feedback = feedback ? Object.freeze(sanitizeMetadata(feedback)) : null;
    this.executionMetadata = Object.freeze(sanitizeMetadata(executionMetadata));
    this.modelMetadata = Object.freeze(sanitizeMetadata(modelMetadata));
    this.latency = typeof latency === 'number' && Number.isFinite(latency) ? Math.max(0, Math.round(latency)) : null;
    this.errorCode = errorCode ? String(errorCode).slice(0, 128) : null;

    // Enforce overall payload size bounds
    const estimatedSize = JSON.stringify(this).length;
    if (estimatedSize > MAX_EVENT_BYTES) {
      throw new RangeError(`LearningEvent exceeds maximum bounded size of ${MAX_EVENT_BYTES} bytes`);
    }

    Object.freeze(this);
  }

  toJSON() {
    return {
      id: this.id,
      timestamp: this.timestamp,
      requestId: this.requestId,
      eventType: this.eventType,
      source: this.source,
      intent: this.intent,
      project: this.project,
      language: this.language,
      inputMetadata: this.inputMetadata,
      responseMetadata: this.responseMetadata,
      outcome: this.outcome,
      feedback: this.feedback,
      executionMetadata: this.executionMetadata,
      modelMetadata: this.modelMetadata,
      latency: this.latency,
      errorCode: this.errorCode
    };
  }
}

/**
 * Factory helper for creating LearningEvent instances.
 */
export function createLearningEvent(options) {
  return new LearningEvent(options);
}
