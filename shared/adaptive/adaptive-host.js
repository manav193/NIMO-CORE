import { createAdaptiveSession, ADAPTIVE_INTENT_CATEGORIES } from './adaptive-session.js';
import { createAdaptiveRecommendations } from './adaptive-recommendations.js';
import { createIdleController } from './idle-controller.js';
import { createQualityManager } from './quality-manager.js';
import { createArcadeFabric } from '../fabric/arcade-fabric.js';

const inferIntent = value => {
  const text = String(value || '').toLowerCase();
  if (/image|jpg|png|webp|photo/.test(text)) return 'image-tool';
  if (/pdf/.test(text)) return 'pdf-tool';
  if (/calculat|interest|tax|emi|bmi|percentage/.test(text)) return 'calculator';
  if (/game|gravity|arcade/.test(text)) return 'game';
  if (/ui|ux|case study|design/.test(text)) return 'ui-case-study';
  if (/code|developer|api|javascript|html|css/.test(text)) return 'developer-concept';
  return text ? 'project' : null;
};

export function initAdaptiveHost({ moduleId = 'arcade-os', projectSelector = '[data-project-id]', searchSelector = '#cmd-input', fabricContainer = '#machine-bg' } = {}) {
  if (typeof document === 'undefined') return null;
  const reducedQuery = matchMedia('(prefers-reduced-motion: reduce)');
  const session = createAdaptiveSession();
  const recommendations = createAdaptiveRecommendations();
  let container = document.querySelector(fabricContainer);
  if (!container) {
    container = document.createElement('div');
    container.id = fabricContainer.replace(/^#/, '') || 'machine-bg';
    container.setAttribute('aria-hidden', 'true');
    document.body.prepend(container);
  }
  container.classList.add('arcade-fabric');

  let fabric = null;
  const quality = createQualityManager({
    reducedMotion: reducedQuery.matches,
    saveData: Boolean(navigator.connection?.saveData),
    memory: Number(navigator.deviceMemory) || null,
    onChange: mode => {
      fabric?.setQuality(mode);
      session.record({ type: 'qualityModeChanged', detail: { mode } });
      document.documentElement.dataset.adaptiveQuality = mode;
    }
  });
  fabric = createArcadeFabric({ container, reducedMotion: reducedQuery.matches, onFrame: ms => quality.sample(ms) });
  fabric?.setQuality(quality.getMode());
  session.record({ type: 'qualityModeChanged', detail: { mode: quality.getMode() } });

  const emitFederation = (type, detail = {}) => window.dispatchEvent(new CustomEvent('adaptive:event', {
    detail: { protocol: 'nimo-project-event', version: '1.0.0', type, moduleId, detail }
  }));
  let wakeMessageShown = false;
  const idle = createIdleController({ onChange: state => {
    const active = state === 'active';
    session.record({ type: active ? 'idleExited' : 'idleEntered', detail: active ? {} : { level: state === 'deep-idle' ? 'deep' : 'soft' } });
    document.documentElement.dataset.sessionState = state;
    if (state === 'soft-idle') fabric?.setQuality('low-power');
    if (state === 'deep-idle') fabric?.pause();
    if (active) {
      fabric?.setQuality(quality.getMode());
      fabric?.resume();
      if (!wakeMessageShown) {
        wakeMessageShown = true;
        window.dispatchEvent(new CustomEvent('adaptive:wake', { detail: { message: 'Welcome back. System activity restored.' } }));
      }
    }
    emitFederation(active ? 'idleExited' : 'idleEntered', active ? {} : { level: state === 'deep-idle' ? 'deep' : 'soft' });
  }});

  let lastRecommendation = null;
  const updateMode = () => {
    const summary = session.getSummary();
    const enabled = session.getPreference('adaptiveInterface');
    document.documentElement.dataset.adaptiveEnabled = String(enabled);
    document.documentElement.dataset.interactionMode = enabled ? summary.interactionMode : 'mixed';
    if (!enabled) fabric?.reset();
    const recommendation = recommendations.recommend(summary, session.getPreferences());
    if (recommendation) {
      lastRecommendation = recommendation;
      window.dispatchEvent(new CustomEvent('adaptive:recommendation', { detail: recommendation }));
    }
  };
  const unsubscribe = session.subscribe(updateMode);
  const abort = new AbortController();
  const passive = { signal: abort.signal, passive: true };

  document.addEventListener('pointerdown', event => {
    session.record({ type: event.pointerType === 'touch' ? 'touchActivity' : 'pointerActivity' });
    idle.activity();
    if (event.pointerType !== 'touch' && session.getPreference('adaptiveInterface')) {
      fabric?.disturb(event.clientX / innerWidth, event.clientY / innerHeight, { intensity: .08 });
    }
  }, passive);
  document.addEventListener('keydown', event => {
    if (!event.metaKey && !event.ctrlKey && !event.altKey) session.record({ type: 'keyboardActivity' });
    idle.activity();
  }, { signal: abort.signal });
  document.addEventListener('click', event => {
    const project = event.target.closest(projectSelector);
    if (!project) return;
    const id = project.dataset.projectId || project.dataset.moduleId || project.getAttribute('href')?.split('/').pop()?.replace(/\.html.*$/, '');
    session.record({ type: 'projectViewed', detail: { moduleId: id || moduleId, category: project.dataset.category || '' } });
    emitFederation('projectViewed', { projectId: id || null, category: project.dataset.category || null });
  }, { signal: abort.signal });
  document.querySelectorAll(projectSelector).forEach(project => {
    project.addEventListener('pointerenter', () => {
      if (session.getPreference('adaptiveInterface') && session.getSummary().interactionMode !== 'touch-primary') fabric?.focus(project);
    }, passive);
  });

  let searchTimer = null;
  document.querySelectorAll(searchSelector).forEach(input => input.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      const intentCategory = inferIntent(input.value);
      if (!ADAPTIVE_INTENT_CATEGORIES.has(intentCategory)) return;
      session.record({ type: 'searchResolved', detail: { intentCategory } });
      if (session.getPreference('adaptiveInterface')) fabric?.emit('searchResolved');
      emitFederation('searchResolved', { intentCategory });
    }, 450);
  }, { signal: abort.signal }));
  window.addEventListener('nimo:project-event', event => {
    const value = event.detail;
    if (!value?.type) return;
    if (session.getPreference('adaptiveInterface')) fabric?.emit(value.type, value.detail);
    if (value.type === 'projectOpened' || value.type === 'moduleLoaded' || value.type === 'moduleOpened') {
      session.record({ type: 'moduleOpened', detail: { moduleId: value.projectId || value.moduleId } });
    }
  }, { signal: abort.signal });
  window.addEventListener('adaptive:event', event => {
    const value = event.detail;
    if (!value?.type) return;
    if (value.type === 'moduleOpened' || value.type === 'projectViewed') session.record({ type: value.type, detail: value.detail || {} });
    if (session.getPreference('adaptiveInterface')) fabric?.emit(value.type, value.detail || {});
  }, { signal: abort.signal });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { idle.pause(); fabric?.pause(); }
    else { idle.resume(); if (session.getState().sessionState === 'active') fabric?.resume(); }
  }, { signal: abort.signal });
  reducedQuery.addEventListener('change', () => {
    const mode = reducedQuery.matches ? 'static' : session.getPreference('motionResponse') === 'reduced' ? 'low-power' : 'balanced';
    quality.setMode(mode);
  }, { signal: abort.signal });

  const ensurePanel = () => {
    let panel = document.getElementById('adaptive-settings');
    if (panel) return panel;
    panel = document.createElement('div');
    panel.id = 'adaptive-settings';
    panel.className = 'adaptive-settings-backdrop';
    panel.hidden = true;
    panel.innerHTML = `<section class="adaptive-settings" role="dialog" aria-modal="true" aria-labelledby="adaptive-title"><header><div><p>Arcade OS</p><h2 id="adaptive-title">System Adaptation</h2></div><button type="button" data-adaptive-close aria-label="Close adaptation settings">Close</button></header><p class="adaptive-privacy">Adaptation happens locally in your browser. No behavioral data is sent to a server.</p><div class="adaptive-controls"><label>Adaptive interface <input type="checkbox" data-pref="adaptiveInterface"></label><label>Motion response <select data-pref="motionResponse"><option value="full">Full</option><option value="reduced">Reduced</option><option value="static">Static</option></select></label><label>NIMO suggestions <input type="checkbox" data-pref="nimoSuggestions"></label><label>Remember pinned modules <input type="checkbox" data-pref="rememberPinnedModules"></label></div><button type="button" class="adaptive-reset" data-adaptive-reset>Reset local preferences</button></section>`;
    document.body.append(panel);
    const sync = () => panel.querySelectorAll('[data-pref]').forEach(control => {
      const value = session.getPreference(control.dataset.pref);
      if (control.type === 'checkbox') control.checked = Boolean(value); else control.value = value;
    });
    const close = () => { panel.hidden = true; document.body.classList.remove('adaptive-settings-open'); panel._returnFocus?.focus?.(); };
    panel.addEventListener('change', event => {
      const control = event.target.closest('[data-pref]');
      if (!control) return;
      session.setPreference(control.dataset.pref, control.type === 'checkbox' ? control.checked : control.value);
      if (control.dataset.pref === 'motionResponse') quality.setMode(control.value === 'static' || reducedQuery.matches ? 'static' : control.value === 'reduced' ? 'low-power' : 'balanced');
    });
    panel.querySelector('[data-adaptive-reset]').addEventListener('click', () => { session.reset(); recommendations.reset(); sync(); quality.setMode(reducedQuery.matches ? 'static' : 'balanced'); });
    panel.querySelector('[data-adaptive-close]').addEventListener('click', close);
    panel.addEventListener('click', event => { if (event.target === panel) close(); });
    panel.addEventListener('keydown', event => {
      if (event.key === 'Escape') { close(); return; }
      if (event.key !== 'Tab') return;
      const focusable = [...panel.querySelectorAll('button:not([disabled]),select:not([disabled]),input:not([disabled])')];
      const current = focusable.indexOf(document.activeElement);
      if (!focusable.length) return;
      if (event.shiftKey && current <= 0) { event.preventDefault(); focusable.at(-1).focus(); }
      else if (!event.shiftKey && current === focusable.length - 1) { event.preventDefault(); focusable[0].focus(); }
    });
    panel._sync = sync;
    return panel;
  };
  const openSettings = () => {
    const panel = ensurePanel();
    panel._returnFocus = document.activeElement;
    panel._sync();
    panel.hidden = false;
    document.body.classList.add('adaptive-settings-open');
    requestAnimationFrame(() => panel.querySelector('[data-adaptive-close]').focus());
  };

  window.openAdaptiveSettings = openSettings;
  window.adaptiveSession = session;
  window.ArcadeFabric = fabric;
  window.AdaptiveUI = {
    openSettings,
    getRecommendation: () => lastRecommendation,
    dismissRecommendation: key => { recommendations.dismiss(key); if (lastRecommendation?.key === key) lastRecommendation = null; }
  };
  session.record({ type: 'moduleOpened', detail: { moduleId } });
  idle.start();
  updateMode();
  return { session, idle, quality, fabric, openSettings, destroy() { abort.abort(); unsubscribe(); idle.stop(); fabric?.destroy(); clearTimeout(searchTimer); } };
}
