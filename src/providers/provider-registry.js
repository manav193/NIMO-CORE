import { KnowledgeValidationError, DuplicateKnowledgeError } from '../utils/validation.js';

const normalizeId = value => String(value || '').trim().toLowerCase();

export const PROVIDER_CAPABILITIES = Object.freeze([
  'chat', 'vision', 'image', 'audio', 'code', 'search', 'embedding',
  'email', 'drive', 'messaging', 'calendar', 'storage', 'automation'
]);

function normalizeCapabilities(values = []) {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.map(value => String(value).trim().toLowerCase())
    .filter(Boolean))];
}

export function normalizeProviderManifest(definition = {}) {
  if (!definition || typeof definition !== 'object') {
    throw new KnowledgeValidationError('Provider manifest must be an object.');
  }
  const id = normalizeId(definition.id);
  if (!id) throw new KnowledgeValidationError('Provider manifest requires id.');
  const name = String(definition.name || id).trim();
  const capabilities = normalizeCapabilities(definition.capabilities);
  const unknown = capabilities.filter(capability => !PROVIDER_CAPABILITIES.includes(capability));
  if (unknown.length) {
    throw new KnowledgeValidationError(`Unsupported provider capabilities: ${unknown.join(', ')}`);
  }
  return Object.freeze({
    id,
    name,
    type: String(definition.type || 'ai').trim().toLowerCase(),
    capabilities: Object.freeze(capabilities),
    models: Object.freeze(Array.isArray(definition.models) ? [...definition.models] : []),
    metadata: Object.freeze({ ...(definition.metadata || {}) })
  });
}

export class ProviderRegistry {
  #providers = new Map();
  #clients = new Map();

  register(manifest, client = null) {
    const normalized = normalizeProviderManifest(manifest);
    if (this.#providers.has(normalized.id)) {
      throw new DuplicateKnowledgeError(`provider:${normalized.id}`, normalized.id, normalized.id);
    }
    if (client != null && typeof client !== 'object') {
      throw new KnowledgeValidationError('Provider client must be an object.');
    }
    this.#providers.set(normalized.id, normalized);
    if (client) this.#clients.set(normalized.id, client);
    return normalized;
  }

  unregister(id) {
    const key = normalizeId(id);
    const removed = this.#providers.get(key) || null;
    this.#providers.delete(key);
    this.#clients.delete(key);
    return removed;
  }

  get(id) {
    return this.#providers.get(normalizeId(id)) || null;
  }

  getClient(id) {
    return this.#clients.get(normalizeId(id)) || null;
  }

  list() {
    return [...this.#providers.values()];
  }

  findByCapability(capability) {
    const wanted = normalizeId(capability);
    return this.list().filter(provider => provider.capabilities.includes(wanted));
  }

  resolve({ capability, providerId = null } = {}) {
    if (providerId) {
      const provider = this.get(providerId);
      if (!provider) return null;
      return capability && !provider.capabilities.includes(normalizeId(capability)) ? null : provider;
    }
    return this.findByCapability(capability)[0] || null;
  }
}

export function createProviderRegistry() {
  return new ProviderRegistry();
}
