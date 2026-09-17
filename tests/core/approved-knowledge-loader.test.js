import test from 'node:test';
import assert from 'node:assert/strict';

import { loadApprovedKnowledge } from '../../src/index.js';

const catalog = {
  catalogVersion: '1.1.0',
  entries: [
    { id: 'approved-1', status: 'approved', path: 'knowledge/approved-1.json', updatedAt: '2026-09-17T03:30:00Z' },
    { id: 'draft-1', status: 'draft', path: 'knowledge/draft-1.json' },
    { id: 'unsafe-1', status: 'approved', path: 'knowledge/unsafe-1.json' }
  ]
};

const entries = [
  {
    id: 'approved-1',
    version: 1,
    sourceProject: 'prompt-aii',
    domain: 'projects',
    status: 'approved',
    title: 'Approved Prompt Pattern',
    summary: 'Sanitized pattern',
    content: 'Use explicit constraints and a clear output contract.',
    guidelines: ['Preserve user requirements'],
    evidence: ['test-evidence'],
    metadata: { sanitized: true, tags: ['prompt-engineering'] }
  },
  {
    id: 'draft-1',
    version: 1,
    sourceProject: 'prompt-aii',
    domain: 'projects',
    status: 'draft',
    title: 'Draft Pattern',
    content: 'Must not load',
    metadata: { sanitized: true }
  },
  {
    id: 'unsafe-1',
    version: 1,
    sourceProject: 'prompt-aii',
    domain: 'projects',
    status: 'approved',
    title: 'Unsafe Pattern',
    content: 'Must not load',
    metadata: { sanitized: false }
  }
];

test('approved knowledge loader accepts only approved sanitized catalog entries', () => {
  const result = loadApprovedKnowledge({ catalog, entries });

  assert.equal(result.catalogVersion, '1.1.0');
  assert.equal(result.loaded.length, 1);
  assert.equal(result.loaded[0].id, 'approved-1');
  assert.equal(result.loaded[0].metadata.sanitized, true);
  assert.equal(result.loaded[0].path, 'knowledge/approved-1.json');
  assert.equal(result.skipped.length, 2);
});

test('approved knowledge loader fails closed for invalid catalogs', () => {
  assert.throws(() => loadApprovedKnowledge({ catalog: null }), /requires a catalog object/);
});

test('approved knowledge loader does not activate or mutate entries', () => {
  const source = { ...entries[0], metadata: { ...entries[0].metadata } };
  const before = JSON.stringify(source);
  const result = loadApprovedKnowledge({ catalog, entries: [source] });

  assert.equal(JSON.stringify(source), before);
  assert.equal(Object.isFrozen(result.loaded[0]), true);
});
