import { KnowledgeValidationError, assertPlainObject } from '../utils/validation.js';

export const ADAPTIVE_INTERACTION_MODES = Object.freeze(['pointer-primary', 'keyboard-primary', 'touch-primary', 'mixed']);
export const ADAPTIVE_QUALITY_MODES = Object.freeze(['full', 'balanced', 'low-power', 'static']);

const stringList = (value, label) => {
  if (!Array.isArray(value) || value.some(item => typeof item !== 'string')) throw new KnowledgeValidationError(`${label} must be a string array.`);
  return Object.freeze([...new Set(value.map(item => item.trim()).filter(Boolean))].slice(0, 12));
};

export function normalizeAdaptiveSessionContext(value) {
  assertPlainObject(value, 'adaptive session context');
  const forbidden = ['query', 'searchText', 'formContents', 'filename', 'copiedText', 'identity', 'ipAddress'];
  if (forbidden.some(key => key in value)) throw new KnowledgeValidationError('Adaptive session context contains raw or identifying data.');
  if (!ADAPTIVE_INTERACTION_MODES.includes(value.interactionMode)) throw new KnowledgeValidationError('Invalid adaptive interaction mode.');
  if (!ADAPTIVE_QUALITY_MODES.includes(value.qualityMode)) throw new KnowledgeValidationError('Invalid adaptive quality mode.');
  if (!['active', 'soft-idle', 'deep-idle'].includes(value.sessionState)) throw new KnowledgeValidationError('Invalid adaptive session state.');
  if (typeof value.currentModule !== 'string' || !value.currentModule.trim()) throw new KnowledgeValidationError('Adaptive context requires currentModule.');
  return Object.freeze({
    protocol: 'nimo-adaptive-context', version: '1.0.0', interactionMode: value.interactionMode,
    frequentModules: stringList(value.frequentModules || [], 'frequentModules'),
    preferredCategories: stringList(value.preferredCategories || [], 'preferredCategories'),
    preferredIntents: stringList(value.preferredIntents || [], 'preferredIntents'),
    currentModule: value.currentModule.trim(), sessionState: value.sessionState, qualityMode: value.qualityMode,
    pinnedModules: stringList(value.pinnedModules || [], 'pinnedModules')
  });
}
