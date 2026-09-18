/**
 * Governed NIMO-KNOWLEDGE Runtime Client & Provider Abstraction.
 *
 * Connects NIMO-KNOWLEDGE to NIMO-CORE as a governed knowledge source.
 * Enforces the strict governance rule: only APPROVED or ACTIVE knowledge
 * may be consumed at runtime. Any proposed, draft, evaluated, or rejected
 * knowledge is strictly rejected.
 *
 * Implements safe fallbacks and secret-safe diagnostics: never crashes the
 * core engine and never leaks credentials, tokens, or private data.
 */

export const RUNTIME_GOVERNED_STATUSES = Object.freeze(new Set(['approved', 'active']));

export function isApprovedOrActive(status) {
  if (typeof status !== 'string') return false;
  return RUNTIME_GOVERNED_STATUSES.has(status.trim().toLowerCase());
}

/**
 * Sanitizes URLs and diagnostic payloads to ensure tokens and secrets are never logged.
 */
export function sanitizeDiagnosticMessage(message) {
  if (typeof message !== 'string') return String(message ?? '');
  return message
    .replace(/Bearer\s+[A-Za-z0-9._~+/-]+=*/gi, 'Bearer [REDACTED]')
    .replace(/([?&])(?:key|token|secret|password|credential)=[^& \s]+/gi, '$1[REDACTED]')
    .replace(/(?:key|token|secret|password|credential)=[^& \s]+/gi, '[REDACTED]');
}

/**
 * Abstract knowledge provider contract.
 */
export class KnowledgeProvider {
  async fetchCatalog() {
    throw new Error('fetchCatalog must be implemented by subclass');
  }

  async fetchEntry(_pathOrId) {
    throw new Error('fetchEntry must be implemented by subclass');
  }
}

/**
 * Remote HTTP Knowledge Provider.
 * Fetches catalog and entries from an HTTP base URL (e.g. GitHub raw or Cloudflare CDN).
 */
export class HttpKnowledgeProvider extends KnowledgeProvider {
  constructor({
    baseUrl = 'https://raw.githubusercontent.com/manav193/NIMO-KNOWLEDGE/main/',
    fetchImpl = globalThis.fetch,
    timeoutMs = 5000,
    logger = null
  } = {}) {
    super();
    this.baseUrl = String(baseUrl || '').replace(/\/+$/, '') + '/';
    this.fetchImpl = typeof fetchImpl === 'function' ? fetchImpl : globalThis.fetch;
    this.timeoutMs = Math.max(500, Number(timeoutMs) || 5000);
    this.logger = logger;
  }

  async fetchCatalog() {
    return this._fetchJson('indexes/catalog.json');
  }

  async fetchEntry(relativePath) {
    const cleanPath = String(relativePath || '').replace(/^\/+/, '');
    if (!cleanPath) return null;
    return this._fetchJson(cleanPath);
  }

  async _fetchJson(endpoint) {
    const url = `${this.baseUrl}${endpoint}`;
    try {
      if (typeof this.fetchImpl !== 'function') {
        throw new Error('No fetch implementation available');
      }

      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timeoutId = controller ? setTimeout(() => controller.abort(), this.timeoutMs) : null;

      let response;
      try {
        response = await this.fetchImpl(url, {
          headers: { Accept: 'application/json' },
          signal: controller?.signal
        });
      } finally {
        if (timeoutId) clearTimeout(timeoutId);
      }

      if (!response || !response.ok) {
        this._logWarn(`HTTP fetch failed with status ${response?.status || 'UNKNOWN'}`);
        return null;
      }

      return await response.json();
    } catch (err) {
      this._logWarn(`Network exception while fetching knowledge: ${err?.message || err}`);
      return null;
    }
  }

  _logWarn(msg) {
    if (this.logger && typeof this.logger.warn === 'function') {
      this.logger.warn(sanitizeDiagnosticMessage(msg));
    }
  }
}

/**
 * In-Memory Knowledge Provider.
 * Useful for local execution, unit testing, or pre-bundled offline operation.
 */
export class MemoryKnowledgeProvider extends KnowledgeProvider {
  constructor({ catalog = null, entries = [] } = {}) {
    super();
    this.catalog = catalog;
    this.entriesMap = new Map();

    const entryList = Array.isArray(entries)
      ? entries
      : entries && typeof entries === 'object' ? Object.values(entries) : [];

    for (const entry of entryList) {
      if (!entry) continue;
      if (entry.id) this.entriesMap.set(String(entry.id), entry);
      if (entry.path) this.entriesMap.set(String(entry.path), entry);
    }
  }

  async fetchCatalog() {
    return this.catalog;
  }

  async fetchEntry(pathOrId) {
    const key = String(pathOrId || '');
    if (this.entriesMap.has(key)) return this.entriesMap.get(key);
    for (const entry of this.entriesMap.values()) {
      if (entry && (entry.id === key || entry.path === key)) return entry;
    }
    return null;
  }

  setCatalog(catalog) {
    this.catalog = catalog;
  }

  addEntry(entry, path = null) {
    if (!entry) return;
    if (entry.id) this.entriesMap.set(String(entry.id), entry);
    if (path) this.entriesMap.set(String(path), entry);
    if (entry.path) this.entriesMap.set(String(entry.path), entry);
  }
}

/**
 * Validates the structure of a knowledge catalog.
 */
export function validateCatalogStructure(catalog) {
  if (!catalog || typeof catalog !== 'object' || Array.isArray(catalog)) {
    return { valid: false, error: 'Catalog must be a non-null object' };
  }
  if (typeof catalog.catalogVersion !== 'string' || !catalog.catalogVersion.trim()) {
    return { valid: false, error: 'Catalog must specify a non-empty catalogVersion' };
  }
  if (!Array.isArray(catalog.entries)) {
    return { valid: false, error: 'Catalog entries must be an array' };
  }

  return { valid: true, error: null };
}

/**
 * Validates the integrity of an individual knowledge entry.
 */
export function validateKnowledgeEntry(entry, catalogItem = null) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    return { valid: false, error: 'Entry must be a non-null object' };
  }
  if (!entry.id || typeof entry.id !== 'string') {
    return { valid: false, error: 'Entry must have a string id' };
  }
  if (!entry.sourceProject || typeof entry.sourceProject !== 'string') {
    return { valid: false, error: 'Entry must have a string sourceProject' };
  }
  if (!entry.title || typeof entry.title !== 'string') {
    return { valid: false, error: 'Entry must have a title' };
  }
  if (!entry.content || typeof entry.content !== 'string') {
    return { valid: false, error: 'Entry must have content' };
  }
  if (!isApprovedOrActive(entry.status)) {
    return { valid: false, error: `Entry status "${entry.status}" is not approved or active` };
  }
  if (entry.metadata?.sanitized !== true) {
    return { valid: false, error: 'Entry metadata must specify sanitized=true' };
  }

  if (catalogItem) {
    if (String(entry.id) !== String(catalogItem.id)) {
      return { valid: false, error: 'Entry id does not match catalog id' };
    }
    if (!isApprovedOrActive(catalogItem.status)) {
      return { valid: false, error: `Catalog entry status "${catalogItem.status}" is not approved or active` };
    }
    if (catalogItem.version != null && entry.version != null) {
      if (Number(entry.version) !== Number(catalogItem.version)) {
        return { valid: false, error: 'Entry version does not match catalog version' };
      }
    }
  }

  return { valid: true, error: null };
}

/**
 * Governed Knowledge Client for NIMO-CORE.
 */
export class GovernedKnowledgeClient {
  constructor({
    provider = null,
    env = {},
    logger = console,
    cacheTtlMs = 300_000
  } = {}) {
    this.provider = provider || new HttpKnowledgeProvider({
      baseUrl: env.NIMO_KNOWLEDGE_RAW_BASE || undefined,
      logger
    });
    this.logger = logger;
    this.cacheTtlMs = Math.max(1000, Number(cacheTtlMs) || 300_000);
    this._cachedCatalog = null;
    this._catalogCachedAt = 0;
  }

  /**
   * Fetches and validates the knowledge catalog.
   * Fails closed safely if unavailable or malformed.
   */
  async getCatalog({ forceRefresh = false } = {}) {
    const now = Date.now();
    if (!forceRefresh && this._cachedCatalog && now - this._catalogCachedAt < this.cacheTtlMs) {
      return this._cachedCatalog;
    }

    let rawCatalog = null;
    try {
      rawCatalog = await this.provider.fetchCatalog();
    } catch (err) {
      this._logSafe('warn', `Catalog fetch threw exception: ${err?.message || err}`);
    }

    if (!rawCatalog) {
      this._logSafe('warn', 'Knowledge catalog unavailable from provider; failing closed safely.');
      return Object.freeze({
        available: false,
        catalogVersion: null,
        loaded: Object.freeze([]),
        skipped: Object.freeze([]),
        reason: 'PROVIDER_UNAVAILABLE'
      });
    }

    const validation = validateCatalogStructure(rawCatalog);
    if (!validation.valid) {
      this._logSafe('warn', `Malformed knowledge catalog rejected: ${validation.error}`);
      return Object.freeze({
        available: false,
        catalogVersion: null,
        loaded: Object.freeze([]),
        skipped: Object.freeze([]),
        reason: 'MALFORMED_CATALOG'
      });
    }

    const loaded = [];
    const skipped = [];

    for (const item of rawCatalog.entries) {
      const id = String(item?.id || '');
      const status = item?.status;

      if (!isApprovedOrActive(status)) {
        skipped.push(Object.freeze({
          id,
          status: String(status || 'unknown'),
          reason: 'UNAPPROVED_STATUS'
        }));
        continue;
      }

      loaded.push(Object.freeze({
        id,
        type: String(item.type || 'knowledge_entry'),
        project: String(item.project || 'unknown'),
        topic: String(item.topic || ''),
        version: Number(item.version) || 1,
        status: String(status).toLowerCase(),
        path: String(item.path || ''),
        updatedAt: item.updatedAt || null,
        provenance: Object.freeze({
          approvedBy: item.provenance?.approvedBy || null,
          evidence: Object.freeze(Array.isArray(item.provenance?.evidence) ? [...item.provenance.evidence] : [])
        })
      }));
    }

    const result = Object.freeze({
      available: true,
      catalogVersion: String(rawCatalog.catalogVersion),
      updatedAt: rawCatalog.updatedAt || null,
      loaded: Object.freeze(loaded),
      skipped: Object.freeze(skipped),
      reason: null
    });

    this._cachedCatalog = result;
    this._catalogCachedAt = now;
    return result;
  }

  /**
   * Lists approved/active knowledge entries, optionally filtered by project or type.
   */
  async listApproved({ project = null, type = null, forceRefresh = false } = {}) {
    const catalog = await this.getCatalog({ forceRefresh });
    if (!catalog.available) return [];

    let filtered = catalog.loaded;
    if (project) {
      const p = String(project).toLowerCase();
      filtered = filtered.filter(item => item.project.toLowerCase() === p);
    }
    if (type) {
      const t = String(type).toLowerCase();
      filtered = filtered.filter(item => item.type.toLowerCase() === t);
    }

    return filtered;
  }

  /**
   * Resolves a knowledge entry with strict approval verification and provenance preservation.
   */
  async resolveKnowledge({ id = null, path = null, forceRefresh = false } = {}) {
    if (!id && !path) {
      return Object.freeze({
        success: false,
        reason: 'MISSING_IDENTIFIER',
        entry: null
      });
    }

    const catalog = await this.getCatalog({ forceRefresh });
    if (!catalog.available) {
      return Object.freeze({
        success: false,
        reason: 'CATALOG_UNAVAILABLE',
        entry: null
      });
    }

    const catalogItem = catalog.loaded.find(item =>
      (id && item.id === id) || (path && item.path === path)
    );

    if (!catalogItem) {
      // Check if entry exists in catalog but was skipped due to unapproved status
      const skippedItem = catalog.skipped.find(item =>
        id && item.id === id
      );
      if (skippedItem) {
        return Object.freeze({
          success: false,
          reason: 'ENTRY_NOT_APPROVED',
          status: skippedItem.status,
          entry: null
        });
      }

      return Object.freeze({
        success: false,
        reason: 'ENTRY_NOT_FOUND_IN_CATALOG',
        entry: null
      });
    }

    let rawEntry = null;
    try {
      rawEntry = await this.provider.fetchEntry(catalogItem.path);
      if (!rawEntry && catalogItem.id) {
        rawEntry = await this.provider.fetchEntry(catalogItem.id);
      }
    } catch (err) {
      this._logSafe('warn', `Failed to fetch knowledge entry at ${catalogItem.path}: ${err?.message || err}`);
    }

    if (!rawEntry) {
      return Object.freeze({
        success: false,
        reason: 'ENTRY_FETCH_FAILED',
        entry: null
      });
    }

    const validation = validateKnowledgeEntry(rawEntry, catalogItem);
    if (!validation.valid) {
      this._logSafe('warn', `Knowledge entry failed integrity validation (${catalogItem.id}): ${validation.error}`);
      return Object.freeze({
        success: false,
        reason: 'INTEGRITY_CHECK_FAILED',
        validationError: validation.error,
        entry: null
      });
    }

    const provenance = Object.freeze({
      knowledgeId: String(rawEntry.id),
      version: Number(rawEntry.version) || Number(catalogItem.version) || 1,
      sourceProject: String(rawEntry.sourceProject),
      status: String(rawEntry.status).toLowerCase(),
      approvedBy: rawEntry.metadata?.approvedBy || catalogItem.provenance?.approvedBy || null,
      evidence: Object.freeze(
        Array.isArray(rawEntry.evidence) && rawEntry.evidence.length > 0
          ? [...rawEntry.evidence]
          : (Array.isArray(catalogItem.provenance?.evidence) ? [...catalogItem.provenance.evidence] : [])
      ),
      catalogVersion: catalog.catalogVersion,
      path: catalogItem.path,
      catalogUpdatedAt: catalog.updatedAt
    });

    return Object.freeze({
      success: true,
      reason: null,
      entry: Object.freeze({
        id: String(rawEntry.id),
        version: Number(rawEntry.version) || 1,
        sourceProject: String(rawEntry.sourceProject),
        domain: String(rawEntry.domain || 'general'),
        status: String(rawEntry.status).toLowerCase(),
        title: String(rawEntry.title),
        summary: String(rawEntry.summary || ''),
        content: String(rawEntry.content),
        guidelines: Object.freeze(Array.isArray(rawEntry.guidelines) ? [...rawEntry.guidelines] : []),
        evidence: Object.freeze(Array.isArray(rawEntry.evidence) ? [...rawEntry.evidence] : []),
        metadata: Object.freeze({ ...rawEntry.metadata }),
        provenance
      })
    });
  }

  clearCache() {
    this._cachedCatalog = null;
    this._catalogCachedAt = 0;
  }

  _logSafe(level, message) {
    if (this.logger && typeof this.logger[level] === 'function') {
      this.logger[level](sanitizeDiagnosticMessage(message));
    }
  }
}

export function createGovernedKnowledgeClient(options) {
  return new GovernedKnowledgeClient(options);
}
