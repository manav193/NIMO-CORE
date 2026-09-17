import test from 'node:test';
import assert from 'node:assert/strict';

import {
  canActivatePromptAiiKnowledge,
  resolveActivatedPromptAiiKnowledge,
} from '../src/knowledge/prompt-aii-activation.js';
import { buildPromptAiiStrategy } from '../src/knowledge/prompt-aii-strategy.js';

const approvedManifest = {
  knowledgeEntryId: 'kno-20260917-prompt-aii-deep-prompt-engineering',
  sourceProject: 'prompt-aii',
  status: 'approved',
  version: 1,
  knowledgePath: 'knowledge/projects/prompt-aii-deep-prompt-engineering.json',
  approvedBy: 'foundation-reviewer',
  sanitized: true,
  catalogVersion: '1.1.0',
};

const catalog = {
  catalogVersion: '1.1.0',
  entries: [{
    id: approvedManifest.knowledgeEntryId,
    status: 'approved',
    version: 1,
    path: approvedManifest.knowledgePath,
  }],
};

const entry = {
  id: approvedManifest.knowledgeEntryId,
  version: 1,
  sourceProject: 'prompt-aii',
  title: 'Deep Prompt Engineering',
  summary: 'Approved Prompt-Aii prompting guidance.',
  content: 'Use model-aware structure and preserve explicit intent.',
  guidelines: ['Preserve explicit intent.', 'Adapt structure to the target model.'],
  evidence: ['human-reviewed'],
  status: 'approved',
  metadata: { sanitized: true },
};

test('Prompt-Aii activation accepts approved sanitized knowledge only', () => {
  assert.equal(canActivatePromptAiiKnowledge(approvedManifest), true);
  assert.equal(canActivatePromptAiiKnowledge({ ...approvedManifest, status: 'proposed' }), false);
  assert.equal(canActivatePromptAiiKnowledge({ ...approvedManifest, sanitized: false }), false);
});

test('Prompt-Aii activation requires the catalog-selected entry to match', () => {
  const resolved = resolveActivatedPromptAiiKnowledge({
    manifest: approvedManifest,
    catalog,
    entries: [entry],
  });
  assert.equal(resolved.entry.id, approvedManifest.knowledgeEntryId);
  assert.equal(resolved.entry.version, 1);
  assert.equal(Object.isFrozen(resolved), true);
});

test('Prompt-Aii strategy projection is bounded and governance-preserving', () => {
  const strategy = buildPromptAiiStrategy(entry);
  assert.equal(strategy.sourceProject, 'prompt-aii');
  assert.equal(strategy.knowledgeEntryId, entry.id);
  assert.equal(strategy.status, 'approved');
  assert.deepEqual(strategy.guidelines, entry.guidelines);
  assert.ok(strategy.summary.length > 0);
  assert.ok(strategy.guidelines.length <= 12);
});

test('Prompt-Aii activation rejects a mismatched knowledge path', () => {
  assert.throws(() => resolveActivatedPromptAiiKnowledge({
    manifest: approvedManifest,
    catalog,
    entries: [{ ...entry, id: 'kno-other-entry' }],
  }), /not available/);
});
