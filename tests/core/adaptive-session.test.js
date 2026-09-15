import test from 'node:test';
import assert from 'node:assert/strict';
import { createAdaptiveSession, deriveInteractionMode } from '../../shared/adaptive/adaptive-session.js';
import { createAdaptiveRecommendations } from '../../shared/adaptive/adaptive-recommendations.js';
import { createIdleController } from '../../shared/adaptive/idle-controller.js';
import { createQualityManager } from '../../shared/adaptive/quality-manager.js';
import { normalizeAdaptiveSessionContext } from '../../src/adaptive/session-context.js';

const storage = () => {
  const values = new Map();
  return { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key), dump: () => [...values.values()].join(' ') };
};
const makeSession = () => createAdaptiveSession({ sessionStore: storage(), preferenceStore: storage(), writeDelay: 1 });

test('detects pointer, keyboard, touch, and mixed interaction modes', () => {
  assert.equal(deriveInteractionMode({ pointer: 5 }), 'pointer-primary');
  assert.equal(deriveInteractionMode({ keyboard: 5 }), 'keyboard-primary');
  assert.equal(deriveInteractionMode({ touch: 5 }), 'touch-primary');
  assert.equal(deriveInteractionMode({ pointer: 4, keyboard: 2 }), 'mixed');
});

test('enters soft idle and wakes immediately', () => {
  const callbacks = [], pending = new Map(); let id = 0;
  const timers = { setTimeout(fn, ms) { pending.set(++id, { fn, ms }); return id; }, clearTimeout(key) { pending.delete(key); } };
  const idle = createIdleController({ softMs: 25, deepMs: 100, timers, onChange: state => callbacks.push(state) });
  idle.start();
  [...pending.values()].find(timer => timer.ms === 25).fn();
  assert.equal(idle.getState(), 'soft-idle');
  idle.activity();
  assert.deepEqual(callbacks, ['soft-idle', 'active']);
});

test('reduced motion is authoritative', () => {
  const quality = createQualityManager({ reducedMotion: true });
  assert.equal(quality.getMode(), 'static');
  assert.equal(quality.sample(10), 'static');
});

test('quality downgrades and recovers cautiously', () => {
  let clock = 0;
  const quality = createQualityManager({ now: () => clock });
  for (let i = 0; i < 46; i++) quality.sample(30);
  assert.equal(quality.getMode(), 'low-power');
  clock = 20000;
  for (let i = 0; i < 361; i++) quality.sample(12);
  assert.equal(quality.getMode(), 'balanced');
});

test('frequent modules recommend pinning but never auto-pin', () => {
  const session = makeSession();
  for (let i = 0; i < 3; i++) session.record({ type: 'moduleOpened', detail: { moduleId: 'toolverse' } });
  const recommendation = createAdaptiveRecommendations({ now: () => 200000 }).recommend(session.getSummary(), session.getPreferences());
  assert.equal(recommendation.type, 'pin-module');
  assert.deepEqual(session.getSummary().pinnedModules, []);
});

test('raw search text is neither retained nor persisted', () => {
  const sessionStore = storage();
  const session = createAdaptiveSession({ sessionStore, preferenceStore: storage(), writeDelay: 1 });
  session.record({ type: 'searchResolved', detail: { intentCategory: 'pdf-tool', query: 'private raw query' } });
  session.flush();
  assert.equal(session.getState().intentCounts['pdf-tool'], 1);
  assert.equal(sessionStore.dump().includes('private raw query'), false);
});

test('reset clears session and explicit preferences', () => {
  const sessionStore = storage(), preferenceStore = storage();
  const session = createAdaptiveSession({ sessionStore, preferenceStore });
  session.setPreference('nimoSuggestions', false);
  session.record({ type: 'moduleOpened', detail: { moduleId: 'toolverse' } });
  session.flush(); session.reset();
  assert.deepEqual(session.getState().moduleOpens, {});
  assert.equal(session.getPreference('nimoSuggestions'), true);
  assert.equal(sessionStore.dump(), '');
  assert.equal(preferenceStore.dump(), '');
});

test('adaptation off disables behavioral state changes', () => {
  const session = makeSession();
  session.setPreference('adaptiveInterface', false);
  session.record({ type: 'keyboardActivity' });
  assert.equal(session.getState().interactionCounts.keyboard, 0);
});

test('NIMO suggestions use cooldown, dismissal, and preference suppression', () => {
  let clock = 200000;
  const engine = createAdaptiveRecommendations({ now: () => clock, cooldownMs: 1000 });
  const summary = { interactionMode: 'keyboard-primary', frequentModules: [], pinnedModules: [], preferredCategories: [] };
  const preferences = { adaptiveInterface: true, nimoSuggestions: true };
  const first = engine.recommend(summary, preferences);
  assert.ok(first);
  assert.equal(engine.recommend(summary, preferences), null);
  clock += 1001;
  const repeated = engine.recommend(summary, preferences);
  assert.ok(repeated);
  engine.dismiss(repeated.key);
  clock += 1001;
  assert.equal(engine.recommend(summary, preferences), null);
  assert.equal(engine.recommend(summary, { ...preferences, nimoSuggestions: false }), null);
});

test('normalizes only aggregated NIMO context', () => {
  const context = normalizeAdaptiveSessionContext({ interactionMode: 'mixed', frequentModules: ['toolverse'], preferredCategories: ['utilities'], preferredIntents: ['pdf-tool'], currentModule: 'arcade-os', sessionState: 'active', qualityMode: 'balanced', pinnedModules: [] });
  assert.equal(context.protocol, 'nimo-adaptive-context');
  assert.throws(() => normalizeAdaptiveSessionContext({ ...context, query: 'raw' }));
});

test('adaptive engine source contains no networking primitives', async () => {
  const fs = await import('node:fs/promises');
  const source = await fs.readFile(new URL('../../shared/adaptive/adaptive-session.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /\bfetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket/);
});
