import test from 'node:test';
import assert from 'node:assert/strict';

import {
  EVENT_TYPES,
  LearningEvent,
  createLearningEvent,
  sanitizeMetadata,
  extractSafeInputMetadata,
  extractSafeResponseMetadata,
  OUTCOMES,
  isOutcomeValid,
  normalizeFeedback,
  classifyOutcome,
  InMemoryLearningStore,
  createInMemoryLearningStore,
  PROPOSAL_CATEGORIES,
  PROPOSAL_STATUSES,
  ImprovementProposal,
  EvaluationEngine,
  createEvaluationEngine,
  KNOWLEDGE_VERSION_STATUSES,
  KnowledgeVersion,
  KnowledgeVersionManager,
  createKnowledgeVersionManager,
  createNimoEngine,
  createGenericProjectAdapter,
  ARCADE_OS_PROJECTS_SOURCE
} from '../../src/index.js';

test('LearningEvent creates immutable valid record and enforces schema', () => {
  const event = createLearningEvent({
    eventType: EVENT_TYPES.INTERACTION_SUCCESS,
    source: 'core',
    intent: 'project_lookup',
    project: 'shift-zero',
    language: 'en',
    outcome: OUTCOMES.SUCCESS,
    latency: 15
  });

  assert.ok(event.id);
  assert.ok(event.timestamp);
  assert.equal(event.eventType, EVENT_TYPES.INTERACTION_SUCCESS);
  assert.equal(event.source, 'core');
  assert.equal(event.intent, 'project_lookup');
  assert.equal(event.project, 'shift-zero');
  assert.equal(event.outcome, 'SUCCESS');
  assert.equal(event.latency, 15);

  // Immutability checks
  assert.ok(Object.isFrozen(event));
  assert.throws(() => {
    event.outcome = 'FAILURE';
  });

  // Rejection on invalid fields
  assert.throws(() => {
    new LearningEvent({ id: null });
  }, TypeError);

  assert.throws(() => {
    new LearningEvent({ eventType: '' });
  }, TypeError);
});

test('LearningEvent rejects oversized payloads exceeding 16KB', () => {
  const hugeMeta = {};
  for (let i = 0; i < 40; i++) {
    hugeMeta[`key_${i}`] = 'x'.repeat(500);
  }
  assert.throws(() => {
    createLearningEvent({
      eventType: EVENT_TYPES.INTERACTION_SUCCESS,
      inputMetadata: hugeMeta
    });
  }, RangeError);
});

test('sanitizeMetadata filters secrets, tokens, passwords, and bearer credentials', () => {
  const dirty = {
    apiKey: 'sk-or-v1-secret1234567890',
    token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
    userPassword: 'SuperSecretPassword!',
    authorization: 'Bearer secret_token_value_abc_123',
    safeField: 'normal string value',
    nested: {
      clientSecret: 'secret_value',
      innerNormal: 42
    },
    userNote: 'Call with Bearer xyz987654321 now'
  };

  const clean = sanitizeMetadata(dirty);

  assert.equal(clean.apiKey, '[REDACTED]');
  assert.equal(clean.token, '[REDACTED]');
  assert.equal(clean.userPassword, '[REDACTED]');
  assert.equal(clean.authorization, '[REDACTED]');
  assert.equal(clean.safeField, 'normal string value');
  assert.equal(clean.nested.clientSecret, '[REDACTED]');
  assert.equal(clean.nested.innerNormal, 42);
  assert.equal(clean.userNote, '[REDACTED_CREDENTIAL]');
});

test('extractSafeInputMetadata derives structural metadata without saving raw PII text', () => {
  const query = 'How do I resize a PNG image using ToolVerse?';
  const meta = extractSafeInputMetadata(query);

  assert.equal(meta.length, query.length);
  assert.equal(meta.wordCount, 9);
  assert.equal(meta.hasCode, false);
  assert.equal(meta.isQuestion, true);
  assert.equal(meta.text, undefined); // Never extracts raw query string
});

test('extractSafeResponseMetadata summarizes output without leaking credentials', () => {
  const response = {
    text: 'Compress Image reduces PNG file sizes locally.',
    intent: 'recommendation',
    entity: { id: 'compress-image' },
    recommendations: [{ id: 'compress-image' }],
    actions: [{ type: 'navigate' }],
    language: 'en'
  };

  const meta = extractSafeResponseMetadata(response);
  assert.equal(meta.length, response.text.length);
  assert.equal(meta.intent, 'recommendation');
  assert.equal(meta.entityId, 'compress-image');
  assert.equal(meta.recommendationCount, 1);
  assert.equal(meta.actionCount, 1);
  assert.equal(meta.language, 'en');
});

test('classifyOutcome detects explicit feedback, errors, corrections, and defaults to UNKNOWN', () => {
  // Error outcome
  assert.equal(classifyOutcome({ error: new Error('boom') }), OUTCOMES.FAILURE);
  assert.equal(classifyOutcome({ executionFailed: true }), OUTCOMES.FAILURE);

  // Abandonment
  assert.equal(classifyOutcome({ userSignal: 'abandoned' }), OUTCOMES.ABANDONED);

  // User correction
  assert.equal(classifyOutcome({ userSignal: 'correction' }), OUTCOMES.CORRECTED);
  assert.equal(classifyOutcome({ feedback: { correction: 'No, I meant the other project' } }), OUTCOMES.CORRECTED);

  // User rating
  assert.equal(classifyOutcome({ feedback: { rating: 1 } }), OUTCOMES.SUCCESS);
  assert.equal(classifyOutcome({ feedback: { rating: -1 } }), OUTCOMES.FAILURE);
  assert.equal(classifyOutcome({ feedback: { satisfied: true } }), OUTCOMES.SUCCESS);
  assert.equal(classifyOutcome({ feedback: { satisfied: false } }), OUTCOMES.FAILURE);

  // Fallback decision
  assert.equal(classifyOutcome({ fallbackTriggered: true }), OUTCOMES.UNKNOWN);
  assert.equal(classifyOutcome({ intent: 'fallback' }), OUTCOMES.UNKNOWN);

  // Default when no reliable signal exists
  assert.equal(classifyOutcome({ intent: 'project_lookup' }), OUTCOMES.UNKNOWN);
});

test('normalizeFeedback validates ratings and bounds comment lengths', () => {
  assert.equal(normalizeFeedback(null), null);

  const clean = normalizeFeedback({
    rating: 5, // should clamp to 1
    satisfied: true,
    comment: 'Great assistance! ' + 'x'.repeat(1000)
  });

  assert.equal(clean.rating, 1);
  assert.ok(clean.comment.length <= 512);
  assert.ok(Object.isFrozen(clean));
});

test('isOutcomeValid validates outcome strings correctly', () => {
  assert.equal(isOutcomeValid('SUCCESS'), true);
  assert.equal(isOutcomeValid('failure'), true);
  assert.equal(isOutcomeValid('UNKNOWN'), true);
  assert.equal(isOutcomeValid('CORRECTED'), true);
  assert.equal(isOutcomeValid('ABANDONED'), true);
  assert.equal(isOutcomeValid('MAGICAL_GUESS'), false);
});

test('InMemoryLearningStore records, queries with multi-indexing, and limits capacity', async () => {
  const store = createInMemoryLearningStore({ maxCapacity: 5 });

  for (let i = 1; i <= 7; i++) {
    await store.record({
      id: `evt-${i}`,
      eventType: i % 2 === 0 ? EVENT_TYPES.INTERACTION_SUCCESS : EVENT_TYPES.INTERACTION_FAILURE,
      intent: i % 2 === 0 ? 'project_lookup' : 'fallback',
      project: i === 2 ? 'shift-zero' : 'toolverse',
      outcome: i % 2 === 0 ? OUTCOMES.SUCCESS : OUTCOMES.FAILURE
    });
  }

  // FIFO pruning: only last 5 remain (evt-3 to evt-7)
  assert.equal(store.size, 5);

  const recent = await store.getRecent(3);
  assert.equal(recent.length, 3);
  assert.equal(recent[0].id, 'evt-7');
  assert.equal(recent[1].id, 'evt-6');
  assert.equal(recent[2].id, 'evt-5');

  // Index queries
  const fallbackEvents = await store.getByIntent('fallback', 10);
  assert.ok(fallbackEvents.every(e => e.intent === 'fallback'));

  const failures = await store.getFailures(10);
  assert.ok(failures.every(e => e.outcome === 'FAILURE'));

  const successes = await store.getSuccessfulPatterns(10);
  assert.ok(successes.every(e => e.outcome === 'SUCCESS'));

  // Counts with filter
  const failureCount = await store.count({ outcome: OUTCOMES.FAILURE });
  assert.equal(failureCount, failures.length);

  // Clear
  await store.clear();
  assert.equal(store.size, 0);
  assert.equal((await store.getRecent()).length, 0);
});

test('EvaluationEngine generates structured proposals without modifying code or config', async () => {
  const store = createInMemoryLearningStore();

  // Seed events that show a fallback spike
  for (let i = 0; i < 4; i++) {
    await store.record({
      eventType: EVENT_TYPES.AI_FALLBACK,
      intent: 'fallback',
      outcome: OUTCOMES.UNKNOWN
    });
  }

  // Seed events that show user corrections for a project
  for (let i = 0; i < 3; i++) {
    await store.record({
      eventType: EVENT_TYPES.USER_CORRECTION,
      project: 'arcade-os',
      outcome: OUTCOMES.CORRECTED
    });
  }

  // Seed model failures
  for (let i = 0; i < 4; i++) {
    await store.record({
      eventType: EVENT_TYPES.AI_FAILURE,
      source: 'openrouter',
      modelMetadata: { model: 'unstable-model:free' },
      outcome: OUTCOMES.FAILURE,
      latency: 9000
    });
  }

  const engine = createEvaluationEngine({ store, minEvidenceCount: 3 });
  const proposals = await engine.evaluate();

  assert.ok(proposals.length >= 2);

  const intentProposal = proposals.find(p => p.category === PROPOSAL_CATEGORIES.INTENT_ROUTING);
  assert.ok(intentProposal);
  assert.equal(intentProposal.status, PROPOSAL_STATUSES.PROPOSED);
  assert.ok(intentProposal.confidence > 0);

  const knowledgeProposal = proposals.find(p => p.category === PROPOSAL_CATEGORIES.KNOWLEDGE_UPDATE);
  assert.ok(knowledgeProposal);
  assert.match(knowledgeProposal.target, /arcade-os/);

  const modelProposal = proposals.find(p => p.category === PROPOSAL_CATEGORIES.MODEL_ROUTING);
  assert.ok(modelProposal);
  assert.match(modelProposal.target, /unstable-model:free/);

  // Verify status update workflow
  const updated = engine.updateProposalStatus(intentProposal.proposalId, PROPOSAL_STATUSES.TESTING);
  assert.equal(updated.status, PROPOSAL_STATUSES.TESTING);

  // Verify immutability
  assert.throws(() => {
    updated.status = PROPOSAL_STATUSES.APPROVED;
  });
});

test('KnowledgeVersionManager enforces DRAFT -> EVALUATED -> APPROVED -> ACTIVE lifecycle and rollback', () => {
  const manager = createKnowledgeVersionManager();

  // 1. Create Draft
  const draft = manager.createDraft({
    version: '1.1.0',
    source: 'portfolio-projects',
    changes: [{ id: 'new-project', name: 'New Project' }],
    evidence: ['prop-123']
  });

  assert.equal(draft.status, KNOWLEDGE_VERSION_STATUSES.DRAFT);

  // Cannot activate directly from DRAFT
  assert.throws(() => {
    manager.activate('1.1.0');
  }, /Must be APPROVED/);

  // 2. Evaluate
  const evaluated = manager.evaluate('1.1.0', { benchmarkScore: 0.98 });
  assert.equal(evaluated.status, KNOWLEDGE_VERSION_STATUSES.EVALUATED);
  assert.equal(evaluated.evaluation.benchmarkScore, 0.98);

  // 3. Approve
  const approved = manager.approve('1.1.0');
  assert.equal(approved.status, KNOWLEDGE_VERSION_STATUSES.APPROVED);

  // 4. Activate
  const active = manager.activate('1.1.0');
  assert.equal(active.status, KNOWLEDGE_VERSION_STATUSES.ACTIVE);
  assert.equal(manager.getActive('portfolio-projects').version, '1.1.0');

  // 5. Create version 1.2.0 and activate it
  manager.createDraft({ version: '1.2.0', source: 'portfolio-projects' });
  manager.evaluate('1.2.0');
  manager.approve('1.2.0');
  manager.activate('1.2.0');
  assert.equal(manager.getActive('portfolio-projects').version, '1.2.0');

  // 6. Rollback to 1.1.0
  const rollbackResult = manager.rollback('portfolio-projects', '1.1.0');
  assert.equal(rollbackResult.rolledBackFrom.version, '1.2.0');
  assert.equal(rollbackResult.rolledBackFrom.status, KNOWLEDGE_VERSION_STATUSES.ROLLED_BACK);
  assert.equal(rollbackResult.activeVersion.version, '1.1.0');
  assert.equal(rollbackResult.activeVersion.status, KNOWLEDGE_VERSION_STATUSES.ACTIVE);
  assert.equal(manager.getActive('portfolio-projects').version, '1.1.0');

  // History includes both versions
  const history = manager.getHistory('portfolio-projects');
  assert.equal(history.length, 2);
});

test('NimoEngine records learning events without blocking or breaking on store failure', async () => {
  const store = createInMemoryLearningStore();
  const events = [];

  const engine = createNimoEngine({
    adapters: [createGenericProjectAdapter({ source: ARCADE_OS_PROJECTS_SOURCE })],
    learningStore: store,
    onEvent: (evt) => events.push(evt)
  });

  // Normal request
  const response = engine.respond('Tell me about NIMO');
  assert.equal(response.intent, 'project_lookup');

  // Wait a microtask for async record resolution
  await new Promise(r => setTimeout(r, 10));

  assert.equal(events.length, 1);
  assert.equal(events[0].intent, 'project_lookup');
  assert.equal(events[0].outcome, OUTCOMES.SUCCESS);
  assert.equal(await store.count(), 1);

  // Fault Isolation: Broken store must NEVER crash respond()
  const brokenStore = {
    record: () => {
      throw new Error('Simulated database explosion');
    }
  };

  const isolatedEngine = createNimoEngine({
    adapters: [createGenericProjectAdapter({ source: ARCADE_OS_PROJECTS_SOURCE })],
    learningStore: brokenStore,
    onEvent: () => {
      throw new Error('Simulated listener explosion');
    }
  });

  // Must not throw!
  const safeResponse = isolatedEngine.respond('Tell me about NIMO');
  assert.equal(safeResponse.intent, 'project_lookup');
  assert.match(safeResponse.text, /assistant/i);
});
