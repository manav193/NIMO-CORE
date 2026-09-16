export { NimoEngine, createNimoEngine } from './core/nimo-engine.js';
export { ContextResolver } from './context-resolver.js';
export { detectLanguage } from './language-detector.js';
export { matchEntity, matchEntities } from './entity-matcher.js';
export { routeIntent } from './intent-router.js';
export { buildResponse } from './response-builder.js';
export { NIMO_PERSONA } from './persona/nimo-persona.js';
export { KnowledgeRegistry, createKnowledgeRegistry, registerProjectSource, getDefaultRegistry } from './knowledge/registry.js';
export { normalizeProjectEntry, normalizeProjectSource } from './knowledge/schema.js';
export { NIMO_GLOSSARY } from './knowledge/glossary.js';
export { ARCADE_OS_PROJECTS_SOURCE } from './knowledge/sources/arcade-os-projects.js';
export { createArcadeOsAdapter } from './adapters/arcade-os-adapter.js';
export { createToolVerseAdapter } from './adapters/toolverse-adapter.js';
export { createGenericProjectAdapter } from './adapters/generic-project-adapter.js';
export { createBrowserClient } from './integrations/browser-client.js';
export { createPromptAINimoBridge } from './integrations/prompt-ai-nimo.js';
export { PromptAIClient, createPromptAIClient } from './services/prompt-ai.js';
export { normalizeText, tokenize } from './utils/normalize-text.js';
export { scoreAliases, tokenOverlapScore, clampScore } from './utils/scoring.js';
export { KnowledgeValidationError, DuplicateKnowledgeError, assertPlainObject, sanitizeObject } from './utils/validation.js';
export { OpenRouterProvider, createOpenRouterProvider } from './services/openrouter.js';
export { createServer, startServer } from './server/server.js';
export { normalizeModuleManifest, MODULE_MANIFEST_STATUSES } from './federation/manifest-schema.js';
export {
  ModuleRegistry, createModuleRegistry, registerModule, unregisterModule, getModule,
  getModules, findByCapability, findByKeyword, getDefaultModuleRegistry
} from './federation/module-registry.js';
export { ProjectFederation, createProjectFederation } from './federation/project-federation.js';
export {
  PROJECT_EVENT_TYPES, SYSTEM_STATUS_TYPES, createProjectEvent, isProjectEvent, createSystemStatus
} from './federation/project-events.js';
export { createModuleNavigationAction } from './federation/navigation-contract.js';
export {
  normalizeAdaptiveSessionContext, ADAPTIVE_INTERACTION_MODES, ADAPTIVE_QUALITY_MODES
} from './adaptive/session-context.js';
export {
  EVENT_TYPES,
  LearningEvent,
  createLearningEvent,
  sanitizeMetadata,
  extractSafeInputMetadata,
  extractSafeResponseMetadata,
  generateEventId,
  OUTCOMES,
  isOutcomeValid,
  normalizeFeedback,
  classifyOutcome,
  LearningStore,
  InMemoryLearningStore,
  createInMemoryLearningStore,
  PROPOSAL_CATEGORIES,
  PROPOSAL_STATUSES,
  ImprovementProposal,
  EvaluationEngine,
  createEvaluationEngine,
  KNOWLEDGE_VERSION_STATUSES,
  KnowledgeVersion,
  KnowledgeVersionManager,
  createKnowledgeVersionManager
} from './learning/index.js';

export { default as worker, handleWorkerRequest } from './worker.js';
import worker from './worker.js';
export default worker;
