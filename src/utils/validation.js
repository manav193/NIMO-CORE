export class KnowledgeValidationError extends TypeError {
  constructor(message, details = []) {
    super(message);
    this.name = 'KnowledgeValidationError';
    this.details = details;
  }
}

export class DuplicateKnowledgeError extends Error {
  constructor(id, existingSource, incomingSource) {
    super(`Duplicate project id "${id}" from "${incomingSource}"; already registered by "${existingSource}".`);
    this.name = 'DuplicateKnowledgeError';
    this.id = id;
  }
}

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

export function assertPlainObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new KnowledgeValidationError(`${label} must be an object.`);
  }
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) {
    throw new KnowledgeValidationError(`${label} must be a plain object.`);
  }
  for (const key of Object.getOwnPropertyNames(value)) {
    if (FORBIDDEN_KEYS.has(key)) {
      throw new KnowledgeValidationError(`${label} contains disallowed key: ${key}`);
    }
  }
  if (Object.prototype.hasOwnProperty.call(value, '__proto__')) {
    throw new KnowledgeValidationError(`${label} contains disallowed key: __proto__`);
  }
}

export function sanitizeObject(obj = {}) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return {};
  const clean = Object.create(null);
  for (const [key, val] of Object.entries(obj)) {
    if (!FORBIDDEN_KEYS.has(key)) {
      clean[key] = val && typeof val === 'object' && !Array.isArray(val)
        ? sanitizeObject(val)
        : val;
    }
  }
  return { ...clean };
}
