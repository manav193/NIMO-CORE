const SECRET_KEY_PATTERN = /(key|token|secret|password|authorization|credential)/i;

export function redactSecrets(value) {
  if (Array.isArray(value)) return value.map(redactSecrets);
  if (!value || typeof value !== 'object') return value;
  const result = {};
  for (const [key, current] of Object.entries(value)) {
    result[key] = SECRET_KEY_PATTERN.test(key)
      ? '[REDACTED]'
      : redactSecrets(current);
  }
  return result;
}

export function createCredentialReference({
  id,
  provider,
  secretName,
  scopes = []
} = {}) {
  if (!id || !provider || !secretName) {
    throw new TypeError('Credential references require id, provider and secretName.');
  }
  return Object.freeze({
    id: String(id),
    provider: String(provider),
    secretName: String(secretName),
    scopes: Object.freeze(Array.isArray(scopes) ? [...scopes] : [])
  });
}
