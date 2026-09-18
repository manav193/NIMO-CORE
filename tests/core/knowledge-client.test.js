import test from 'node:test';
import assert from 'node:assert/strict';

import {
  GovernedKnowledgeClient,
  MemoryKnowledgeProvider,
  HttpKnowledgeProvider,
  createGovernedKnowledgeClient,
  validateCatalogStructure,
  validateKnowledgeEntry,
  sanitizeDiagnosticMessage,
  isApprovedOrActive,
  RUNTIME_GOVERNED_STATUSES
} from '../../src/knowledge/knowledge-client.js';

const mockCatalog = {
  catalogVersion: '1.2.0',
  updatedAt: '2026-09-18T14:00:00Z',
  totalEntries: 5,
  entries: [
    {
      id: 'kno-approved-1',
      type: 'knowledge_entry',
      project: 'nimo-core',
      topic: 'runtime-testing',
      version: 1,
      status: 'approved',
      path: 'knowledge/approved-1.json',
      updatedAt: '2026-09-18T12:00:00Z',
      provenance: {
        approvedBy: 'architecture-wg',
        evidence: ['bench:test-001']
      }
    },
    {
      id: 'kno-active-1',
      type: 'knowledge_entry',
      project: 'prompt-aii',
      topic: 'prompt-optimization',
      version: 2,
      status: 'active',
      path: 'knowledge/active-1.json',
      updatedAt: '2026-09-18T13:00:00Z',
      provenance: {
        approvedBy: 'prompt-wg',
        evidence: ['bench:prompt-002']
      }
    },
    {
      id: 'kno-draft-1',
      type: 'knowledge_entry',
      project: 'nimo-web',
      topic: 'draft-topic',
      version: 1,
      status: 'draft',
      path: 'knowledge/draft-1.json',
      updatedAt: '2026-09-18T10:00:00Z'
    },
    {
      id: 'kno-proposed-1',
      type: 'knowledge_entry',
      project: 'nimo-assistant',
      topic: 'proposed-topic',
      version: 1,
      status: 'proposed',
      path: 'knowledge/proposed-1.json',
      updatedAt: '2026-09-18T11:00:00Z'
    },
    {
      id: 'kno-rejected-1',
      type: 'knowledge_entry',
      project: 'nimo-core',
      topic: 'rejected-topic',
      version: 1,
      status: 'rejected',
      path: 'knowledge/rejected-1.json',
      updatedAt: '2026-09-18T09:00:00Z'
    }
  ]
};

const mockApprovedEntry = {
  id: 'kno-approved-1',
  version: 1,
  sourceProject: 'nimo-core',
  domain: 'general',
  status: 'approved',
  title: 'Approved Runtime Heuristic',
  summary: 'A verified operating heuristic for runtime decision making.',
  content: 'Execute tools with bounded timeouts and verify preconditions before state transition.',
  guidelines: [
    'Always verify existence before mutation.',
    'Do not assume network availability.'
  ],
  evidence: ['eval:approved-eval-01'],
  metadata: {
    sanitized: true,
    approvedBy: 'architecture-wg',
    tags: ['runtime', 'testing']
  }
};

const mockActiveEntry = {
  id: 'kno-active-1',
  version: 2,
  sourceProject: 'prompt-aii',
  domain: 'projects',
  status: 'active',
  title: 'Active Prompt Strategy',
  summary: 'Active production prompt guidance for reasoning tasks.',
  content: 'Decompose user requirements into explicit output contracts with step-wise verification.',
  guidelines: [
    'Preserve user constraints explicitly.'
  ],
  evidence: ['eval:prompt-eval-02'],
  metadata: {
    sanitized: true,
    approvedBy: 'prompt-wg',
    tags: ['active', 'prompts']
  }
};

test('isApprovedOrActive correctly identifies approved and active statuses', () => {
  assert.equal(isApprovedOrActive('approved'), true);
  assert.equal(isApprovedOrActive('APPROVED'), true);
  assert.equal(isApprovedOrActive('active'), true);
  assert.equal(isApprovedOrActive('ACTIVE'), true);
  assert.equal(isApprovedOrActive('draft'), false);
  assert.equal(isApprovedOrActive('proposed'), false);
  assert.equal(isApprovedOrActive('evaluated'), false);
  assert.equal(isApprovedOrActive('rejected'), false);
  assert.equal(isApprovedOrActive('archived'), false);
  assert.equal(isApprovedOrActive(null), false);
  assert.equal(isApprovedOrActive(undefined), false);
});

test('valid catalog structure parsing and status filtering', async () => {
  const provider = new MemoryKnowledgeProvider({
    catalog: mockCatalog,
    entries: [mockApprovedEntry, mockActiveEntry]
  });
  const client = createGovernedKnowledgeClient({ provider });

  const catalog = await client.getCatalog();
  assert.equal(catalog.available, true);
  assert.equal(catalog.catalogVersion, '1.2.0');
  assert.equal(catalog.loaded.length, 2);
  assert.equal(catalog.skipped.length, 3);

  const loadedIds = catalog.loaded.map(e => e.id);
  assert.ok(loadedIds.includes('kno-approved-1'));
  assert.ok(loadedIds.includes('kno-active-1'));
  assert.ok(!loadedIds.includes('kno-draft-1'));
  assert.ok(!loadedIds.includes('kno-proposed-1'));
  assert.ok(!loadedIds.includes('kno-rejected-1'));
});

test('malformed catalog is rejected safely without throwing', async () => {
  const logs = [];
  const mockLogger = {
    warn: msg => logs.push(msg)
  };

  const provider = new MemoryKnowledgeProvider({
    catalog: { notAValidCatalog: true }
  });
  const client = new GovernedKnowledgeClient({ provider, logger: mockLogger });

  const catalog = await client.getCatalog();
  assert.equal(catalog.available, false);
  assert.equal(catalog.loaded.length, 0);
  assert.equal(catalog.reason, 'MALFORMED_CATALOG');
  assert.ok(logs.some(m => m.includes('Malformed knowledge catalog rejected')));
});

test('APPROVED knowledge retrieval succeeds with full integrity', async () => {
  const provider = new MemoryKnowledgeProvider({
    catalog: mockCatalog,
    entries: [mockApprovedEntry]
  });
  const client = new GovernedKnowledgeClient({ provider });

  const result = await client.resolveKnowledge({ id: 'kno-approved-1' });
  assert.equal(result.success, true);
  assert.equal(result.entry.id, 'kno-approved-1');
  assert.equal(result.entry.status, 'approved');
  assert.equal(result.entry.title, 'Approved Runtime Heuristic');
  assert.equal(result.entry.guidelines.length, 2);
  assert.equal(result.entry.metadata.sanitized, true);
});

test('ACTIVE knowledge retrieval succeeds with full integrity', async () => {
  const provider = new MemoryKnowledgeProvider({
    catalog: mockCatalog,
    entries: [mockActiveEntry]
  });
  const client = new GovernedKnowledgeClient({ provider });

  const result = await client.resolveKnowledge({ id: 'kno-active-1' });
  assert.equal(result.success, true);
  assert.equal(result.entry.id, 'kno-active-1');
  assert.equal(result.entry.status, 'active');
  assert.equal(result.entry.version, 2);
  assert.equal(result.entry.sourceProject, 'prompt-aii');
});

test('DRAFT knowledge rejection: cannot be resolved at runtime', async () => {
  const provider = new MemoryKnowledgeProvider({
    catalog: mockCatalog,
    entries: [{
      id: 'kno-draft-1',
      version: 1,
      sourceProject: 'nimo-web',
      status: 'draft',
      title: 'Draft Heuristic',
      content: 'Should not load',
      metadata: { sanitized: true }
    }]
  });
  const client = new GovernedKnowledgeClient({ provider });

  const result = await client.resolveKnowledge({ id: 'kno-draft-1' });
  assert.equal(result.success, false);
  assert.equal(result.reason, 'ENTRY_NOT_APPROVED');
  assert.equal(result.status, 'draft');
  assert.equal(result.entry, null);
});

test('PROPOSED knowledge rejection: cannot be resolved at runtime', async () => {
  const provider = new MemoryKnowledgeProvider({
    catalog: mockCatalog,
    entries: [{
      id: 'kno-proposed-1',
      version: 1,
      sourceProject: 'nimo-assistant',
      status: 'proposed',
      title: 'Proposed Pattern',
      content: 'Should not load',
      metadata: { sanitized: true }
    }]
  });
  const client = new GovernedKnowledgeClient({ provider });

  const result = await client.resolveKnowledge({ id: 'kno-proposed-1' });
  assert.equal(result.success, false);
  assert.equal(result.reason, 'ENTRY_NOT_APPROVED');
  assert.equal(result.status, 'proposed');
  assert.equal(result.entry, null);
});

test('REJECTED knowledge rejection: cannot be resolved at runtime', async () => {
  const provider = new MemoryKnowledgeProvider({
    catalog: mockCatalog,
    entries: [{
      id: 'kno-rejected-1',
      version: 1,
      sourceProject: 'nimo-core',
      status: 'rejected',
      title: 'Rejected Pattern',
      content: 'Should not load',
      metadata: { sanitized: true }
    }]
  });
  const client = new GovernedKnowledgeClient({ provider });

  const result = await client.resolveKnowledge({ id: 'kno-rejected-1' });
  assert.equal(result.success, false);
  assert.equal(result.reason, 'ENTRY_NOT_APPROVED');
  assert.equal(result.status, 'rejected');
  assert.equal(result.entry, null);
});

test('provenance preservation: provenance is complete and frozen', async () => {
  const provider = new MemoryKnowledgeProvider({
    catalog: mockCatalog,
    entries: [mockApprovedEntry]
  });
  const client = new GovernedKnowledgeClient({ provider });

  const result = await client.resolveKnowledge({ id: 'kno-approved-1' });
  assert.equal(result.success, true);
  const prov = result.entry.provenance;
  assert.ok(prov, 'Provenance must be present');
  assert.equal(prov.knowledgeId, 'kno-approved-1');
  assert.equal(prov.version, 1);
  assert.equal(prov.sourceProject, 'nimo-core');
  assert.equal(prov.status, 'approved');
  assert.equal(prov.approvedBy, 'architecture-wg');
  assert.equal(prov.catalogVersion, '1.2.0');
  assert.equal(prov.path, 'knowledge/approved-1.json');
  assert.ok(Array.isArray(prov.evidence));
  assert.ok(prov.evidence.includes('eval:approved-eval-01'));
  assert.ok(Object.isFrozen(prov));
});

test('version handling: version mismatch between catalog and entry causes rejection', async () => {
  const logs = [];
  const mockLogger = { warn: msg => logs.push(msg) };

  // Catalog says version 1, entry says version 99
  const mismatchedEntry = {
    ...mockApprovedEntry,
    version: 99
  };

  const provider = new MemoryKnowledgeProvider({
    catalog: mockCatalog,
    entries: [mismatchedEntry]
  });
  const client = new GovernedKnowledgeClient({ provider, logger: mockLogger });

  const result = await client.resolveKnowledge({ id: 'kno-approved-1' });
  assert.equal(result.success, false);
  assert.equal(result.reason, 'INTEGRITY_CHECK_FAILED');
  assert.ok(result.validationError.includes('version does not match'));
});

test('unavailable knowledge source: network errors fail closed safely without crashing', async () => {
  const logs = [];
  const mockLogger = { warn: msg => logs.push(msg) };

  // Provider with a failing fetchImpl
  const failingFetch = async () => {
    throw new Error('Connection refused (ECONNREFUSED)');
  };
  const provider = new HttpKnowledgeProvider({
    baseUrl: 'https://unavailable.nimo.local/',
    fetchImpl: failingFetch,
    logger: mockLogger
  });
  const client = new GovernedKnowledgeClient({ provider, logger: mockLogger });

  const catalog = await client.getCatalog();
  assert.equal(catalog.available, false);
  assert.equal(catalog.reason, 'PROVIDER_UNAVAILABLE');
  assert.equal(catalog.loaded.length, 0);

  const resolution = await client.resolveKnowledge({ id: 'kno-approved-1' });
  assert.equal(resolution.success, false);
  assert.equal(resolution.reason, 'CATALOG_UNAVAILABLE');
  assert.equal(resolution.entry, null);
});

test('malformed knowledge entry is rejected safely', async () => {
  const logs = [];
  const mockLogger = { warn: msg => logs.push(msg) };

  // Missing content and sanitized=false
  const malformedEntry = {
    id: 'kno-approved-1',
    sourceProject: 'nimo-core',
    title: 'Missing Content',
    status: 'approved',
    metadata: { sanitized: false }
  };

  const provider = new MemoryKnowledgeProvider({
    catalog: mockCatalog,
    entries: [malformedEntry]
  });
  const client = new GovernedKnowledgeClient({ provider, logger: mockLogger });

  const result = await client.resolveKnowledge({ id: 'kno-approved-1' });
  assert.equal(result.success, false);
  assert.equal(result.reason, 'INTEGRITY_CHECK_FAILED');
  assert.equal(result.entry, null);
});

test('fallback behavior: missing entry returns clean failure without hallucinating knowledge', async () => {
  const provider = new MemoryKnowledgeProvider({
    catalog: mockCatalog,
    entries: [] // Empty entries
  });
  const client = new GovernedKnowledgeClient({ provider });

  const result = await client.resolveKnowledge({ id: 'non-existent-id' });
  assert.equal(result.success, false);
  assert.equal(result.reason, 'ENTRY_NOT_FOUND_IN_CATALOG');
  assert.equal(result.entry, null);
});

test('secret-safe logging: diagnostic messages redact keys, bearer tokens, and credentials', () => {
  const dirty1 = 'Fetch failed for https://api.internal/v1?key=supersecretkey123&token=tok456';
  const clean1 = sanitizeDiagnosticMessage(dirty1);
  assert.ok(!clean1.includes('supersecretkey123'));
  assert.ok(!clean1.includes('tok456'));
  assert.ok(clean1.includes('[REDACTED]'));

  const dirty2 = 'Authorization header was Bearer secret-auth-token-xyz789';
  const clean2 = sanitizeDiagnosticMessage(dirty2);
  assert.ok(!clean2.includes('secret-auth-token-xyz789'));
  assert.ok(clean2.includes('Bearer [REDACTED]'));
});
