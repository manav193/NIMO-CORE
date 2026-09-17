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

export async function evaluatePromptAiiLearningStore(store, options = {}) {
  if (!store || typeof store.getByProject !== 'function') return [];
  const events = await store.getByProject('prompt-aii', options.maxEvents || 500);
  return evaluatePromptAiiEvents(events, options);
}
