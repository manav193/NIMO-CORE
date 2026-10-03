import test from 'node:test';
import assert from 'node:assert/strict';

import {
  EVENT_TYPES,
  OUTCOMES,
  createLearningEvent,
  MongoLearningStore,
  createMongoLearningStore
} from '../../src/index.js';

function createFakeMongo() {
  const docs = [];
  const indexes = [];

  const collection = {
    async createIndex(spec, options = {}) {
      indexes.push({ spec, options });
      return options.name || 'index';
    },

    async insertOne(document) {
      if (docs.some(item => item._id === document._id)) {
        const error = new Error('E11000 duplicate key error');
        error.code = 11000;
        throw error;
      }
      docs.push(structuredClone(document));
      return { acknowledged: true, insertedId: document._id };
    },

    find(filter = {}) {
      const matches = docs.filter(document => {
        return Object.entries(filter).every(([key, value]) => {
          if (value && typeof value === 'object' && '$in' in value) {
            return value.$in.includes(document[key]);
          }
          return document[key] === value;
        });
      });

      return {
        sort(sortSpec) {
          const entries = Object.entries(sortSpec);
          matches.sort((a, b) => {
            for (const [field, direction] of entries) {
              const av = a[field] ?? '';
              const bv = b[field] ?? '';
              if (av === bv) continue;
              return av > bv ? direction : -direction;
            }
            return 0;
          });
          return this;
        },
        limit(value) {
          this.items = matches.slice(0, value);
          return this;
        },
        async toArray() {
          return this.items ?? matches;
        }
      };
    },

    async countDocuments(filter = {}) {
      return (await this.find(filter).toArray()).length;
    },

    async deleteMany(filter = {}) {
      if (Object.keys(filter).length === 0) {
        const deletedCount = docs.length;
        docs.length = 0;
        return { acknowledged: true, deletedCount };
      }
      return { acknowledged: true, deletedCount: 0 };
    }
  };

  const client = {
    async connect() {
      return this;
    },
    async close() {},
    db(name) {
      assert.equal(name, 'nimo_knowledge');
      return {
        collection(collectionName) {
          assert.equal(collectionName, 'learning_events');
          return collection;
        },
        async command(command) {
          assert.deepEqual(command, { ping: 1 });
          return { ok: 1 };
        }
      };
    }
  };

  return { client, docs, indexes };
}

test('MongoLearningStore persists and queries sanitized learning events', async () => {
  const fake = createFakeMongo();
  const store = createMongoLearningStore({
    uri: 'mongodb+srv://example.invalid/nimo_knowledge',
    clientFactory: () => fake.client
  });

  const first = createLearningEvent({
    id: 'evt-mongo-1',
    eventType: EVENT_TYPES.INTERACTION_SUCCESS,
    source: 'core',
    intent: 'project_lookup',
    project: 'nimo',
    outcome: OUTCOMES.SUCCESS,
    inputMetadata: { userToken: 'should-not-persist' }
  });

  const second = createLearningEvent({
    id: 'evt-mongo-2',
    eventType: EVENT_TYPES.AI_FAILURE,
    source: 'openrouter',
    intent: 'ai_fallback',
    project: 'prompt-aii',
    outcome: OUTCOMES.FAILURE
  });

  await store.record(first);
  await store.record(second);

  assert.equal(fake.docs.length, 2);
  assert.equal(fake.docs[0].inputMetadata.userToken, '[REDACTED]');

  const recent = await store.getRecent(10);
  assert.equal(recent.length, 2);
  assert.deepEqual(
    new Set(recent.map(event => event.id)),
    new Set(['evt-mongo-1', 'evt-mongo-2'])
  );

  const byProject = await store.getByProject('prompt-aii', 10);
  assert.equal(byProject.length, 1);
  assert.equal(byProject[0].id, 'evt-mongo-2');

  const failures = await store.getFailures(10);
  assert.equal(failures.length, 1);
  assert.equal(failures[0].outcome, OUTCOMES.FAILURE);

  const successes = await store.getSuccessfulPatterns(10);
  assert.equal(successes.length, 1);
  assert.equal(successes[0].outcome, OUTCOMES.SUCCESS);

  assert.equal(await store.count({ project: 'prompt-aii' }), 1);
  assert.equal(fake.indexes.length, 6);

  await store.ping();
  await store.clear();
  assert.equal(await store.count(), 0);
});

test('MongoLearningStore treats duplicate event ids as idempotent', async () => {
  const fake = createFakeMongo();
  const store = new MongoLearningStore({
    uri: 'mongodb+srv://example.invalid/nimo_knowledge',
    clientFactory: () => fake.client
  });

  const event = createLearningEvent({
    id: 'evt-idempotent',
    eventType: EVENT_TYPES.DETERMINISTIC_RESOLUTION,
    outcome: OUTCOMES.UNKNOWN
  });

  await store.record(event);
  await assert.doesNotReject(() => store.record(event));
  assert.equal(fake.docs.length, 1);
});
