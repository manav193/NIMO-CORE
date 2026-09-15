import { normalizeText } from './utils/normalize-text.js';

const containsAny = (text, phrases) => phrases.some(phrase => text.includes(phrase));

export function routeIntent(input, { entity = null, context = {}, registry = null } = {}) {
  const text = normalizeText(input);
  const safeContext = context && typeof context === 'object' ? context : {};
  const project = entity || (safeContext.projectId && registry?.get ? registry.get(safeContext.projectId) : null);

  if (containsAny(text, ['who are you', 'what is nimo', 'who is nimo', 'तुम कौन', 'नीमो क्या'])) {
    return { id: 'identity', confidence: 0.98, project: registry?.get ? registry.get('nimo') : null };
  }
  if (containsAny(text, ['repair tool', 'repair arcade', 'fix anomaly', 'system repair'])) {
    return { id: 'arcade_event', confidence: 0.92, event: 'repair-tool', project };
  }
  if (containsAny(text, ['which tool', 'what tool', 'recommend', 'suggest', 'tool chahiye', 'कौन सा टूल'])) {
    return { id: 'recommendation', confidence: 0.86, project: null };
  }
  if (project && containsAny(text, ['open', 'launch', 'go to', 'navigate', 'खोलो', 'खोल'])) {
    return { id: 'open_entity', confidence: 0.94, project };
  }
  if (project && containsAny(text, ['case study', 'case-study', 'details', 'deep dive'])) {
    return { id: 'case_study', confidence: 0.9, project };
  }
  if (project && containsAny(text, ['local', 'private', 'upload', 'browser'])) {
    return { id: 'processing_mode', confidence: 0.88, project };
  }
  if (project && containsAny(text, ['format', 'formats', 'file type', 'supports'])) {
    return { id: 'formats', confidence: 0.86, project };
  }
  if (project && containsAny(text, ['limitation', 'limitations', 'cannot', "can't"])) {
    return { id: 'limitations', confidence: 0.86, project };
  }
  if (project && containsAny(text, ['related', 'alternative', 'another', 'similar'])) {
    return { id: 'related', confidence: 0.82, project };
  }
  if (project && containsAny(text, ['how', 'reduce', 'merge', 'compress', 'use', 'kaise', 'कैसे'])) {
    return { id: 'capability_help', confidence: 0.8, project };
  }
  if (project) return { id: 'project_lookup', confidence: Math.max(0.7, context.followUp ? 0.82 : 0.74), project };

  if (context.currentPage || context.currentSection) return { id: 'current_context', confidence: 0.62, project: null };
  return { id: 'fallback', confidence: 0.2, project: null };
}
