const ORDER = ['static', 'low-power', 'balanced', 'full'];
export function createQualityManager({ reducedMotion = false, saveData = false, memory = null, onChange = () => {}, now = Date.now } = {}) {
  let mode = reducedMotion ? 'static' : (saveData || (memory && memory <= 4) ? 'low-power' : 'balanced');
  let slowFrames = 0;
  let goodFrames = 0;
  let lastChange = now();
  const set = next => {
    if (!ORDER.includes(next) || next === mode) return mode;
    mode = next; lastChange = now(); slowFrames = 0; goodFrames = 0; onChange(mode); return mode;
  };
  const sample = frameMs => {
    if (reducedMotion) return set('static');
    if (frameMs > 24) { slowFrames++; goodFrames = 0; } else if (frameMs < 18) { goodFrames++; slowFrames = Math.max(0, slowFrames - 1); }
    if (slowFrames >= 45) return set(mode === 'full' ? 'balanced' : 'low-power');
    if (goodFrames >= 360 && now() - lastChange > 15000 && !saveData) return set(mode === 'low-power' ? 'balanced' : 'full');
    return mode;
  };
  return { sample, setMode: set, getMode: () => mode, setHidden(hidden) { return hidden ? set('static') : mode; } };
}
