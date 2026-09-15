import test from 'node:test';
import assert from 'node:assert/strict';
import { createKnowledgeRegistry, DuplicateKnowledgeError, KnowledgeValidationError } from '../../src/index.js';

const validSource = { id: 'one', version: '1.0.0', projects: [{ id: 'demo', name: 'Demo', summary: 'A demo project.' }] };

test('rejects a malformed knowledge source atomically', () => {
  const registry = createKnowledgeRegistry();
  assert.throws(() => registry.registerProjectSource({ id: 'broken', version: '1.0.0', projects: [{ id: 'Bad ID' }] }), KnowledgeValidationError);
  assert.equal(registry.list().length, 0);
});

test('rejects duplicate project registration', () => {
  const registry = createKnowledgeRegistry();
  registry.registerProjectSource(validSource);
  assert.throws(() => registry.registerProjectSource({ id: 'two', version: '1.0.0', projects: [{ id: 'demo', name: 'Other', summary: 'Duplicate.' }] }), DuplicateKnowledgeError);
  assert.equal(registry.list().length, 1);
});
