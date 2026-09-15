const SESSION_KEY = 'arcade-adaptive-session:v1';
const PREFERENCE_KEY = 'arcade-adaptive-preferences:v1';
const MODES = new Set(['pointer-primary', 'keyboard-primary', 'touch-primary', 'mixed']);
const INTENTS = new Set(['image-tool', 'pdf-tool', 'calculator', 'project', 'game', 'ui-case-study', 'developer-concept']);
const MOTION = new Set(['full', 'reduced', 'static']);

const clone = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
const safeParse = (storage, key) => {
  try { return JSON.parse(storage?.getItem(key) || 'null'); } catch { return null; }
};
const roundedMinute = time => Math.floor(time / 60000) * 60000;

export function deriveInteractionMode(counts = {}) {
  const ordered = [
    ['pointer-primary', Math.max(0, Number(counts.pointer) || 0)],
    ['keyboard-primary', Math.max(0, Number(counts.keyboard) || 0)],
    ['touch-primary', Math.max(0, Number(counts.touch) || 0)]
  ].sort((a, b) => b[1] - a[1]);
  if (!ordered[0][1]) return 'mixed';
  if (ordered[1][1] >= Math.max(2, ordered[0][1] * 0.35)) return 'mixed';
  return ordered[0][0];
}

const safeGetStorage = type => {
  try {
    return typeof globalThis[type] !== 'undefined' ? globalThis[type] : null;
  } catch {
    return null;
  }
};

export function createAdaptiveSession({ sessionStore, preferenceStore, now = Date.now, writeDelay = 120 } = {}) {
  const memorySession = sessionStore || safeGetStorage('sessionStorage');
  const memoryPreferences = preferenceStore || safeGetStorage('localStorage');
  const saved = safeParse(memorySession, SESSION_KEY) || {};
  const savedPreferences = safeParse(memoryPreferences, PREFERENCE_KEY) || {};
  const state = {
    version: 1,
    interactionCounts: { pointer: 0, keyboard: 0, touch: 0, ...(saved.interactionCounts || {}) },
    interactionMode: MODES.has(saved.interactionMode) ? saved.interactionMode : 'mixed',
    moduleOpens: { ...(saved.moduleOpens || {}) },
    categoryInterest: { ...(saved.categoryInterest || {}) },
    intentCounts: { ...(saved.intentCounts || {}) },
    currentModule: typeof saved.currentModule === 'string' ? saved.currentModule : null,
    sessionState: saved.sessionState === 'soft-idle' || saved.sessionState === 'deep-idle' ? saved.sessionState : 'active',
    qualityMode: ['full', 'balanced', 'low-power', 'static'].includes(saved.qualityMode) ? saved.qualityMode : 'balanced',
    lastActiveAt: Number(saved.lastActiveAt) || roundedMinute(now())
  };
  const preferences = {
    adaptiveInterface: savedPreferences.adaptiveInterface !== false,
    motionResponse: MOTION.has(savedPreferences.motionResponse) ? savedPreferences.motionResponse : 'full',
    nimoSuggestions: savedPreferences.nimoSuggestions !== false,
    rememberPinnedModules: Boolean(savedPreferences.rememberPinnedModules),
    pinnedModules: Array.isArray(savedPreferences.pinnedModules) ? savedPreferences.pinnedModules.filter(value => typeof value === 'string').slice(0, 12) : []
  };
  const listeners = new Set();
  let writeTimer = null;

  const notify = recommendation => listeners.forEach(listener => listener({ state: clone(state), preferences: clone(preferences), recommendation }));
  const persistSession = () => {
    writeTimer = null;
    try { memorySession?.setItem(SESSION_KEY, JSON.stringify(state)); } catch {}
  };
  const queueWrite = () => {
    if (writeTimer) return;
    writeTimer = setTimeout(persistSession, writeDelay);
  };
  const persistPreferences = () => {
    try { memoryPreferences?.setItem(PREFERENCE_KEY, JSON.stringify(preferences)); } catch {}
  };
  const increment = (record, key) => { if (key) record[key] = Math.min(999, (record[key] || 0) + 1); };

  const record = event => {
    if (!event || typeof event.type !== 'string' || preferences.adaptiveInterface === false) return clone(state);
    const detail = event.detail && typeof event.detail === 'object' ? event.detail : {};
    switch (event.type) {
      case 'pointerActivity': increment(state.interactionCounts, 'pointer'); break;
      case 'keyboardActivity': increment(state.interactionCounts, 'keyboard'); break;
      case 'touchActivity': increment(state.interactionCounts, 'touch'); break;
      case 'moduleOpened':
      case 'projectViewed': {
        const moduleId = typeof detail.moduleId === 'string' ? detail.moduleId.slice(0, 64) : null;
        increment(state.moduleOpens, moduleId);
        state.currentModule = moduleId || state.currentModule;
        if (typeof detail.category === 'string') increment(state.categoryInterest, detail.category.slice(0, 48));
        break;
      }
      case 'moduleClosed': state.currentModule = null; break;
      case 'searchResolved': if (INTENTS.has(detail.intentCategory)) increment(state.intentCounts, detail.intentCategory); break;
      case 'idleEntered': state.sessionState = detail.level === 'deep' ? 'deep-idle' : 'soft-idle'; break;
      case 'idleExited': state.sessionState = 'active'; break;
      case 'qualityModeChanged': if (['full', 'balanced', 'low-power', 'static'].includes(detail.mode)) state.qualityMode = detail.mode; break;
      default: return clone(state);
    }
    state.interactionMode = deriveInteractionMode(state.interactionCounts);
    state.lastActiveAt = roundedMinute(now());
    queueWrite();
    notify(null);
    return clone(state);
  };

  const setPreference = (key, value) => {
    if (!(key in preferences)) return false;
    if (key === 'motionResponse' && !MOTION.has(value)) return false;
    if (key === 'pinnedModules') return false;
    preferences[key] = typeof preferences[key] === 'boolean' ? Boolean(value) : value;
    if (key === 'rememberPinnedModules' && !preferences.rememberPinnedModules) preferences.pinnedModules = [];
    persistPreferences();
    notify(null);
    return true;
  };

  const pinModule = (moduleId, pinned) => {
    if (!preferences.rememberPinnedModules || typeof moduleId !== 'string') return false;
    const next = new Set(preferences.pinnedModules);
    pinned ? next.add(moduleId.slice(0, 64)) : next.delete(moduleId);
    preferences.pinnedModules = [...next].slice(0, 12);
    persistPreferences();
    notify({ type: pinned ? 'modulePinned' : 'moduleUnpinned', moduleId });
    return true;
  };

  const getSummary = () => ({
    interactionMode: state.interactionMode,
    frequentModules: Object.entries(state.moduleOpens).filter(([, count]) => count >= 3).sort((a, b) => b[1] - a[1]).map(([id]) => id).slice(0, 4),
    preferredCategories: Object.entries(state.categoryInterest).sort((a, b) => b[1] - a[1]).map(([id]) => id).slice(0, 3),
    preferredIntents: Object.entries(state.intentCounts).sort((a, b) => b[1] - a[1]).map(([id]) => id).slice(0, 3),
    currentModule: state.currentModule,
    sessionState: state.sessionState,
    qualityMode: state.qualityMode,
    pinnedModules: [...preferences.pinnedModules]
  });

  return {
    record,
    getState: () => clone(state),
    getPreference: key => clone(preferences[key]),
    getPreferences: () => clone(preferences),
    setPreference,
    pinModule,
    getSummary,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    reset() {
      if (writeTimer) clearTimeout(writeTimer);
      writeTimer = null;
      try { memorySession?.removeItem(SESSION_KEY); memoryPreferences?.removeItem(PREFERENCE_KEY); } catch {}
      Object.assign(state, { interactionCounts: { pointer: 0, keyboard: 0, touch: 0 }, interactionMode: 'mixed', moduleOpens: {}, categoryInterest: {}, intentCounts: {}, currentModule: null, sessionState: 'active', qualityMode: 'balanced', lastActiveAt: roundedMinute(now()) });
      Object.assign(preferences, { adaptiveInterface: true, motionResponse: 'full', nimoSuggestions: true, rememberPinnedModules: false, pinnedModules: [] });
      notify({ type: 'reset' });
    },
    flush: persistSession
  };
}

export { INTENTS as ADAPTIVE_INTENT_CATEGORIES };
