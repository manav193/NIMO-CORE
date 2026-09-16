/**
 * NIMO Core Evaluation Engine
 * Analyzes recorded learning events to identify systemic gaps, high-failure patterns,
 * or routing inefficiencies, producing structured ImprovementProposals.
 *
 * CRITICAL SAFETY PRINCIPLE:
 * This engine NEVER automatically modifies source code, system prompts,
 * security guardrails, or production configurations. It generates evaluated
 * proposals solely for human/system review and controlled versioned deployment.
 */

export const PROPOSAL_CATEGORIES = Object.freeze({
  INTENT_ROUTING: 'intent-routing-improvement',
  CONTEXT_RESOLUTION: 'context-resolution-improvement',
  KNOWLEDGE_UPDATE: 'knowledge-update',
  PROMPT_IMPROVEMENT: 'prompt-improvement',
  MODEL_ROUTING: 'model-routing-improvement',
  TOOL_STRATEGY: 'tool-strategy-improvement'
});

export const PROPOSAL_STATUSES = Object.freeze({
  PROPOSED: 'PROPOSED',
  TESTING: 'TESTING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED'
});

const VALID_STATUSES_SET = new Set(Object.values(PROPOSAL_STATUSES));

/**
 * Immutable Improvement Proposal.
 */
export class ImprovementProposal {
  constructor({
    proposalId,
    category,
    target,
    evidence = [],
    confidence = 0.5,
    expectedImprovement = '',
    risk = 'LOW',
    status = PROPOSAL_STATUSES.PROPOSED,
    createdAt = new Date().toISOString()
  } = {}) {
    if (!proposalId || typeof proposalId !== 'string') {
      throw new TypeError('ImprovementProposal requires a valid string proposalId');
    }
    if (!category || !Object.values(PROPOSAL_CATEGORIES).includes(category)) {
      throw new TypeError(`Invalid proposal category: ${category}`);
    }

    this.proposalId = proposalId;
    this.category = category;
    this.target = String(target || 'general');
    this.evidence = Object.freeze(Array.isArray(evidence) ? [...evidence] : [evidence]);
    this.confidence = Math.max(0, Math.min(1, Number(confidence) || 0.5));
    this.expectedImprovement = String(expectedImprovement || '');
    this.risk = ['LOW', 'MEDIUM', 'HIGH'].includes(String(risk).toUpperCase()) ? String(risk).toUpperCase() : 'LOW';
    this.status = VALID_STATUSES_SET.has(status) ? status : PROPOSAL_STATUSES.PROPOSED;
    this.createdAt = createdAt;

    Object.freeze(this);
  }

  withStatus(newStatus) {
    if (!VALID_STATUSES_SET.has(newStatus)) {
      throw new TypeError(`Invalid proposal status: ${newStatus}`);
    }
    return new ImprovementProposal({
      proposalId: this.proposalId,
      category: this.category,
      target: this.target,
      evidence: this.evidence,
      confidence: this.confidence,
      expectedImprovement: this.expectedImprovement,
      risk: this.risk,
      status: newStatus,
      createdAt: this.createdAt
    });
  }

  toJSON() {
    return {
      proposalId: this.proposalId,
      category: this.category,
      target: this.target,
      evidence: this.evidence,
      confidence: this.confidence,
      expectedImprovement: this.expectedImprovement,
      risk: this.risk,
      status: this.status,
      createdAt: this.createdAt
    };
  }
}

/**
 * Evaluation Engine that analyzes learning store events and formulates proposals.
 */
export class EvaluationEngine {
  #store;
  #proposals = new Map();
  #minEvidenceCount;

  constructor({ store, minEvidenceCount = 3 } = {}) {
    this.#store = store;
    this.#minEvidenceCount = Math.max(1, Number(minEvidenceCount) || 3);
  }

  /**
   * Run evaluation across stored learning events and generate improvement proposals.
   */
  async evaluate({ maxEvents = 500 } = {}) {
    if (!this.#store || typeof this.#store.getRecent !== 'function') {
      return [];
    }

    const events = await this.#store.getRecent(maxEvents);
    if (!events.length) return [];

    const newProposals = [];

    // 1. Analyze Fallback / Unknown Intent Patterns
    const fallbackEvents = events.filter(e => e.intent === 'fallback' || e.eventType === 'ai.fallback');
    if (fallbackEvents.length >= this.#minEvidenceCount) {
      const proposalId = `prop-intent-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const proposal = new ImprovementProposal({
        proposalId,
        category: PROPOSAL_CATEGORIES.INTENT_ROUTING,
        target: 'intent-router:fallback-threshold',
        evidence: [{
          totalEvents: events.length,
          fallbackCount: fallbackEvents.length,
          fallbackRatio: Math.round((fallbackEvents.length / events.length) * 100) / 100
        }],
        confidence: Math.min(0.95, 0.5 + (fallbackEvents.length / events.length) * 0.4),
        expectedImprovement: `Expand deterministic intent keywords to resolve recurrent unhandled queries (${fallbackEvents.length} detected).`,
        risk: 'LOW',
        status: PROPOSAL_STATUSES.PROPOSED
      });
      newProposals.push(proposal);
      this.#proposals.set(proposal.proposalId, proposal);
    }

    // 2. Analyze User Corrections
    const correctionEvents = events.filter(e => e.outcome === 'CORRECTED' || e.eventType === 'user.correction');
    if (correctionEvents.length >= Math.max(2, Math.floor(this.#minEvidenceCount / 2))) {
      const byProject = new Map();
      for (const e of correctionEvents) {
        const p = e.project || 'general';
        byProject.set(p, (byProject.get(p) || 0) + 1);
      }

      for (const [project, count] of byProject.entries()) {
        const proposalId = `prop-knowledge-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const proposal = new ImprovementProposal({
          proposalId,
          category: PROPOSAL_CATEGORIES.KNOWLEDGE_UPDATE,
          target: `knowledge:${project}`,
          evidence: [{ project, correctionCount: count, totalCorrections: correctionEvents.length }],
          confidence: Math.min(0.9, 0.6 + count * 0.1),
          expectedImprovement: `Review and clarify knowledge source and alias definitions for project "${project}" to address repeated user corrections.`,
          risk: 'MEDIUM',
          status: PROPOSAL_STATUSES.PROPOSED
        });
        newProposals.push(proposal);
        this.#proposals.set(proposal.proposalId, proposal);
      }
    }

    // 3. Analyze Model Failures & Latency
    const modelEvents = events.filter(e => e.source === 'openrouter');
    if (modelEvents.length >= this.#minEvidenceCount) {
      const modelStats = new Map();
      for (const e of modelEvents) {
        const m = e.modelMetadata?.model || 'unknown';
        if (!modelStats.has(m)) modelStats.set(m, { total: 0, failed: 0, totalLatency: 0, latencyCount: 0 });
        const stats = modelStats.get(m);
        stats.total++;
        if (e.outcome === 'FAILURE' || e.eventType === 'ai.failure') stats.failed++;
        if (typeof e.latency === 'number' && e.latency > 0) {
          stats.totalLatency += e.latency;
          stats.latencyCount++;
        }
      }

      for (const [model, stats] of modelStats.entries()) {
        const failRate = stats.total > 0 ? stats.failed / stats.total : 0;
        const avgLatency = stats.latencyCount > 0 ? Math.round(stats.totalLatency / stats.latencyCount) : 0;

        if (failRate >= 0.3 || avgLatency > 8000) {
          const proposalId = `prop-model-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
          const proposal = new ImprovementProposal({
            proposalId,
            category: PROPOSAL_CATEGORIES.MODEL_ROUTING,
            target: `model:${model}`,
            evidence: [{ model, totalRequests: stats.total, failureRate: Math.round(failRate * 100) / 100, avgLatencyMs: avgLatency }],
            confidence: 0.85,
            expectedImprovement: `Adjust failover priority or timeout boundaries for model "${model}" due to high failure rate (${Math.round(failRate * 100)}%) or elevated latency (${avgLatency}ms).`,
            risk: 'LOW',
            status: PROPOSAL_STATUSES.PROPOSED
          });
          newProposals.push(proposal);
          this.#proposals.set(proposal.proposalId, proposal);
        }
      }
    }

    return newProposals;
  }

  getProposals() {
    return Array.from(this.#proposals.values());
  }

  getProposal(proposalId) {
    return this.#proposals.get(proposalId) || null;
  }

  updateProposalStatus(proposalId, newStatus) {
    const existing = this.#proposals.get(proposalId);
    if (!existing) {
      throw new Error(`Proposal not found: ${proposalId}`);
    }
    const updated = existing.withStatus(newStatus);
    this.#proposals.set(proposalId, updated);
    return updated;
  }

  clearProposals() {
    this.#proposals.clear();
  }
}

export function createEvaluationEngine(options) {
  return new EvaluationEngine(options);
}
