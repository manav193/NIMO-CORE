/**
 * Prompt-Aii learning-event adapter.
 * Converts Prompt-Aii execution outcomes into privacy-preserving NIMO events.
 * This is observation only; it never promotes knowledge automatically.
 */
import { EVENT_TYPES, createLearningEvent, extractSafeInputMetadata, sanitizeMetadata } from './events.js';

const OUTCOME_MAP = Object.freeze({
  success: 'SUCCESS',
  failure: 'FAILURE',
  unknown: 'UNKNOWN'
});

function normalizeOutcome(value) {
  const normalized = String(value || 'unknown').toLowerCase();
  return OUTCOME_MAP[normalized] || 'UNKNOWN';
}

/**
 * Create a sanitized learning event from a Prompt-Aii execution result.
 * Raw prompt text and raw model output are intentionally not persisted.
 */
export function createPromptAiiLearningEvent({
  requestId = null,
  input = '',
  intent = null,
  language = null,
  target = null,
  model = null,
  strategy = null,
  responseMetadata = {},
  outcome = 'unknown',
  feedback = null,
  latency = null,
  errorCode = null,
  metadata = {}
} = {}) {
  const normalizedOutcome = normalizeOutcome(outcome);
  const eventType = normalizedOutcome === 'SUCCESS'
    ? EVENT_TYPES.INTERACTION_SUCCESS
    : normalizedOutcome === 'FAILURE'
      ? EVENT_TYPES.INTERACTION_FAILURE
      : EVENT_TYPES.DETERMINISTIC_RESOLUTION;

  const resolvedTarget = target || responseMetadata?.target || null;
  const resolvedStrategy = strategy || responseMetadata?.strategy || null;

  return createLearningEvent({
    requestId,
    eventType,
    source: 'prompt-aii',
    intent,
    project: 'prompt-aii',
    language,
    inputMetadata: extractSafeInputMetadata(input),
    responseMetadata: {
      ...(responseMetadata && typeof responseMetadata === 'object' ? responseMetadata : {}),
      target: resolvedTarget ? String(resolvedTarget).slice(0, 64) : null,
      strategy: resolvedStrategy ? String(resolvedStrategy).slice(0, 128) : null
    },
    outcome: normalizedOutcome,
    feedback: feedback ? sanitizeMetadata(feedback) : null,
    executionMetadata: sanitizeMetadata(metadata),
    modelMetadata: {
      provider: model?.provider || null,
      model: model?.model || null,
      family: model?.family || null
    },
    latency,
    errorCode
  });
}

export function isPromptAiiLearningEvent(value) {
  return Boolean(value && value.source === 'prompt-aii' && value.project === 'prompt-aii');
}
