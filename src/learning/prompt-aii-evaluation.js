/**
 * Governed Prompt-Aii evaluation bridge.
 * Converts Prompt-Aii learning observations into reviewable improvement proposals.
 * It never promotes knowledge or changes runtime configuration automatically.
 */

import {
  ImprovementProposal,
  PROPOSAL_CATEGORIES,
  PROPOSAL_STATUSES
} from './evaluation-engine.js';
import { isPromptAiiLearningEvent } from './prompt-aii-events.js';

export function evaluatePromptAiiEvents(events = [], { minEvidenceCount = 3 } = {}) {
  const observations = events.filter(isPromptAiiLearningEvent);
  if (observations.length < Math.max(1, Number(minEvidenceCount) || 3)) return [];

  const failures = observations.filter(event => event.outcome === 'FAILURE');
  const successes = observations.filter(event => event.outcome === 'SUCCESS');
  const proposals = [];

  if (failures.length >= Math.max(1, Number(minEvidenceCount) || 3)) {
    const byTarget = new Map();
    for (const event of failures) {
      const target = event.responseMetadata?.target || 'unknown';
      byTarget.set(target, (byTarget.get(target) || 0) + 1);
    }

    for (const [target, count] of byTarget.entries()) {
      proposals.push(new ImprovementProposal({
        proposalId: `prop-prompt-aii-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        category: PROPOSAL_CATEGORIES.PROMPT_IMPROVEMENT,
        target: `prompt-aii:${target}`,
        evidence: [{
          source: 'prompt-aii',
          failureCount: count,
          totalPromptAiiObservations: observations.length,
          successCount: successes.length
        }],
        confidence: Math.min(0.9, 0.55 + (count / observations.length) * 0.35),
        expectedImprovement: `Review the Prompt-Aii strategy for target "${target}" against recurring failed outcomes before considering a governed knowledge update.`,
        risk: 'MEDIUM',
        status: PROPOSAL_STATUSES.PROPOSED
      }));
    }
  }

  return proposals;
}

/**
 * Convert a proposal into the NIMO-KNOWLEDGE review-artifact contract.
 * This is serialization only: it does not approve, publish, or activate knowledge.
 */
export function serializePromptAiiProposal(proposal) {
  if (!proposal || typeof proposal.toJSON !== 'function') {
    throw new TypeError('serializePromptAiiProposal requires an ImprovementProposal');
  }

  const value = proposal.toJSON();
  if (!String(value.proposalId).startsWith('prop-prompt-aii-')) {
    throw new TypeError('Prompt-Aii proposalId must use the governed prefix');
  }

  return Object.freeze({
    proposalId: value.proposalId,
    sourceProject: 'prompt-aii',
    category: value.category,
    target: value.target,
    evidence: value.evidence,
    confidence: value.confidence,
    expectedImprovement: value.expectedImprovement,
    risk: value.risk,
    status: value.status,
    createdAt: value.createdAt,
    metadata: Object.freeze({
      sanitized: true,
      requiresHumanReview: true,
      knowledgeEntryPath: null
    })
  });
}

export function serializePromptAiiProposals(proposals = []) {
  return proposals.map(serializePromptAiiProposal);
}

export async function evaluatePromptAiiLearningStore(store, options = {}) {
  if (!store || typeof store.getByProject !== 'function') return [];
  const events = await store.getByProject('prompt-aii', options.maxEvents || 500);
  return evaluatePromptAiiEvents(events, options);
}
