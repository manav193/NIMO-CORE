import { createKnowledgeRegistry } from '../knowledge/registry.js';
import { normalizeProjectSource } from '../knowledge/schema.js';
import { normalizeText, tokenize } from '../utils/normalize-text.js';
import { tokenOverlapScore } from '../utils/scoring.js';
import { DuplicateKnowledgeError, KnowledgeValidationError } from '../utils/validation.js';
import { createModuleRegistry } from './module-registry.js';
import { normalizeModuleManifest } from './manifest-schema.js';

const moduleText = module => [module.id, module.name, module.description, module.type, ...module.keywords, ...module.capabilities].join(' ');
const projectText = project => [project.id, project.name, project.summary, ...project.aliases, ...project.keywords, ...project.capabilities].join(' ');
const searchScore = (query, text) => {
  const queryTokens = new Set(tokenize(query));
  const candidateTokens = new Set(tokenize(text));
  if (!queryTokens.size) return 0;
  let matches = 0;
  queryTokens.forEach(token => { if (candidateTokens.has(token)) matches += 1; });
  const coverage = matches / queryTokens.size;
  return normalizeText(text).includes(normalizeText(query)) ? Math.min(1, coverage + 0.25) : coverage;
};

export class ProjectFederation {
  #sourceByModule = new Map();

  constructor({ moduleRegistry = createModuleRegistry(), knowledgeRegistry = createKnowledgeRegistry() } = {}) {
    this.moduleRegistry = moduleRegistry;
    this.knowledgeRegistry = knowledgeRegistry;
  }

  registerModule(definition, knowledgeDefinition = null) {
    const manifest = normalizeModuleManifest(definition);
    if (this.moduleRegistry.getModule(manifest.id)) throw new DuplicateKnowledgeError(`module:${manifest.id}`, manifest.id, manifest.id);
    const source = knowledgeDefinition ? normalizeProjectSource(knowledgeDefinition) : null;
    if (source && source.application !== manifest.id && source.id !== manifest.id) {
      throw new KnowledgeValidationError(`Knowledge source for "${manifest.id}" must use that module as its application or source id.`);
    }
    if (source) this.knowledgeRegistry.registerProjectSource(source);
    try {
      const registered = this.moduleRegistry.registerModule(manifest);
      if (source) this.#sourceByModule.set(registered.id, source.id);
      return registered;
    } catch (error) {
      if (source) this.knowledgeRegistry.unregisterProjectSource(source.id);
      throw error;
    }
  }

  unregisterModule(id) {
    const removed = this.moduleRegistry.unregisterModule(id);
    if (!removed) return null;
    const sourceId = this.#sourceByModule.get(removed.id);
    if (sourceId) this.knowledgeRegistry.unregisterProjectSource(sourceId);
    this.#sourceByModule.delete(removed.id);
    return removed;
  }

  getModule(id) { return this.moduleRegistry.getModule(id); }
  getModules() { return this.moduleRegistry.getModules(); }
  findByCapability(value) { return this.moduleRegistry.findByCapability(value); }
  findByKeyword(value) { return this.moduleRegistry.findByKeyword(value); }

  search(query, { limit = 10 } = {}) {
    const queryTokens = tokenize(query);
    if (!queryTokens.length) return [];
    return this.getModules().map(module => {
      const directScore = searchScore(query, moduleText(module));
      const knowledgeMatches = this.knowledgeRegistry.list()
        .filter(project => project.sourceApplication === module.id)
        .map(project => ({ project, score: searchScore(query, projectText(project)) }))
        .filter(match => match.score > 0)
        .sort((a, b) => b.score - a.score);
      const score = Math.max(directScore, knowledgeMatches[0]?.score || 0);
      return Object.freeze({ module, score, knowledgeMatches: Object.freeze(knowledgeMatches.slice(0, 3)) });
    }).filter(result => result.score > 0)
      .sort((a, b) => b.score - a.score || a.module.name.localeCompare(b.module.name))
      .slice(0, Math.max(0, limit));
  }

  getRelatedModules(id) {
    const module = this.getModule(id);
    if (!module) return [];
    const explicit = module.relatedModules.map(relatedId => this.getModule(relatedId)).filter(Boolean);
    const explicitIds = new Set(explicit.map(item => item.id));
    const capabilityTokens = tokenize(module.capabilities.join(' '));
    const inferred = this.getModules().filter(candidate => candidate.id !== module.id && !explicitIds.has(candidate.id))
      .map(candidate => ({ candidate, score: tokenOverlapScore(capabilityTokens, tokenize(candidate.capabilities.join(' '))) }))
      .filter(item => item.score > 0).sort((a, b) => b.score - a.score).map(item => item.candidate);
    return [...explicit, ...inferred];
  }
}

export function createProjectFederation(options) { return new ProjectFederation(options); }
