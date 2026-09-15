import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeText,
  tokenize,
  detectLanguage,
  clampScore,
  tokenOverlapScore,
  scoreAliases,
  ContextResolver
} from '../../src/index.js';

test('normalizeText handles accents, Hinglish replacements, and punctuation', () => {
  const input = 'Batao kaunsa tool chahiye?';
  const normalized = normalizeText(input);
  assert.equal(normalized, 'tell which tool need');

  const apostrophes = "it’s a 'test'";
  assert.equal(normalizeText(apostrophes), "it's a 'test'");
});

test('tokenize splits and filters empty tokens', () => {
  const tokens = tokenize('  hello   world  ');
  assert.deepEqual(tokens, ['hello', 'world']);
  assert.deepEqual(tokenize(''), []);
  assert.deepEqual(tokenize(null), []);
});

test('detectLanguage classifies scripts and vocabularies accurately', () => {
  assert.equal(detectLanguage('Reply in Hindi').language, 'hi');
  assert.equal(detectLanguage('Reply in Hinglish').language, 'hinglish');
  assert.equal(detectLanguage('Reply in English').language, 'en');

  // Devanagari script
  assert.equal(detectLanguage('नमस्ते दुनिया').language, 'hi');

  // Hinglish vocabulary
  assert.equal(detectLanguage('mujhe yeh wala tool chahiye').language, 'hinglish');

  // Default English
  assert.equal(detectLanguage('Show me the architecture of the system').language, 'en');
});

test('clampScore correctly bounds numeric values', () => {
  assert.equal(clampScore(-0.5), 0);
  assert.equal(clampScore(1.5), 1);
  assert.equal(clampScore(0.75), 0.75);
  assert.equal(clampScore('invalid'), 0);
});

test('tokenOverlapScore computes correct fractional overlap', () => {
  const score = tokenOverlapScore('image compress', 'compress image tool');
  assert.ok(score > 0.5);
  assert.equal(tokenOverlapScore('', 'anything'), 0);
  assert.equal(tokenOverlapScore('anything', ''), 0);
});

test('scoreAliases prioritizes exact match over partial', () => {
  const exact = scoreAliases('shift zero', ['shift zero', 'sz']);
  const partial = scoreAliases('shift', ['shift zero', 'sz']);
  assert.equal(exact, 1);
  assert.ok(exact > partial);
});

test('ContextResolver remembers, snapshots, and resets context state', () => {
  const resolver = new ContextResolver();
  resolver.remember({ intent: 'project_lookup', projectId: 'shift-zero' });

  const snap = resolver.snapshot();
  assert.equal(snap.lastProjectId, 'shift-zero');
  assert.equal(snap.lastIntent, 'project_lookup');

  const resolved = resolver.resolve({ query: 'tell me about it' });
  assert.equal(resolved.followUp, true);
  assert.equal(resolved.projectId, 'shift-zero');

  resolver.reset();
  const resetSnap = resolver.snapshot();
  assert.equal(resetSnap.lastProjectId, null);
  assert.equal(resetSnap.lastIntent, null);
});
