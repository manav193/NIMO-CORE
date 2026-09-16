/**
 * NIMO Core Learning Store Abstraction
 * Storage interface and bounded in-memory implementation for recording,
 * indexing, and retrieving interaction learning events.
 */

import { LearningEvent, createLearningEvent } from './events.js';
import { OUTCOMES } from './outcomes.js';

/**
 * Base abstract interface for LearningStore implementations.
 */
export class LearningStore {
  async record(event) {
    throw new Error('LearningStore.record() must be implemented by subclasses.');
  }

  async getRecent(limit = 20, options = {}) {
    throw new Error('LearningStore.getRecent() must be implemented by subclasses.');
  }

  async getByIntent(intent, limit = 20, options = {}) {
    throw new Error('LearningStore.getByIntent() must be implemented by subclasses.');
  }

  async getByProject(project, limit = 20, options = {}) {
    throw new Error('LearningStore.getByProject() must be implemented by subclasses.');
  }

  async getFailures(limit = 20, options = {}) {
    throw new Error('LearningStore.getFailures() must be implemented by subclasses.');
  }

  async getSuccessfulPatterns(limit = 20, options = {}) {
    throw new Error('LearningStore.getSuccessfulPatterns() must be implemented by subclasses.');
  }

  async count(filters = {}) {
    throw new Error('LearningStore.count() must be implemented by subclasses.');
  }

  async clear() {
    throw new Error('LearningStore.clear() must be implemented by subclasses.');
  }
}

const DEFAULT_MAX_CAPACITY = 1000;

/**
 * Production-ready in-memory LearningStore with bounded capacity,
 * sliding-window FIFO eviction, and multi-index retrieval.
 */
export class InMemoryLearningStore extends LearningStore {
  #events = [];
  #maxCapacity;
  #byIntent = new Map();
  #byProject = new Map();
  #byOutcome = new Map();
  #byEventType = new Map();

  constructor({ maxCapacity = DEFAULT_MAX_CAPACITY } = {}) {
    super();
    this.#maxCapacity = Math.max(1, Math.min(100000, Number(maxCapacity) || DEFAULT_MAX_CAPACITY));
  }

  get capacity() {
    return this.#maxCapacity;
  }

  get size() {
    return this.#events.length;
  }

  /**
   * Record a learning event. If input is a plain object, wraps it in LearningEvent.
   * Maintains capacity bounds by FIFO pruning.
   */
  async record(event) {
    const validEvent = event instanceof LearningEvent ? event : createLearningEvent(event);

    if (this.#events.length >= this.#maxCapacity) {
      this.#evictOldest();
    }

    this.#events.push(validEvent);
    this.#indexEvent(validEvent);

    return validEvent;
  }

  #indexEvent(event) {
    if (event.intent) {
      if (!this.#byIntent.has(event.intent)) this.#byIntent.set(event.intent, []);
      this.#byIntent.get(event.intent).push(event);
    }

    if (event.project) {
      if (!this.#byProject.has(event.project)) this.#byProject.set(event.project, []);
      this.#byProject.get(event.project).push(event);
    }

    if (event.outcome) {
      if (!this.#byOutcome.has(event.outcome)) this.#byOutcome.set(event.outcome, []);
      this.#byOutcome.get(event.outcome).push(event);
    }

    if (event.eventType) {
      if (!this.#byEventType.has(event.eventType)) this.#byEventType.set(event.eventType, []);
      this.#byEventType.get(event.eventType).push(event);
    }
  }

  #evictOldest() {
    const evicted = this.#events.shift();
    if (!evicted) return;

    if (evicted.intent && this.#byIntent.has(evicted.intent)) {
      const arr = this.#byIntent.get(evicted.intent);
      const idx = arr.indexOf(evicted);
      if (idx !== -1) arr.splice(idx, 1);
    }

    if (evicted.project && this.#byProject.has(evicted.project)) {
      const arr = this.#byProject.get(evicted.project);
      const idx = arr.indexOf(evicted);
      if (idx !== -1) arr.splice(idx, 1);
    }

    if (evicted.outcome && this.#byOutcome.has(evicted.outcome)) {
      const arr = this.#byOutcome.get(evicted.outcome);
      const idx = arr.indexOf(evicted);
      if (idx !== -1) arr.splice(idx, 1);
    }

    if (evicted.eventType && this.#byEventType.has(evicted.eventType)) {
      const arr = this.#byEventType.get(evicted.eventType);
      const idx = arr.indexOf(evicted);
      if (idx !== -1) arr.splice(idx, 1);
    }
  }

  /**
   * Retrieve most recent events in reverse chronological order.
   */
  async getRecent(limit = 20) {
    const count = Math.max(1, Math.min(this.#events.length, Number(limit) || 20));
    return this.#events.slice(-count).reverse();
  }

  /**
   * Query events by intent.
   */
  async getByIntent(intent, limit = 20) {
    if (!intent || !this.#byIntent.has(intent)) return [];
    const arr = this.#byIntent.get(intent);
    const count = Math.max(1, Math.min(arr.length, Number(limit) || 20));
    return arr.slice(-count).reverse();
  }

  /**
   * Query events by project identifier.
   */
  async getByProject(project, limit = 20) {
    if (!project || !this.#byProject.has(project)) return [];
    const arr = this.#byProject.get(project);
    const count = Math.max(1, Math.min(arr.length, Number(limit) || 20));
    return arr.slice(-count).reverse();
  }

  /**
   * Query failed interactions or error events.
   */
  async getFailures(limit = 20) {
    const failureOutcomes = this.#byOutcome.get(OUTCOMES.FAILURE) || [];
    const correctedOutcomes = this.#byOutcome.get(OUTCOMES.CORRECTED) || [];
    const combined = [...failureOutcomes, ...correctedOutcomes]
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    const count = Math.max(1, Math.min(combined.length, Number(limit) || 20));
    return combined.slice(0, count);
  }

  /**
   * Query successful interaction patterns.
   */
  async getSuccessfulPatterns(limit = 20) {
    const successes = this.#byOutcome.get(OUTCOMES.SUCCESS) || [];
    const count = Math.max(1, Math.min(successes.length, Number(limit) || 20));
    return successes.slice(-count).reverse();
  }

  /**
   * Count total events matching optional filter predicates.
   */
  async count(filters = {}) {
    if (!filters || Object.keys(filters).length === 0) {
      return this.#events.length;
    }

    let results = this.#events;
    if (filters.intent) {
      results = results.filter(e => e.intent === filters.intent);
    }
    if (filters.project) {
      results = results.filter(e => e.project === filters.project);
    }
    if (filters.outcome) {
      results = results.filter(e => e.outcome === filters.outcome);
    }
    if (filters.eventType) {
      results = results.filter(e => e.eventType === filters.eventType);
    }
    if (filters.source) {
      results = results.filter(e => e.source === filters.source);
    }

    return results.length;
  }

  /**
   * Clear all stored events and reset index maps.
   */
  async clear() {
    this.#events = [];
    this.#byIntent.clear();
    this.#byProject.clear();
    this.#byOutcome.clear();
    this.#byEventType.clear();
  }
}

export function createInMemoryLearningStore(options) {
  return new InMemoryLearningStore(options);
}
