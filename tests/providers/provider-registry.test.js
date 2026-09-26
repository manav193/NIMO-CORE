import test from 'node:test';
import assert from 'node:assert/strict';
import { ProviderRegistry, normalizeProviderManifest } from '../../src/providers/provider-registry.js';

test('provider manifest normalizes capabilities', () => {
  const manifest = normalizeProviderManifest({
    id: ' Gemini ',
    name: 'Gemini',
    capabilities: ['chat', 'CHAT', 'vision']
  });
  assert.equal(manifest.id, 'gemini');
  assert.deepEqual(manifest.capabilities, ['chat', 'vision']);
});

test('registry resolves provider by capability', () => {
  const registry = new ProviderRegistry();
  registry.register({ id: 'gemini', name: 'Gemini', capabilities: ['chat'] }, {
    async execute() { return { ok: true }; }
  });
  registry.register({ id: 'muse', name: 'Muse', capabilities: ['messaging'] }, {
    async execute() { return { ok: true }; }
  });
  assert.equal(registry.resolve({ capability: 'messaging' }).id, 'muse');
  assert.equal(registry.getClient('gemini').execute instanceof Function, true);
});
