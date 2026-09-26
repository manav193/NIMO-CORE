export class EventBus {
  #handlers = new Map();

  on(type, handler) {
    if (typeof handler !== 'function') throw new TypeError('Event handler must be a function.');
    const key = String(type || '*').trim();
    const set = this.#handlers.get(key) || new Set();
    set.add(handler);
    this.#handlers.set(key, set);
    return () => set.delete(handler);
  }

  async emit(event) {
    const type = String(event?.type || '').trim();
    const handlers = [
      ...(this.#handlers.get(type) || []),
      ...(this.#handlers.get('*') || [])
    ];
    const results = [];
    for (const handler of handlers) {
      try { results.push(await handler(event)); }
      catch (error) { results.push({ ok: false, error: error?.message || 'handler_failed' }); }
    }
    return results;
  }
}

export function createEventBus() {
  return new EventBus();
}
