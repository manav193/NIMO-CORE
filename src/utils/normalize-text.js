const HINGLISH_REPLACEMENTS = new Map([
  ['konsa', 'which'], ['kaunsa', 'which'], ['kaun sa', 'which'],
  ['batao', 'tell'], ['bata', 'tell'], ['dikhao', 'show'],
  ['kholo', 'open'], ['khol do', 'open'], ['chahiye', 'need'],
  ['kaam karta hai', 'works'], ['local hai', 'works locally'],
  ['iske baare me', 'about this'], ['iske baare mein', 'about this']
]);

export function normalizeText(value) {
  let text = String(value ?? '').normalize('NFKC').toLowerCase().trim();
  for (const [source, target] of HINGLISH_REPLACEMENTS) {
    text = text.replace(new RegExp(`\\b${source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g'), target);
  }
  return text
    .replace(/[’‘]/g, "'")
    .replace(/[^\p{L}\p{N}%+.#'\-/]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokenize(value) {
  return normalizeText(value).split(' ').filter(Boolean);
}
