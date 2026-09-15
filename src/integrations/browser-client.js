export function createBrowserClient({ engine, executeAction, remoteFallback } = {}) {
  if (!engine || typeof engine.respond !== 'function') throw new TypeError('A NIMO engine is required.');
  return Object.freeze({
    async ask(input, context = {}) {
      const local = engine.respond(input, context);
      if (local.intent !== 'fallback' || typeof remoteFallback !== 'function') return local;
      try {
        const remote = await remoteFallback({ input, context, local });
        return remote && typeof remote === 'object' ? remote : local;
      } catch {
        return local;
      }
    },
    execute(action) {
      if (typeof executeAction !== 'function') return { executed: false, action };
      try {
        const result = executeAction(action);
        return { executed: true, result, action };
      } catch (error) {
        return { executed: false, error: error?.message || 'Execution failed', action };
      }
    }
  });
}
