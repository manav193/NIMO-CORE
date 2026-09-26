import test from 'node:test';
import assert from 'node:assert/strict';
import { redactSecrets, createCredentialReference } from '../../src/credentials/credential-references.js';

test('redacts secret-shaped fields recursively', () => {
  assert.deepEqual(redactSecrets({
    apiKey: 'secret',
    nested: { accessToken: 'token', visible: 'ok' }
  }), {
    apiKey: '[REDACTED]',
    nested: { accessToken: '[REDACTED]', visible: 'ok' }
  });
});

test('credential reference stores a secret name, not the raw secret', () => {
  const ref = createCredentialReference({
    id: 'gemini-main',
    provider: 'gemini',
    secretName: 'GEMINI_API_KEY',
    scopes: ['chat']
  });
  assert.equal(ref.secretName, 'GEMINI_API_KEY');
  assert.equal('apiKey' in ref, false);
});
