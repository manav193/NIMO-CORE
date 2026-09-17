/**
 * Runtime strategy projection for approved Prompt-Aii knowledge.
 *
 * This module consumes only the output of the governance activation gate.
 * It does not read repositories, approve knowledge, or persist user prompts.
 */

const STRATEGY_FIELDS = Object.freeze([
  'summary',
  'content',
  'guidelines'
]);

function assertActivated(activated) {
  if (!activated || typeof activated !== 'object') {
    throw new TypeError('Activated Prompt-Aii knowledge is required');
  }
  if (activated.activation?.sourceProject !== 'prompt-aii') {
    throw new TypeError('Prompt-Aii strategy requires a Prompt-Aii activation');
  }
  if (activated.activation?.status !== 'approved') {
    throw new TypeError('Prompt-Aii strategy requires approved knowledge');
  }
  if (activated.activation?.sanitized !== true) {
    throw new TypeError('Prompt-Aii strategy requires sanitized knowledge');
  }
  if (!activated.entry || activated.entry.id !== activated.activation.knowledgeEntryId) {
    throw new TypeError('Activated Prompt-Aii entry does not match its manifest');
  }
}

/**
 * Project an approved Prompt-Aii knowledge entry into bounded runtime guidance.
 * No raw user input or provider credential is accepted by this function.
 */
export function buildPromptAiiStrategy(activated) {
  assertActivated(activated);
  const entry = activated.entry;

  return Object.freeze({
    sourceProject: 'prompt-aii',
    knowledgeEntryId: entry.id,
    knowledgeVersion: entry.version,
    catalogVersion: activated.activation.catalogVersion || null,
    summary: String(entry.summary || '').trim(),
    content: String(entry.content || '').trim(),
    guidelines: Array.isArray(entry.guidelines)
      ? Object.freeze(entry.guidelines.map(item => String(item).trim()).filter(Boolean))
      : Object.freeze([]),
    strategyFields: STRATEGY_FIELDS
  });
}
