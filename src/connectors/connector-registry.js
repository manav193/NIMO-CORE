import { KnowledgeValidationError, DuplicateKnowledgeError } from '../utils/validation.js';

export const CONNECTOR_CAPABILITIES = Object.freeze([
  'email', 'drive', 'messaging', 'calendar', 'storage', 'search', 'webhook'
]);

const normalizeId = value => String(value || '').trim().toLowerCase();

function normalizeConnectorManifest(definition = {}) {
  if (!definition || typeof definition !== 'object') {
    throw new KnowledgeValidationError('Connector manifest must be an object.');
  }
  const id = normalizeId(definition.id);
  if (!id) throw new KnowledgeValidationError('Connector manifest requires id.');
  const capabilities = [...new Set((definition.capabilities || [])
    .map(value => String(value).trim().toLowerCase()).filter(Boolean))];
  const unknown = capabilities.filter(item => !CONNECTOR_CAPABILITIES.includes(item));
  if (unknown.length) throw new KnowledgeValidationError(`Unsupported connector capabilities: ${unknown.join(', ')}`);
  return Object.freeze({
    id,
    name: String(definition.name || id).trim(),
    capabilities: Object.freeze(capabilities),
    scopes: Object.freeze(Array.isArray(definition.scopes) ? [...definition.scopes] : [])
  });
}

export class ConnectorRegistry {
  #connectors = new Map();
  #clients = new Map();

  register(definition, client) {
    const manifest = normalizeConnectorManifest(definition);
    if (this.#connectors.has(manifest.id)) {
      throw new DuplicateKnowledgeError(`connector:${manifest.id}`, manifest.id, manifest.id);
    }
    if (!client || typeof client.execute !== 'function') {
      throw new KnowledgeValidationError('Connector client must implement execute().');
    }
    this.#connectors.set(manifest.id, manifest);
    this.#clients.set(manifest.id, client);
    return manifest;
  }

  get(id) { return this.#connectors.get(normalizeId(id)) || null; }
  getClient(id) { return this.#clients.get(normalizeId(id)) || null; }
  list() { return [...this.#connectors.values()]; }
}
export function createConnectorRegistry() { return new ConnectorRegistry(); }
