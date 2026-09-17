/**
 * Resolve the approved Prompt-Aii knowledge asset for runtime prompt strategy.
 *
 * The source of truth remains NIMO-KNOWLEDGE. This module only consumes the
 * committed activation manifest, catalog, and approved entry; it never approves
 * or mutates knowledge.
 */

import { validatePromptAiiActivationManifest, resolveActivatedPromptAiiKnowledge } from './prompt-aii-activation.js';
import { buildPromptAiiStrategy } from './prompt-aii-strategy.js';

const DEFAULT_RAW_BASE = 'https://raw.githubusercontent.com/manav193/NIMO-KNOWLEDGE/main/';
const MANIFEST_PATH = 'indexes/prompt-aii-activation.json';
const CATALOG_PATH = 'indexes/catalog.json';
const DEFAULT_KNOWLEDGE_ID = 'kno-20260917-prompt-aii-deep-prompt-engineering';

let cachedRuntime = null;
let cachedAt = 0;
const CACHE_TTL_MS = 300_000;

async function fetchJson(url, fetchImpl = globalThis.fetch) {
  const response = await fetchImpl(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`NIMO-KNOWLEDGE fetch failed: ${response.status}`);
  return response.json();
}

export async function resolvePromptAiiRuntimeStrategy({ env = {}, fetchImpl, forceRefresh = false } = {}) {
  const now = Date.now();
  if (!forceRefresh && cachedRuntime && now - cachedAt < CACHE_TTL_MS) return cachedRuntime;

  const base = String(env.NIMO_KNOWLEDGE_RAW_BASE || DEFAULT_RAW_BASE).replace(/\/+$/, '') + '/';
  const manifest = await fetchJson(`${base}${MANIFEST_PATH}`, fetchImpl);
  const activation = validatePromptAiiActivationManifest(manifest);
  if (activation.knowledgeEntryId !== DEFAULT_KNOWLEDGE_ID) {
    throw new Error('Unexpected Prompt-Aii knowledge entry');
  }

  const catalog = await fetchJson(`${base}${CATALOG_PATH}`, fetchImpl);
  const entry = await fetchJson(`${base}${activation.knowledgePath}`, fetchImpl);
  const resolved = resolveActivatedPromptAiiKnowledge({ manifest, catalog, entries: [entry] });
  const strategy = buildPromptAiiStrategy(resolved);

  cachedRuntime = Object.freeze(strategy);
  cachedAt = now;
  return cachedRuntime;
}

export function isPromptAiiKnowledgeContext(context = {}) {
  return context?.projectId === 'prompt-aii' &&
    (context?.governedKnowledge === DEFAULT_KNOWLEDGE_ID || context?.governedKnowledge == null);
}

export function clearPromptAiiRuntimeCache() {
  cachedRuntime = null;
  cachedAt = 0;
}
