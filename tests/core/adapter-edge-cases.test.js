import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createNimoEngine,
  createArcadeOsAdapter,
  createToolVerseAdapter,
  createGenericProjectAdapter,
  KnowledgeValidationError
} from '../../src/index.js';

test('broken adapter with throwing getContext does not crash NimoEngine', () => {
  const brokenAdapter = {
    id: 'broken',
    getSources: () => [],
    getContext: () => {
      throw new Error('Adapter internal state corruption');
    }
  };

  const engine = createNimoEngine({ adapters: [brokenAdapter] });
  const response = engine.respond('Who are you?');
  assert.equal(response.intent, 'identity');
  assert.ok(typeof response.text === 'string');
});

test('adapter with null or non-function getSources is handled safely', () => {
  const invalidAdapter = {
    id: 'invalid',
    getSources: null
  };

  const engine = createNimoEngine({ adapters: [invalidAdapter, null, undefined] });
  assert.ok(engine);
  const response = engine.respond('Who are you?');
  assert.equal(response.intent, 'identity');
});

test('ToolVerse adapter rejects invalid manifest schema', () => {
  assert.throws(() => {
    createToolVerseAdapter({});
  }, KnowledgeValidationError);

  assert.throws(() => {
    createToolVerseAdapter({ version: '1.0.0', tools: 'not an array' });
  }, KnowledgeValidationError);

  assert.throws(() => {
    createToolVerseAdapter({
      version: '1.0.0',
      tools: [{ id: 't1', name: 'T1' }] // missing description and route
    });
  }, KnowledgeValidationError);
});

test('Arcade OS adapter safely defaults with empty options', () => {
  const adapter = createArcadeOsAdapter();
  assert.equal(adapter.id, 'arcade-os');
  const sources = adapter.getSources();
  assert.equal(sources.length, 1);
  assert.equal(sources[0].projects.length, 0);
});

test('Generic project adapter preserves custom context', () => {
  const source = {
    id: 'custom-src',
    version: '1.0.0',
    projects: [{ id: 'p1', name: 'Project 1', summary: 'Summary 1' }]
  };
  const adapter = createGenericProjectAdapter({
    source,
    getContext: () => ({ customKey: 'customValue' })
  });
  const engine = createNimoEngine({ adapters: [adapter] });
  const response = engine.respond('Tell me about Project 1');
  assert.equal(response.entity?.id, 'p1');
});
