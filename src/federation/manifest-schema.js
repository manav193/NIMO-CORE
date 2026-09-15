import { assertPlainObject, KnowledgeValidationError, sanitizeObject } from '../utils/validation.js';

const STATUSES = new Set(['experimental', 'beta', 'stable', 'maintenance', 'retired']);

const requiredString = (value, field) => {
  if (typeof value !== 'string' || !value.trim()) throw new KnowledgeValidationError(`${field} is required.`);
  return value.trim();
};

const stringArray = (value, field) => {
  if (value == null) return [];
  if (!Array.isArray(value) || value.some(item => typeof item !== 'string')) {
    throw new KnowledgeValidationError(`${field} must be an array of strings.`);
  }
  return [...new Set(value.map(item => item.trim()).filter(Boolean))];
};

export function normalizeModuleManifest(definition) {
  assertPlainObject(definition, 'Module manifest');
  const id = requiredString(definition.id, 'manifest.id');
  if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) throw new KnowledgeValidationError('manifest.id must be lowercase kebab-case.');
  const version = requiredString(definition.version, `${id}.version`);
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) throw new KnowledgeValidationError(`${id}.version must be semantic version syntax.`);
  const status = requiredString(definition.status, `${id}.status`);
  if (!STATUSES.has(status)) throw new KnowledgeValidationError(`${id}.status is not supported.`);
  const navigation = definition.navigation == null ? {} : definition.navigation;
  assertPlainObject(navigation, `${id}.navigation`);
  for (const [key, value] of Object.entries(navigation)) {
    if (typeof value !== 'string' || !value.trim()) throw new KnowledgeValidationError(`${id}.navigation.${key} must be a non-empty string.`);
  }
  return Object.freeze({
    id,
    name: requiredString(definition.name, `${id}.name`),
    version,
    type: requiredString(definition.type, `${id}.type`),
    description: requiredString(definition.description, `${id}.description`),
    icon: typeof definition.icon === 'string' ? definition.icon.trim() : '',
    entry: requiredString(definition.entry, `${id}.entry`),
    knowledge: requiredString(definition.knowledge, `${id}.knowledge`),
    status,
    capabilities: Object.freeze(stringArray(definition.capabilities, `${id}.capabilities`)),
    keywords: Object.freeze(stringArray(definition.keywords, `${id}.keywords`)),
    relatedModules: Object.freeze(stringArray(definition.relatedModules, `${id}.relatedModules`)),
    navigation: Object.freeze({ ...navigation }),
    metadata: Object.freeze(sanitizeObject(definition.metadata || {}))
  });
}

export const MODULE_MANIFEST_STATUSES = Object.freeze([...STATUSES]);
