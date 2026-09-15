export function createIdleController({ softMs = 25000, deepMs = 105000, onChange = () => {}, timers = globalThis } = {}) {
  let softTimer = null;
  let deepTimer = null;
  let state = 'active';
  let started = false;
  const clear = () => { if (softTimer) timers.clearTimeout(softTimer); if (deepTimer) timers.clearTimeout(deepTimer); softTimer = deepTimer = null; };
  const enter = next => { if (state === next) return; state = next; onChange(next); };
  const schedule = () => {
    clear();
    softTimer = timers.setTimeout(() => enter('soft-idle'), softMs);
    deepTimer = timers.setTimeout(() => enter('deep-idle'), deepMs);
  };
  return {
    start() { if (started) return; started = true; schedule(); },
    activity() { const waking = state !== 'active'; state = 'active'; if (waking) onChange('active'); if (started) schedule(); },
    pause() { clear(); },
    resume() { if (started) schedule(); },
    stop() { started = false; clear(); state = 'active'; },
    getState: () => state
  };
}
