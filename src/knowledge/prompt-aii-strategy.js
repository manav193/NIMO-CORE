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

function normalizeActivated(activated) {
  if (!activated || typeof activated !== 'object') {
    throw new TypeError('Activated Prompt-Aii knowledge is required');
  }

  const isWrapper = Boolean(activated.activation && activated.entry);
  const activation = isWrapper
    ? activated.activation
    : {
        sourceProject: activated.sourceProject,
        status: activated.status,
        sanitized: activated.metadata?.sanitized === true || activated.sanitized === true,
        knowledgeEntryId: activated.id,
        catalogVersion: activated.catalogVersion || null
      };
  const entry = isWrapper ? activated.entry : activated;

  if (activation.sourceProject !== 'prompt-aii') {
    throw new TypeError('Prompt-Aii strategy requires a Prompt-Aii activation');
  }
  const statusLower = String(activation.status || '').toLowerCase();
  if (statusLower !== 'approved' && statusLower !== 'active') {
    throw new TypeError('Prompt-Aii strategy requires approved knowledge');
  }
  if (activation.sanitized !== true) {
    throw new TypeError('Prompt-Aii strategy requires sanitized knowledge');
  }
  if (!entry || entry.id !== activation.knowledgeEntryId) {
    throw new TypeError('Activated Prompt-Aii entry does not match its manifest');
  }

  return { activation, entry };
}

/**
 * Project an approved Prompt-Aii knowledge entry into bounded runtime guidance.
 * No raw user input or provider credential is accepted by this function.
 */
export function buildPromptAiiStrategy(input) {
  const { activation, entry } = normalizeActivated(input);

  return Object.freeze({
    sourceProject: 'prompt-aii',
    knowledgeEntryId: entry.id,
    knowledgeVersion: entry.version,
    status: String(activation.status || 'approved').toLowerCase(),
    catalogVersion: activation.catalogVersion || null,
    summary: String(entry.summary || '').trim(),
    content: String(entry.content || '').trim(),
    guidelines: Array.isArray(entry.guidelines)
      ? Object.freeze(entry.guidelines.map(item => String(item).trim()).filter(Boolean))
      : Object.freeze([]),
    strategyFields: STRATEGY_FIELDS
  });
}
