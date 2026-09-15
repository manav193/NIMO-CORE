import { tokenize } from './normalize-text.js';

export function tokenOverlapScore(query, candidate) {
  const queryTokens = new Set(tokenize(query));
  const candidateTokens = new Set(tokenize(candidate));
  if (!queryTokens.size || !candidateTokens.size) return 0;
  let matches = 0;
  candidateTokens.forEach(token => { if (queryTokens.has(token)) matches += 1; });
  return matches / Math.max(candidateTokens.size, 1);
}

export function scoreAliases(query, aliases = []) {
  const normalizedQuery = String(query || '');
  return aliases.reduce((best, alias) => {
    const normalizedAlias = String(alias || '').toLowerCase();
    if (!normalizedAlias) return best;
    if (normalizedQuery === normalizedAlias) return Math.max(best, 1);
    if (normalizedQuery.includes(normalizedAlias)) return Math.max(best, 0.92);
    return Math.max(best, tokenOverlapScore(normalizedQuery, normalizedAlias) * 0.72);
  }, 0);
}

export function clampScore(value) {
  return Math.min(Math.max(Number(value) || 0, 0), 1);
}
