import test from 'node:test';
import assert from 'node:assert/strict';

import {
  EVENT_TYPES,
  OUTCOMES,
  createInMemoryLearningStore,
  createPromptAiiLearningEvent,
  evaluatePromptAiiLearningStore,
  serializePromptAiiProposals
} from '../../src/index.js';

test('Prompt-Aii learning observations evaluate into reviewable proposals without activation', async () => {
  const store = createInMemoryLearningStore();

  for (let i = 0; i < 3; i += 1) {
    await store.record(createPromptAiiLearningEvent({
      requestId: `req-${i}`,
      input: 'ignored raw prompt',
      intent: 'image_generation',
      project: 'prompt-aii',
      language: 'en',
      outcome: OUTCOMES.FAILURE,
      responseMetadata: {
        target: 'midjourney',
        model: 'midjourney',
        category: 'image',
        strategy: 'model-specific'
      }
    }));
  }

  const proposals = await evaluatePromptAiiLearningStore(store, { minEvidenceCount: 3 });
  assert.equal(proposals.length, 1);
  assert.equal(proposals[0].status, 'PROPOSED');
  assert.match(proposals[0].target, /^prompt-aii:midjourney$/);

  const reviewArtifacts = serializePromptAiiProposals(proposals);
  assert.equal(reviewArtifacts.length, 1);
  assert.equal(reviewArtifacts[0].sourceProject, 'prompt-aii');
  assert.equal(reviewArtifacts[0].metadata.requiresHumanReview, true);
  assert.equal(reviewArtifacts[0].metadata.knowledgeEntryPath, null);
});

test('Prompt-Aii evaluation ignores unrelated and insufficient observations', async () => {
  const store = createInMemoryLearningStore();

  await store.record({
    eventType: EVENT_TYPES.INTERACTION_FAILURE,
    project: 'other-project',
    outcome: OUTCOMES.FAILURE,
    responseMetadata: { target: 'other-model' }
  });
  await store.record(createPromptAiiLearningEvent({
    requestId: 'prompt-aii-success',
    input: 'ignored raw prompt',
    intent: 'text_generation',
    project: 'prompt-aii',
    outcome: OUTCOMES.SUCCESS,
    responseMetadata: { target: 'chatgpt' }
  }));

  const proposals = await evaluatePromptAiiLearningStore(store, { minEvidenceCount: 3 });
  assert.deepEqual(proposals, []);
});
