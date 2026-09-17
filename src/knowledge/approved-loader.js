/**
 * Governed NIMO-KNOWLEDGE loader.
 *
 * This adapter consumes an already-fetched NIMO-KNOWLEDGE catalog and its
 * entries. It only exposes entries that are explicitly APPROVED/approved and
 * sanitized. It never promotes, activates, or mutates knowledge state.
 */

const APPROVED_STATUSES = new Set(['approved', 'APPROVED']);

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeEntry(entry) {
  if (!isPlainObject(entry)) return null;
  if (!entry.id || !entry.sourceProject || !entry.title || !entry.content) return null;
  if (!APPROVED_STATUSES.has(entry.status)) return null;
  if (entry.metadata?.sanitized !== true) return null;

  return Object.freeze({
    id: String(entry.id),
    version: Number(entry.version) || 1,
    sourceProject: String(entry.sourceProject),
    domain: String(entry.domain || 'unknown'),
    status: String(entry.status).toLowerCase(),
    title: String(entry.title),
    summary: String(entry.summary || ''),
    content: String(entry.content),
    guidelines: Object.freeze(Array.isArray(entry.guidelines) ? [...entry.guidelines] : []),
    evidence: Object.freeze(Array.isArray(entry.evidence) ? [...entry.evidence] : []),
    metadata: Object.freeze({ ...entry.metadata })
  });
}

/**
 * Load only catalog entries explicitly marked approved and sanitized.
 * `entries` is a map/object keyed by catalog path or entry id.
 */
export function loadApprovedKnowledge({ catalog, entries = [] } = {}) {
  if (!isPlainObject(catalog)) {
    throw new TypeError('loadApprovedKnowledge requires a catalog object');
  }

  const catalogEntries = Array.isArray(catalog.entries) ? catalog.entries : [];
  const entryList = Array.isArray(entries)
    ? entries
    : isPlainObject(entries) ? Object.values(entries) : [];

  const byId = new Map(entryList.map(entry => [String(entry?.id || ''), entry]));
  const loaded = [];
  const skipped = [];

  for (const item of catalogEntries) {
    const id = String(item?.id || '');
    const catalogStatus = String(item?.status || '').toLowerCase();
    const entry = byId.get(id);
    const normalized = normalizeEntry(entry);

    if (catalogStatus !== 'approved' || !normalized || normalized.id !== id) {
      skipped.push({ id, reason: !entry ? 'ENTRY_NOT_FOUND' : 'NOT_APPROVED_OR_SANITIZED' });
      continue;
    }

    loaded.push(Object.freeze({
      ...normalized,
      catalogVersion: String(catalog.catalogVersion || 'unknown'),
      path: String(item.path || ''),
      catalogUpdatedAt: item.updatedAt || null
    }));
  }

  return Object.freeze({
    catalogVersion: String(catalog.catalogVersion || 'unknown'),
    loaded: Object.freeze(loaded),
    skipped: Object.freeze(skipped)
  });
}

export function createApprovedKnowledgeLoader(options = {}) {
  return () => loadApprovedKnowledge(options);
}
