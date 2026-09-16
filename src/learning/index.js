/**
 * NIMO Core Learning & Self-Improvement Foundation
 * Exports the event model, outcome classification, storage abstractions,
 * evaluation engine, and versioned knowledge lifecycle.
 */

export {
  EVENT_TYPES,
  LearningEvent,
  createLearningEvent,
  sanitizeMetadata,
  extractSafeInputMetadata,
  extractSafeResponseMetadata,
  generateEventId
} from './events.js';

export {
  OUTCOMES,
  isOutcomeValid,
  normalizeFeedback,
  classifyOutcome
} from './outcomes.js';

export {
  LearningStore,
  InMemoryLearningStore,
  createInMemoryLearningStore
} from './store.js';

export {
  PROPOSAL_CATEGORIES,
  PROPOSAL_STATUSES,
  ImprovementProposal,
  EvaluationEngine,
  createEvaluationEngine
} from './evaluation-engine.js';

export {
  KNOWLEDGE_VERSION_STATUSES,
  KnowledgeVersion,
  KnowledgeVersionManager,
  createKnowledgeVersionManager
} from './knowledge-version.js';
