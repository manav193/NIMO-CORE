export function createArcadeFabric({ container, reducedMotion = false, onFrame = () => {} } = {}) {
  if (!container || typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.className = 'arcade-fabric__canvas';
  canvas.setAttribute('aria-hidden', 'true');
  container.replaceChildren(canvas);
  const context = canvas.getContext('2d', { alpha: true });
  let width = 1, height = 1, frame = 0, last = performance.now(), running = false, quality = reducedMotion ? 'static' : 'balanced';
  let energy = 0.14, targetEnergy = 0.14, focusX = 0.62, focusY = 0.38;
  const qualityStep = () => quality === 'full' ? 18 : quality === 'balanced' ? 26 : 38;
  const resize = () => {
    const ratio = Math.min(devicePixelRatio || 1, quality === 'full' ? 1.5 : 1);
    width = innerWidth; height = innerHeight;
    canvas.width = Math.max(1, Math.round(width * ratio)); canvas.height = Math.max(1, Math.round(height * ratio));
    canvas.style.width = `${width}px`; canvas.style.height = `${height}px`; context.setTransform(ratio, 0, 0, ratio, 0, 0);
  };
  const draw = time => {
    const frameMs = Math.min(50, time - last); last = time; onFrame(frameMs);
    energy += (targetEnergy - energy) * 0.035; targetEnergy += (0.1 - targetEnergy) * 0.012;
    context.clearRect(0, 0, width, height);
    const step = qualityStep();
    context.lineWidth = 0.65;
    for (let y = -step; y < height + step; y += step) {
      context.beginPath();
      for (let x = -step; x <= width + step; x += step / 2) {
        const dx = x / width - focusX, dy = y / height - focusY;
        const influence = Math.exp(-(dx * dx + dy * dy) * 7) * energy * 24;
        const offset = Math.sin(x * 0.012 + y * 0.006 + time * 0.00012) * (1.1 + influence);
        x === -step ? context.moveTo(x, y + offset) : context.lineTo(x, y + offset);
      }
      context.strokeStyle = `rgba(120, 105, 210, ${0.035 + energy * 0.025})`; context.stroke();
    }
    for (let x = -step; x < width + step; x += step) {
      context.beginPath();
      for (let y = -step; y <= height + step; y += step / 2) {
        const dx = x / width - focusX, dy = y / height - focusY;
        const influence = Math.exp(-(dx * dx + dy * dy) * 7) * energy * 18;
        const offset = Math.cos(y * 0.011 + x * 0.005 + time * 0.0001) * (0.8 + influence);
        y === -step ? context.moveTo(x + offset, y) : context.lineTo(x + offset, y);
      }
      context.strokeStyle = `rgba(72, 118, 190, ${0.025 + energy * 0.02})`; context.stroke();
    }
    frame++;
    if (running) requestAnimationFrame(draw);
  };
  const start = () => { if (running || quality === 'static') return; running = true; last = performance.now(); requestAnimationFrame(draw); };
  const stop = () => { running = false; };
  const setQuality = next => { quality = next; container.dataset.quality = next; next === 'static' ? stop() : start(); resize(); if (next === 'static') draw(performance.now()); };
  const disturb = (x = .5, y = .5, options = {}) => { if (quality === 'static') return; focusX = Math.max(0, Math.min(1, x)); focusY = Math.max(0, Math.min(1, y)); targetEnergy = Math.min(.8, targetEnergy + (options.intensity || .18)); };
  const emit = (type, detail = {}) => {
    const intensity = /repair|boot/i.test(type) ? .26 : /search|nimo|module/i.test(type) ? .18 : .1;
    disturb(Number(detail.x) || .5, Number(detail.y) || .45, { intensity });
  };
  const focus = target => {
    if (!target?.getBoundingClientRect) return;
    const rect = target.getBoundingClientRect();
    disturb((rect.left + rect.width / 2) / width, (rect.top + rect.height / 2) / height, { intensity: .08 });
  };
  resize();
  const resizeListener = () => resize();
  addEventListener('resize', resizeListener, { passive: true });
  setQuality(quality);
  return { emit, disturb, focus, reset() { energy = targetEnergy = .1; focusX = .62; focusY = .38; }, setQuality, pause: stop, resume: start, destroy() { stop(); removeEventListener('resize', resizeListener); canvas.remove(); } };
}
