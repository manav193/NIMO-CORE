import { normalizeText, tokenize } from '../utils/normalize-text.js';
import { DuplicateKnowledgeError } from '../utils/validation.js';
import { normalizeModuleManifest } from './manifest-schema.js';

const searchableText = module => [module.name, module.description, module.type, ...module.keywords, ...module.capabilities].join(' ');
const queryCoverage = (query, candidate) => {
  const queryTokens = new Set(tokenize(query));
  const candidateTokens = new Set(tokenize(candidate));
  if (!queryTokens.size) return 0;
  let matches = 0;
  queryTokens.forEach(token => { if (candidateTokens.has(token)) matches += 1; });
  return matches / queryTokens.size;
};

const normalizeId = id => String(id || '').trim().toLowerCase();

export class ModuleRegistry {
  #modules = new Map();

  registerModule(definition) {
    const module = normalizeModuleManifest(definition);
    const key = normalizeId(module.id);
    if (this.#modules.has(key)) throw new DuplicateKnowledgeError(`module:${module.id}`, module.id, module.id);
    this.#modules.set(key, module);
    return module;
  }

  unregisterModule(id) {
    const key = normalizeId(id);
    const existing = this.#modules.get(key) || null;
    if (existing) this.#modules.delete(key);
    return existing;
  }

  getModule(id) { return this.#modules.get(normalizeId(id)) || null; }
  getModules() { return [...this.#modules.values()]; }

  findByCapability(capability) {
    const query = tokenize(capability);
    return this.getModules().filter(module => queryCoverage(query, module.capabilities.join(' ')) > 0);
  }

  findByKeyword(keyword) {
    const query = tokenize(keyword);
    return this.getModules()
      .map(module => ({ module, score: queryCoverage(query, searchableText(module)) }))
      .filter(result => result.score > 0)
      .sort((a, b) => b.score - a.score || a.module.name.localeCompare(b.module.name));
  }
}

export function createModuleRegistry() { return new ModuleRegistry(); }

const defaultModuleRegistry = createModuleRegistry();
export function registerModule(definition, registry = defaultModuleRegistry) { return registry.registerModule(definition); }
export function unregisterModule(id, registry = defaultModuleRegistry) { return registry.unregisterModule(id); }
export function getModule(id, registry = defaultModuleRegistry) { return registry.getModule(id); }
export function getModules(registry = defaultModuleRegistry) { return registry.getModules(); }
export function findByCapability(value, registry = defaultModuleRegistry) { return registry.findByCapability(value); }
export function findByKeyword(value, registry = defaultModuleRegistry) { return registry.findByKeyword(value); }
export function getDefaultModuleRegistry() { return defaultModuleRegistry; }
