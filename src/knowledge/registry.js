import { normalizeProjectSource } from './schema.js';
import { DuplicateKnowledgeError } from '../utils/validation.js';

export class KnowledgeRegistry {
  #projects = new Map();
  #sources = new Map();

  registerProjectSource(sourceDefinition) {
    const source = normalizeProjectSource(sourceDefinition);
    if (this.#sources.has(source.id)) throw new DuplicateKnowledgeError(`source:${source.id}`, source.id, source.id);
    for (const project of source.projects) {
      const existing = this.#projects.get(project.id);
      if (existing) throw new DuplicateKnowledgeError(project.id, existing.sourceApplication, source.id);
    }
    this.#sources.set(source.id, source);
    source.projects.forEach(project => this.#projects.set(project.id, project));
    return source;
  }

  get(id) { return this.#projects.get(String(id || '').toLowerCase()) || null; }
  has(id) { return this.#projects.has(String(id || '').toLowerCase()); }
  list() { return [...this.#projects.values()]; }
  listSources() { return [...this.#sources.values()]; }
  findByCategory(category) { return this.list().filter(project => project.category === category); }
  unregisterProjectSource(id) {
    const sourceId = String(id || '').toLowerCase();
    const source = this.#sources.get(sourceId) || null;
    if (!source) return null;
    source.projects.forEach(project => this.#projects.delete(project.id));
    this.#sources.delete(sourceId);
    return source;
  }
}

export function createKnowledgeRegistry() { return new KnowledgeRegistry(); }

const defaultRegistry = createKnowledgeRegistry();
export function registerProjectSource(sourceDefinition, registry = defaultRegistry) {
  return registry.registerProjectSource(sourceDefinition);
}
export function getDefaultRegistry() { return defaultRegistry; }
