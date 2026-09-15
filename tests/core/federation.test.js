import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createModuleNavigationAction, createProjectEvent, createProjectFederation, createSystemStatus,
  DuplicateKnowledgeError, isProjectEvent, KnowledgeValidationError
} from '../../src/index.js';

const moduleDefinition = (id, overrides = {}) => ({
  id, name: id === 'toolverse' ? 'ToolVerse' : id, version: '1.0.0', type: 'utility-module',
  description: `${id} ecosystem module`, icon: 'module', entry: `${id}.html`,
  knowledge: `${id}-knowledge.json`, status: 'stable', capabilities: [], keywords: [], ...overrides
});

const knowledge = (id, projects) => ({ id: `${id}-knowledge`, application: id, version: '1.0.0', projects });

test('registers, reads, and unregisters a module with its knowledge atomically', () => {
  const federation = createProjectFederation();
  federation.registerModule(moduleDefinition('toolverse'), knowledge('toolverse', [
    { id: 'compress-image', name: 'Compress Image', summary: 'Reduce image file size locally.' }
  ]));
  assert.equal(federation.getModule('toolverse').name, 'ToolVerse');
  assert.equal(federation.knowledgeRegistry.get('compress-image').sourceApplication, 'toolverse');
  federation.unregisterModule('toolverse');
  assert.equal(federation.getModule('toolverse'), null);
  assert.equal(federation.knowledgeRegistry.get('compress-image'), null);
});

test('prevents duplicate module registration without duplicating knowledge', () => {
  const federation = createProjectFederation();
  federation.registerModule(moduleDefinition('toolverse'), knowledge('toolverse', []));
  assert.throws(() => federation.registerModule(moduleDefinition('toolverse')), DuplicateKnowledgeError);
  assert.equal(federation.getModules().length, 1);
  assert.equal(federation.knowledgeRegistry.listSources().length, 1);
});

test('validates the common manifest contract', () => {
  const federation = createProjectFederation();
  assert.throws(() => federation.registerModule({ id: 'Bad ID' }), KnowledgeValidationError);
  assert.equal(federation.getModules().length, 0);
});

test('merges isolated knowledge and searches across the ecosystem', () => {
  const federation = createProjectFederation();
  federation.registerModule(moduleDefinition('toolverse', { name: 'ToolVerse', capabilities: ['compress images', 'merge PDFs'] }), knowledge('toolverse', [
    { id: 'compress-image', name: 'Compress Image', summary: 'Reduce an image file size.', keywords: ['compress image'] }
  ]));
  federation.registerModule(moduleDefinition('shift-zero', { name: 'SHIFT-ZERO', type: 'game-module', keywords: ['gravity game'] }), knowledge('shift-zero', []));
  federation.registerModule(moduleDefinition('velora-bites', { name: 'Velora Bites', type: 'design-module', keywords: ['restaurant'] }), knowledge('velora-bites', []));
  federation.registerModule(moduleDefinition('arcade-os', { name: 'Arcade OS', type: 'operating-system', keywords: ['portfolio'] }), knowledge('arcade-os', []));
  assert.equal(federation.search('compress image')[0].module.id, 'toolverse');
  assert.equal(federation.search('gravity game')[0].module.id, 'shift-zero');
  assert.equal(federation.search('restaurant')[0].module.id, 'velora-bites');
  assert.equal(federation.search('portfolio')[0].module.id, 'arcade-os');
});

test('resolves explicit and capability-related modules', () => {
  const federation = createProjectFederation();
  federation.registerModule(moduleDefinition('arcade-os', { capabilities: ['project discovery'], relatedModules: ['nimo'] }));
  federation.registerModule(moduleDefinition('nimo', { capabilities: ['project discovery'] }));
  federation.registerModule(moduleDefinition('toolverse', { capabilities: ['browser tools'] }));
  assert.deepEqual(federation.getRelatedModules('arcade-os').map(module => module.id), ['nimo']);
});

test('creates generic events and navigation contracts without executing them', () => {
  const event = createProjectEvent('toolExecuted', { moduleId: 'toolverse', projectId: 'compress-image', detail: { durationMs: 20 } });
  assert.equal(isProjectEvent(event), true);
  const action = createModuleNavigationAction(moduleDefinition('toolverse'));
  assert.deepEqual(action, { type: 'module-navigation', moduleId: 'toolverse', destination: 'open', target: 'toolverse.html', executed: false });
});

test('creates ordered boot and repair event/status records without side effects', () => {
  const types = ['systemBootStarted', 'nimoCoreOnline', 'moduleRegistryReady', 'toolVerseRegistered', 'systemBootCompleted'];
  const events = types.map(type => createProjectEvent(type, { moduleId: 'arcade-os' }));
  assert.deepEqual(events.map(event => event.type), types);
  assert.ok(events.every(event => event.protocol === 'nimo-project-event'));
  const status = createSystemStatus('registry-ready', { moduleId: 'arcade-os', detail: { moduleCount: 8 } });
  assert.equal(status.protocol, 'nimo-system-status');
  assert.equal(status.status, 'registry-ready');
  assert.equal(status.moduleId, 'arcade-os');
  assert.equal(status.detail.moduleCount, 8);
  assert.ok(!Number.isNaN(Date.parse(status.timestamp)));
});
