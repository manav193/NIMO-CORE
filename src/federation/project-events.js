import { KnowledgeValidationError, assertPlainObject } from '../utils/validation.js';

export const PROJECT_EVENT_TYPES = Object.freeze([
  'projectOpened', 'toolExecuted', 'moduleLoaded', 'projectClosed', 'repairEvent', 'searchPerformed',
  'systemBootStarted', 'nimoCoreOnline', 'moduleRegistryReady', 'toolVerseRegistered',
  'repairEventStarted', 'repairEventCompleted', 'systemBootCompleted', 'audioCue',
  'moduleOpened', 'moduleClosed', 'projectViewed', 'searchResolved', 'commandExecuted',
  'nimoActivated', 'nimoDeactivated', 'idleEntered', 'idleExited', 'modulePinned',
  'moduleUnpinned', 'qualityModeChanged', 'projectDiscovered', 'commandPaletteOpened'
]);

export const SYSTEM_STATUS_TYPES = Object.freeze([
  'boot-started', 'core-online', 'registry-ready', 'module-registered', 'repair-started', 'repair-completed', 'system-ready'
]);

export function createProjectEvent(type, { moduleId, projectId = null, timestamp = new Date().toISOString(), detail = {} } = {}) {
  if (!PROJECT_EVENT_TYPES.includes(type)) throw new KnowledgeValidationError(`Unsupported project event: ${type}`);
  if (typeof moduleId !== 'string' || !moduleId.trim()) throw new KnowledgeValidationError('Project events require moduleId.');
  assertPlainObject(detail, 'event.detail');
  const safeTimestamp = typeof timestamp === 'string' && timestamp.trim() ? timestamp.trim() : new Date().toISOString();
  return Object.freeze({
    protocol: 'nimo-project-event', version: '1.0.0', type,
    moduleId: moduleId.trim(), projectId: typeof projectId === 'string' && projectId.trim() ? projectId.trim() : null,
    timestamp: safeTimestamp, detail: Object.freeze({ ...detail })
  });
}

export function isProjectEvent(value) {
  try {
    if (!value || value.protocol !== 'nimo-project-event' || value.version !== '1.0.0') return false;
    createProjectEvent(value.type, value);
    return true;
  } catch { return false; }
}

export function createSystemStatus(status, { source = 'nimo-core', moduleId = null, detail = {} } = {}) {
  if (!SYSTEM_STATUS_TYPES.includes(status)) throw new KnowledgeValidationError(`Unsupported system status: ${status}`);
  if (typeof source !== 'string' || !source.trim()) throw new KnowledgeValidationError('System status requires a source.');
  assertPlainObject(detail, 'status.detail');
  return Object.freeze({
    protocol: 'nimo-system-status', version: '1.0.0', type: 'system-status', status,
    source: source.trim(), moduleId: typeof moduleId === 'string' && moduleId.trim() ? moduleId.trim() : null,
    timestamp: new Date().toISOString(), detail: Object.freeze({ ...detail })
  });
}
