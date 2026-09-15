import { normalizeProjectSource } from '../knowledge/schema.js';

export function createGenericProjectAdapter({ source, getContext = () => ({}) } = {}) {
  const normalizedSource = normalizeProjectSource(source);
  return Object.freeze({
    id: `generic:${normalizedSource.id}`,
    kind: 'generic-project',
    getSources: () => [normalizedSource],
    getContext,
    executeAction: undefined
  });
}
