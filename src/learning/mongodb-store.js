/**
 * MongoDB-backed LearningStore for NIMO-CORE.
 *
 * The event model is sanitized before persistence by LearningEvent.
 * The store keeps the same interface as InMemoryLearningStore so the
 * intelligence/evaluation layer can use persistent storage without
 * changing its domain logic.
 */

import { MongoClient } from 'mongodb';
import { LearningStore } from './store.js';
import { createLearningEvent } from './events.js';
import { OUTCOMES } from './outcomes.js';

const DEFAULT_DATABASE = 'nimo_knowledge';
const DEFAULT_COLLECTION = 'learning_events';
const DEFAULT_MAX_LIMIT = 200;

function normalizeLimit(limit, fallback = 20) {
  const value = Number(limit);
  if (!Number.isFinite(value)) return fallback;
  return Math.max(1, Math.min(DEFAULT_MAX_LIMIT, Math.floor(value)));
}

function normalizeFilters(filters = {}) {
  if (!filters || typeof filters !== 'object' || Array.isArray(filters)) return {};

  const allowed = ['intent', 'project', 'outcome', 'eventType', 'source'];
  const query = {};
  for (const key of allowed) {
    if (typeof filters[key] === 'string' && filters[key].trim()) {
      query[key] = filters[key].trim();
    }
  }
  return query;
}

function toLearningEvent(document) {
  const { _id, ...event } = document || {};
  return createLearningEvent({
    ...event,
    id: event.id || (_id != null ? String(_id) : undefined)
  });
}

function isDuplicateKeyError(error) {
  return error?.code === 11000 || /duplicate key/i.test(String(error?.message || ''));
}

export class MongoLearningStore extends LearningStore {
  #uri;
  #databaseName;
  #collectionName;
  #clientFactory;
  #clientPromise = null;
  #indexesPromise = null;

  constructor({
    uri,
    databaseName = DEFAULT_DATABASE,
    collectionName = DEFAULT_COLLECTION,
    clientFactory = (connectionString, options) => new MongoClient(connectionString, options),
    clientOptions = {}
  } = {}) {
    super();

    if (typeof uri !== 'string' || !uri.trim()) {
      throw new TypeError('MongoLearningStore requires a non-empty MongoDB URI');
    }

    this.#uri = uri.trim();
    this.#databaseName = databaseName;
    this.#collectionName = collectionName;
    this.#clientFactory = (connectionString) => clientFactory(connectionString, {
      maxPoolSize: 5,
      maxConnecting: 2,
      minPoolSize: 0,
      maxIdleTimeMS: 60000,
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
      ...clientOptions
    });
  }

  get databaseName() {
    return this.#databaseName;
  }

  get collectionName() {
    return this.#collectionName;
  }

  async #getClient() {
    if (!this.#clientPromise) {
      this.#clientPromise = (async () => {
        const client = this.#clientFactory(this.#uri);
        try {
          await client.connect();
          return client;
        } catch (error) {
          this.#clientPromise = null;
          try { await client.close(); } catch {}
          throw error;
        }
      })();
    }

    return this.#clientPromise;
  }

  async #getCollection() {
    const client = await this.#getClient();
    const collection = client.db(this.#databaseName).collection(this.#collectionName);

    if (!this.#indexesPromise) {
      this.#indexesPromise = Promise.all([
        collection.createIndex({ timestamp: -1 }, { name: 'timestamp_desc' }),
        collection.createIndex({ intent: 1, timestamp: -1 }, { name: 'intent_timestamp' }),
        collection.createIndex({ project: 1, timestamp: -1 }, { name: 'project_timestamp' }),
        collection.createIndex({ outcome: 1, timestamp: -1 }, { name: 'outcome_timestamp' }),
        collection.createIndex({ eventType: 1, timestamp: -1 }, { name: 'event_type_timestamp' }),
        collection.createIndex({ source: 1, timestamp: -1 }, { name: 'source_timestamp' })
      ]).catch(error => {
        this.#indexesPromise = null;
        throw error;
      });
    }

    await this.#indexesPromise;
    return collection;
  }

  async record(event) {
    const validEvent = event?.constructor?.name === 'LearningEvent'
      ? event
      : createLearningEvent(event);

    const collection = await this.#getCollection();

    try {
      await collection.insertOne({
        _id: validEvent.id,
        ...validEvent.toJSON()
      });
    } catch (error) {
      // The same event may be retried after a transient Worker interruption.
      // Treat an existing event id as idempotent success.
      if (!isDuplicateKeyError(error)) throw error;
    }

    return validEvent;
  }

  async getRecent(limit = 20) {
    const collection = await this.#getCollection();
    const documents = await collection.find({})
      .sort({ timestamp: -1 })
      .limit(normalizeLimit(limit))
      .toArray();

    return documents.map(toLearningEvent);
  }

  async getByIntent(intent, limit = 20) {
    if (!intent) return [];
    const collection = await this.#getCollection();
    const documents = await collection.find({ intent: String(intent) })
      .sort({ timestamp: -1 })
      .limit(normalizeLimit(limit))
      .toArray();

    return documents.map(toLearningEvent);
  }

  async getByProject(project, limit = 20) {
    if (!project) return [];
    const collection = await this.#getCollection();
    const documents = await collection.find({ project: String(project) })
      .sort({ timestamp: -1 })
      .limit(normalizeLimit(limit))
      .toArray();

    return documents.map(toLearningEvent);
  }

  async getFailures(limit = 20) {
    const collection = await this.#getCollection();
    const documents = await collection.find({
      outcome: { $in: [OUTCOMES.FAILURE, OUTCOMES.CORRECTED] }
    })
      .sort({ timestamp: -1 })
      .limit(normalizeLimit(limit))
      .toArray();

    return documents.map(toLearningEvent);
  }

  async getSuccessfulPatterns(limit = 20) {
    const collection = await this.#getCollection();
    const documents = await collection.find({ outcome: OUTCOMES.SUCCESS })
      .sort({ timestamp: -1 })
      .limit(normalizeLimit(limit))
      .toArray();

    return documents.map(toLearningEvent);
  }

  async count(filters = {}) {
    const collection = await this.#getCollection();
    return collection.countDocuments(normalizeFilters(filters));
  }

  async clear() {
    const collection = await this.#getCollection();
    await collection.deleteMany({});
  }

  async ping() {
    const client = await this.#getClient();
    await client.db(this.#databaseName).command({ ping: 1 });
    return true;
  }
}

export function createMongoLearningStore(options = {}) {
  return new MongoLearningStore(options);
}
