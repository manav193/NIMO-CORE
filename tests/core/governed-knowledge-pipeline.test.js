import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createInMemoryLearningStore,
  createPromptAiiLearningEvent,
  evaluatePromptAiiEvents,
  serializePromptAiiProposal,
  PROPOSAL_STATUSES
} from '../../src/learning/index.js';

import {
  GovernedKnowledgeClient,
  MemoryKnowledgeProvider
} from '../../src/knowledge/knowledge-client.js';

test('end-to-end governed pipeline: feedback -> learning -> evaluation -> proposal -> review gate -> approved knowledge retrieval', async () => {
  // -------------------------------------------------------------------------
  // STEP 1: Client/Project (Prompt-Aii / NIMO-WEB) emits sanitized feedback
  // -------------------------------------------------------------------------
  const feedbackEvents = [
    createPromptAiiLearningEvent({
      requestId: 'req-test-001',
      input: 'Create a test for user authentication in Python',
      target: 'claude-code',
      strategy: 'basic-prompt',
      outcome: 'failure',
      feedback: { rating: 1, issue: 'Missing edge case tests and validation criteria' },
      latency: 1200
    }),
    createPromptAiiLearningEvent({
      requestId: 'req-test-002',
      input: 'Create a test for payment processing',
      target: 'claude-code',
      strategy: 'basic-prompt',
      outcome: 'failure',
      feedback: { rating: 2, issue: 'Incomplete definition of done' },
      latency: 1400
    }),
    createPromptAiiLearningEvent({
      requestId: 'req-test-003',
      input: 'Write integration test for redis cache',
      target: 'claude-code',
      strategy: 'basic-prompt',
      outcome: 'failure',
      feedback: { rating: 1, issue: 'No mocking instructions provided' },
      latency: 1100
    })
  ];

  // -------------------------------------------------------------------------
  // STEP 2: NIMO-CORE LearningStore records events in bounded sliding window
  // -------------------------------------------------------------------------
  const store = createInMemoryLearningStore({ maxCapacity: 50 });
  for (const ev of feedbackEvents) {
    await store.record(ev);
  }

  const recorded = await store.getByProject('prompt-aii');
  assert.equal(recorded.length, 3, 'All 3 feedback events must be securely recorded');

  // -------------------------------------------------------------------------
  // STEP 3: EvaluationEngine assesses trends and produces an ImprovementProposal
  // -------------------------------------------------------------------------
  const proposals = evaluatePromptAiiEvents(recorded, { minEvidenceCount: 3 });
  assert.equal(proposals.length, 1, 'Evaluation engine must identify the recurring failure pattern');

  const proposal = proposals[0];
  assert.equal(proposal.status, PROPOSAL_STATUSES.PROPOSED);
  assert.equal(proposal.target, 'prompt-aii:claude-code');

  const serializedProposal = serializePromptAiiProposal(proposal);
  assert.equal(serializedProposal.status, 'PROPOSED');
  assert.equal(serializedProposal.metadata.requiresHumanReview, true);
  assert.equal(serializedProposal.metadata.knowledgeEntryPath, null);

  // -------------------------------------------------------------------------
  // STEP 4: EXPLICIT NEGATIVE PROOF — Unapproved proposal CANNOT become runtime knowledge
  // -------------------------------------------------------------------------
  const draftCatalog = {
    catalogVersion: '1.2.0',
    entries: [
      {
        id: 'kno-proposed-claude-test-guidelines',
        type: 'knowledge_entry',
        project: 'prompt-aii',
        topic: 'claude-code-prompt-guidelines',
        version: 1,
        status: 'proposed', // PROPOSED STATUS FROM PROPOSAL
        path: 'knowledge/projects/prompt-aii-claude-proposed.json'
      }
    ]
  };

  const draftEntry = {
    id: 'kno-proposed-claude-test-guidelines',
    version: 1,
    sourceProject: 'prompt-aii',
    status: 'proposed',
    title: 'Proposed Claude Code Prompting Rules',
    content: 'Unapproved draft content from automated proposal',
    metadata: { sanitized: true }
  };

  const unapprovedProvider = new MemoryKnowledgeProvider({
    catalog: draftCatalog,
    entries: [draftEntry]
  });
  const unapprovedClient = new GovernedKnowledgeClient({ provider: unapprovedProvider });

  // Attempt to resolve the proposed entry
  const unapprovedResolution = await unapprovedClient.resolveKnowledge({
    id: 'kno-proposed-claude-test-guidelines'
  });

  assert.equal(
    unapprovedResolution.success,
    false,
    'CRITICAL GOVERNANCE PROOF: Unapproved proposal must be rejected by runtime client'
  );
  assert.equal(unapprovedResolution.reason, 'ENTRY_NOT_APPROVED');
  assert.equal(unapprovedResolution.status, 'proposed');
  assert.equal(unapprovedResolution.entry, null);

  // -------------------------------------------------------------------------
  // STEP 5: Governance Review Gate (Human/System Review approves knowledge)
  // -------------------------------------------------------------------------
  // An architecture reviewer examines the proposal, writes curated guidelines,
  // runs benchmark tests, sanitizes the entry, and signs off.
  const approvedEntryId = 'kno-20260918-prompt-aii-claude-testing';
  const approvedCatalog = {
    catalogVersion: '1.2.0',
    updatedAt: '2026-09-18T14:30:00Z',
    entries: [
      {
        id: approvedEntryId,
        type: 'knowledge_entry',
        project: 'prompt-aii',
        topic: 'claude-code-testing-guidelines',
        version: 1,
        status: 'approved', // NOW EXPLICITLY APPROVED
        path: 'knowledge/projects/prompt-aii-claude-testing.json',
        updatedAt: '2026-09-18T14:30:00Z',
        provenance: {
          approvedBy: 'claude-prompt-review-committee',
          evidence: [
            proposal.proposalId,
            'bench:claude-code-test-suite-2026'
          ]
        }
      }
    ]
  };

  const approvedEntry = {
    id: approvedEntryId,
    version: 1,
    sourceProject: 'prompt-aii',
    domain: 'projects',
    status: 'approved',
    title: 'Claude Code Test Generation Guidelines',
    summary: 'Curated prompt engineering patterns for resilient code test generation.',
    content: 'For Claude Code test prompts, explicitly specify test framework, mock boundaries, edge cases, assertion styles, and definition of done.',
    guidelines: [
      'Require test suite setup before implementation code.',
      'Explicitly state mock constraints and network isolation.',
      'Include assertions for negative and boundary paths.'
    ],
    evidence: [
      proposal.proposalId,
      'bench:claude-code-test-suite-2026'
    ],
    metadata: {
      sanitized: true,
      approvedBy: 'claude-prompt-review-committee',
      tags: ['prompt-aii', 'claude-code', 'testing', 'approved']
    }
  };

  const approvedProvider = new MemoryKnowledgeProvider({
    catalog: approvedCatalog,
    entries: [approvedEntry]
  });
  const approvedClient = new GovernedKnowledgeClient({ provider: approvedProvider });

  // -------------------------------------------------------------------------
  // STEP 6: NIMO-CORE Retrieves and Consumes Approved Knowledge
  // -------------------------------------------------------------------------
  const resolved = await approvedClient.resolveKnowledge({ id: approvedEntryId });

  assert.equal(resolved.success, true, 'Approved knowledge must resolve successfully');
  assert.equal(resolved.entry.id, approvedEntryId);
  assert.equal(resolved.entry.status, 'approved');
  assert.equal(resolved.entry.title, 'Claude Code Test Generation Guidelines');
  assert.equal(resolved.entry.guidelines.length, 3);

  // Verify Provenance is fully preserved and traceable back to the review & proposal
  const provenance = resolved.entry.provenance;
  assert.ok(provenance, 'Provenance must be populated on resolved runtime knowledge');
  assert.equal(provenance.knowledgeId, approvedEntryId);
  assert.equal(provenance.version, 1);
  assert.equal(provenance.sourceProject, 'prompt-aii');
  assert.equal(provenance.approvedBy, 'claude-prompt-review-committee');
  assert.ok(provenance.evidence.includes(proposal.proposalId));
  assert.ok(provenance.evidence.includes('bench:claude-code-test-suite-2026'));
  assert.equal(provenance.catalogVersion, '1.2.0');
});
