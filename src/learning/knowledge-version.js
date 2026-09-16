/**
 * NIMO Core Versioned Knowledge Update Model
 * Safe, immutable lifecycle management for knowledge source versions with
 * explicit review gates and complete rollback capability.
 *
 * SAFETY PRINCIPLE:
 * Knowledge versions start in DRAFT and require explicit EVALUATED -> APPROVED
 * state progression. Versions are NEVER automatically activated without
 * human or test suite authorization.
 */

export const KNOWLEDGE_VERSION_STATUSES = Object.freeze({
  DRAFT: 'DRAFT',
  EVALUATED: 'EVALUATED',
  APPROVED: 'APPROVED',
  ACTIVE: 'ACTIVE',
  ROLLED_BACK: 'ROLLED_BACK'
});

const VALID_KNOWLEDGE_STATUSES = new Set(Object.values(KNOWLEDGE_VERSION_STATUSES));

/**
 * Immutable Knowledge Version record.
 */
export class KnowledgeVersion {
  constructor({
    version,
    source,
    changes = [],
    evidence = [],
    evaluation = null,
    status = KNOWLEDGE_VERSION_STATUSES.DRAFT,
    createdAt = new Date().toISOString(),
    activatedAt = null,
    rolledBackAt = null
  } = {}) {
    if (!version || typeof version !== 'string') {
      throw new TypeError('KnowledgeVersion requires a valid string version identifier');
    }
    if (!source || typeof source !== 'string') {
      throw new TypeError('KnowledgeVersion requires a valid string source identifier');
    }
    if (!VALID_KNOWLEDGE_STATUSES.has(status)) {
      throw new TypeError(`Invalid knowledge version status: ${status}`);
    }

    this.version = version;
    this.source = source;
    this.changes = Object.freeze(Array.isArray(changes) ? [...changes] : []);
    this.evidence = Object.freeze(Array.isArray(evidence) ? [...evidence] : []);
    this.evaluation = evaluation ? Object.freeze({ ...evaluation }) : null;
    this.status = status;
    this.createdAt = createdAt;
    this.activatedAt = activatedAt;
    this.rolledBackAt = rolledBackAt;

    Object.freeze(this);
  }

  withStatus(newStatus, metadata = {}) {
    if (!VALID_KNOWLEDGE_STATUSES.has(newStatus)) {
      throw new TypeError(`Invalid knowledge version status: ${newStatus}`);
    }

    return new KnowledgeVersion({
      version: this.version,
      source: this.source,
      changes: this.changes,
      evidence: this.evidence,
      evaluation: metadata.evaluation || this.evaluation,
      status: newStatus,
      createdAt: this.createdAt,
      activatedAt: newStatus === KNOWLEDGE_VERSION_STATUSES.ACTIVE ? new Date().toISOString() : this.activatedAt,
      rolledBackAt: newStatus === KNOWLEDGE_VERSION_STATUSES.ROLLED_BACK ? new Date().toISOString() : this.rolledBackAt
    });
  }

  toJSON() {
    return {
      version: this.version,
      source: this.source,
      changes: this.changes,
      evidence: this.evidence,
      evaluation: this.evaluation,
      status: this.status,
      createdAt: this.createdAt,
      activatedAt: this.activatedAt,
      rolledBackAt: this.rolledBackAt
    };
  }
}

/**
 * Manager tracking version history and controlling transition lifecycle for knowledge sources.
 */
export class KnowledgeVersionManager {
  #versions = new Map(); // version string -> KnowledgeVersion
  #activeBySource = new Map(); // source string -> active version string

  /**
   * Create a new draft knowledge version.
   */
  createDraft({ version, source, changes = [], evidence = [] }) {
    if (this.#versions.has(version)) {
      throw new Error(`Knowledge version "${version}" already exists.`);
    }

    const draft = new KnowledgeVersion({
      version,
      source,
      changes,
      evidence,
      status: KNOWLEDGE_VERSION_STATUSES.DRAFT
    });

    this.#versions.set(version, draft);
    return draft;
  }

  /**
   * Record evaluation results for a version.
   */
  evaluate(version, evaluationData = {}) {
    const existing = this.getVersion(version);
    if (!existing) throw new Error(`Version "${version}" not found.`);
    if (existing.status !== KNOWLEDGE_VERSION_STATUSES.DRAFT) {
      throw new Error(`Cannot evaluate version "${version}" with status "${existing.status}". Must be DRAFT.`);
    }

    const updated = existing.withStatus(KNOWLEDGE_VERSION_STATUSES.EVALUATED, { evaluation: evaluationData });
    this.#versions.set(version, updated);
    return updated;
  }

  /**
   * Approve an evaluated version.
   */
  approve(version) {
    const existing = this.getVersion(version);
    if (!existing) throw new Error(`Version "${version}" not found.`);
    if (existing.status !== KNOWLEDGE_VERSION_STATUSES.EVALUATED) {
      throw new Error(`Cannot approve version "${version}" with status "${existing.status}". Must be EVALUATED.`);
    }

    const updated = existing.withStatus(KNOWLEDGE_VERSION_STATUSES.APPROVED);
    this.#versions.set(version, updated);
    return updated;
  }

  /**
   * Activate an approved version, replacing any currently active version for the source.
   */
  activate(version) {
    const existing = this.getVersion(version);
    if (!existing) throw new Error(`Version "${version}" not found.`);
    if (existing.status !== KNOWLEDGE_VERSION_STATUSES.APPROVED) {
      throw new Error(`Cannot activate version "${version}" with status "${existing.status}". Must be APPROVED.`);
    }

    const activated = existing.withStatus(KNOWLEDGE_VERSION_STATUSES.ACTIVE);
    this.#versions.set(version, activated);
    this.#activeBySource.set(activated.source, version);
    return activated;
  }

  /**
   * Roll back the currently active version for a source to a specified target version.
   */
  rollback(source, targetVersion) {
    const currentActive = this.getActive(source);
    if (!currentActive) {
      throw new Error(`No active version found to roll back for source "${source}".`);
    }

    const target = this.getVersion(targetVersion);
    if (!target) {
      throw new Error(`Target rollback version "${targetVersion}" does not exist.`);
    }
    if (target.source !== source) {
      throw new Error(`Target rollback version "${targetVersion}" belongs to source "${target.source}", not "${source}".`);
    }

    // Mark current active as ROLLED_BACK
    const rolledBack = currentActive.withStatus(KNOWLEDGE_VERSION_STATUSES.ROLLED_BACK);
    this.#versions.set(currentActive.version, rolledBack);

    // Reactivate target version
    const reactivated = target.withStatus(KNOWLEDGE_VERSION_STATUSES.ACTIVE);
    this.#versions.set(targetVersion, reactivated);
    this.#activeBySource.set(source, targetVersion);

    return {
      rolledBackFrom: rolledBack,
      activeVersion: reactivated
    };
  }

  getActive(source) {
    const activeVer = this.#activeBySource.get(source);
    return activeVer ? this.#versions.get(activeVer) || null : null;
  }

  getVersion(version) {
    return this.#versions.get(version) || null;
  }

  getHistory(source) {
    const result = [];
    for (const v of this.#versions.values()) {
      if (!source || v.source === source) {
        result.push(v);
      }
    }
    return result.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  clear() {
    this.#versions.clear();
    this.#activeBySource.clear();
  }
}

export function createKnowledgeVersionManager() {
  return new KnowledgeVersionManager();
}
