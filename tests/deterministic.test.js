import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveDeterministicReply } from '../src/services/deterministic.js';

test('resolveDeterministicReply answers exact technology ownership without a provider call', () => {
  const result = resolveDeterministicReply('Which project uses Playwright?', []);
  assert.deepEqual(result, {
    reply: 'ToolVerse uses Playwright.',
    source: 'deterministic_technology'
  });
});

test('resolveDeterministicReply returns a project technology stack for direct factual questions', () => {
  const result = resolveDeterministicReply('What technology does SHIFT-ZERO use?', []);
  assert.match(result?.reply || '', /Godot 4/);
  assert.equal(result?.source, 'deterministic_project_stack');
});

test('resolveDeterministicReply does not intercept contextual follow-up conversations', () => {
  const history = [{ role: 'user', content: 'Compare ToolVerse and SHIFT-ZERO' }];
  assert.equal(resolveDeterministicReply('Which one uses Godot?', history), null);
});
