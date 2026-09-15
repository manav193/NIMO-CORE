import { normalizeText } from './utils/normalize-text.js';

const HINGLISH_WORDS = new Set(['kya', 'kaise', 'kaunsa', 'konsa', 'batao', 'dikhao', 'kholo', 'chahiye', 'hai', 'karna', 'mujhe', 'wala', 'wali']);

export function detectLanguage(input) {
  const raw = String(input ?? '');
  const rawWords = raw.toLowerCase().normalize('NFKC').replace(/[^\p{L}\p{N}]+/gu, ' ').trim().split(/\s+/);
  const normalized = normalizeText(raw);
  const explicit = /(?:reply|answer|baat)\s+(?:in\s+)?hindi/.test(normalized)
    ? 'hi'
    : /(?:reply|answer|baat)\s+(?:in\s+)?hinglish/.test(normalized)
      ? 'hinglish'
      : /(?:reply|answer)\s+(?:in\s+)?english/.test(normalized)
        ? 'en'
        : null;
  if (explicit) return { language: explicit, confidence: 1, explicit: true };
  if (/\p{Script=Devanagari}/u.test(raw)) return { language: 'hi', confidence: 0.98, explicit: false };
  const hits = rawWords.filter(word => HINGLISH_WORDS.has(word)).length;
  if (hits >= 1) return { language: 'hinglish', confidence: Math.min(0.65 + hits * 0.08, 0.95), explicit: false };
  return { language: 'en', confidence: 0.82, explicit: false };
}

export default detectLanguage;
