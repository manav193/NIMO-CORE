/**
 * Governance gate for consuming approved Prompt-Aii knowledge.
 * It validates an activation manifest and returns a frozen runtime-safe reference.
 * It never approves, mutates, or publishes knowledge.
 */

import { loadApprovedKnowledge } from './approved-loader.js';

const PATH_PATTERN = /^knowledge\/projects\/prompt-aii-[a-z0-9-]+\.json$/;
const ID_PATTERN = /^kno-[a-z0-9-]+$/;

export function validatePromptAiiActivationManifest(manifest) {
  if (!manifest || typeof manifest !== 'object') throw new TypeError('Prompt-Aii activation manifest must be an object');
  if (!ID_PATTERN.test(String(manifest.knowledgeEntryId || ''))) throw new TypeError('Invalid Prompt-Aii knowledgeEntryId');
  if (manifest.sourceProject !== 'prompt-aii') throw new TypeError('Prompt-Aii activation requires sourceProject=prompt-aii');
  if (manifest.status !== 'approved') throw new TypeError('Only approved Prompt-Aii knowledge may be activated');
  if (!Number.isInteger(manifest.version) || manifest.version < 1) throw new TypeError('Prompt-Aii knowledge version must be a positive integer');
  if (!PATH_PATTERN.test(String(manifest.knowledgePath || ''))) throw new TypeError('Invalid Prompt-Aii knowledge path');
  if (typeof manifest.approvedBy !== 'string' || !manifest.approvedBy.trim()) throw new TypeError('Prompt-Aii activation requires reviewer provenance');
  if (manifest.sanitized !== true) throw new TypeError('Prompt-Aii activation requires sanitized=true');

  return Object.freeze({
    knowledgeEntryId: manifest.knowledgeEntryId,
    sourceProject: 'prompt-aii',
    status: 'approved',
    version: manifest.version,
    knowledgePath: manifest.knowledgePath,
    approvedBy: manifest.approvedBy,
    sanitized: true,
    ...(manifest.catalogVersion ? { catalogVersion: String(manifest.catalogVersion) } : {})
  });
}

export function canActivatePromptAiiKnowledge(manifest) {
  try {
    validatePromptAiiActivationManifest(manifest);
    return true;
  } catch {
    return false;
  }
}

/**
 * Resolve an approved Prompt-Aii knowledge entry for runtime consumption.
 * The manifest is validated first, then the normal approved/sanitized loader
 * is used. A manifest never bypasses catalog approval or sanitization checks.
 */
export function resolveActivatedPromptAiiKnowledge({ manifest, catalog, entries = [] } = {}) {
  const activation = validatePromptAiiActivationManifest(manifest);
  const result = loadApprovedKnowledge({ catalog, entries });
  const entry = result.loaded.find(item =>
    item.id === activation.knowledgeEntryId &&
    item.version === activation.version &&
    item.path === activation.knowledgePath
  );

  if (!entry) {
    throw new Error(`Approved Prompt-Aii knowledge entry not available: ${activation.knowledgeEntryId}`);
  }

  return Object.freeze({ activation, entry });
}
