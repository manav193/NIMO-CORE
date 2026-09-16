/**
 * NIMO Core Outcome and Feedback Abstraction
 * Defines interaction success/failure classifications without assuming
 * unverified interactions are successful.
 */

export const OUTCOMES = Object.freeze({
  SUCCESS: 'SUCCESS',
  FAILURE: 'FAILURE',
  UNKNOWN: 'UNKNOWN',
  CORRECTED: 'CORRECTED',
  ABANDONED: 'ABANDONED'
});

const VALID_OUTCOMES_SET = new Set(Object.values(OUTCOMES));

/**
 * Validate whether a string is a recognized outcome.
 */
export function isOutcomeValid(outcome) {
  return typeof outcome === 'string' && VALID_OUTCOMES_SET.has(outcome.toUpperCase());
}

/**
 * Normalize and sanitize external user feedback.
 */
export function normalizeFeedback(rawFeedback) {
  if (!rawFeedback || typeof rawFeedback !== 'object') return null;

  const normalized = {};

  if (typeof rawFeedback.rating === 'number') {
    normalized.rating = Math.max(-1, Math.min(1, Math.round(rawFeedback.rating)));
  } else if (rawFeedback.satisfied === true) {
    normalized.rating = 1;
  } else if (rawFeedback.satisfied === false) {
    normalized.rating = -1;
  }

  if (typeof rawFeedback.correction === 'string' && rawFeedback.correction.trim()) {
    normalized.correction = rawFeedback.correction.trim().slice(0, 512);
  }

  if (typeof rawFeedback.comment === 'string' && rawFeedback.comment.trim()) {
    normalized.comment = rawFeedback.comment.trim().slice(0, 512);
  }

  if (typeof rawFeedback.reason === 'string' && rawFeedback.reason.trim()) {
    normalized.reason = rawFeedback.reason.trim().slice(0, 128);
  }

  return Object.keys(normalized).length > 0 ? Object.freeze(normalized) : null;
}

/**
 * Determine whether an interaction produced a useful result.
 * Strictly avoids guessing success in the absence of a reliable signal.
 */
export function classifyOutcome({
  feedback = null,
  error = null,
  intent = null,
  fallbackTriggered = false,
  executionFailed = false,
  userSignal = null
} = {}) {
  // 1. Explicit execution failure or unhandled exception
  if (error != null || executionFailed) {
    return OUTCOMES.FAILURE;
  }

  // 2. User signal of abandonment (e.g. session closed immediately or query re-rolled)
  if (userSignal === 'abandoned') {
    return OUTCOMES.ABANDONED;
  }

  // 3. User explicit correction
  if (userSignal === 'correction' || (feedback && typeof feedback.correction === 'string' && feedback.correction.trim())) {
    return OUTCOMES.CORRECTED;
  }

  // 4. User explicit feedback (rating / thumbs up / thumbs down)
  if (feedback && typeof feedback.rating === 'number') {
    if (feedback.rating > 0) return OUTCOMES.SUCCESS;
    if (feedback.rating < 0) return OUTCOMES.FAILURE;
  }

  if (feedback && typeof feedback.satisfied === 'boolean') {
    return feedback.satisfied ? OUTCOMES.SUCCESS : OUTCOMES.FAILURE;
  }

  // 5. If fallback was triggered or unknown query, outcome is UNKNOWN without user signal
  if (fallbackTriggered || intent === 'fallback') {
    return OUTCOMES.UNKNOWN;
  }

  // 6. Default to UNKNOWN if there is no reliable feedback signal rather than guessing
  return OUTCOMES.UNKNOWN;
}
