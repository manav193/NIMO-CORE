import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createNimoEngine,
  createKnowledgeRegistry,
  createProjectFederation,
  assertPlainObject,
  sanitizeObject,
  KnowledgeValidationError
} from '../../src/index.js';

test('assertPlainObject rejects prototype pollution keys', () => {
  assert.throws(() => {
    assertPlainObject({ __proto__: { admin: true } }, 'test');
  }, KnowledgeValidationError);

  assert.throws(() => {
    assertPlainObject({ constructor: function() {} }, 'test');
  }, KnowledgeValidationError);

  assert.throws(() => {
    assertPlainObject({ prototype: {} }, 'test');
  }, KnowledgeValidationError);
});

test('sanitizeObject strips dangerous prototype keys', () => {
  const malformed = JSON.parse('{"valid":"yes","__proto__":{"polluted":true},"nested":{"safe":123}}');
  const cleaned = sanitizeObject(malformed);
  assert.equal(cleaned.valid, 'yes');
  assert.equal(cleaned.nested.safe, 123);
  assert.equal({}.polluted, undefined);
});

test('knowledge registry rejects malformed source with prototype injection', () => {
  const registry = createKnowledgeRegistry();
  const evilPayload = JSON.parse('{"id":"evil","version":"1.0.0","projects":[{"id":"demo","name":"Demo","summary":"Test","__proto__":{"hacked":true}}]}');
  assert.throws(() => {
    registry.registerProjectSource(evilPayload);
  }, KnowledgeValidationError);
  assert.equal({}.hacked, undefined);
});

test('federation rejects manifest with prototype injection', () => {
  const federation = createProjectFederation();
  const evilManifest = JSON.parse('{"id":"evil","name":"Evil","version":"1.0.0","type":"tool","description":"Hack","entry":"index.html","knowledge":"k.json","status":"stable","__proto__":{"hacked":true}}');
  assert.throws(() => {
    federation.registerModule(evilManifest);
  }, KnowledgeValidationError);
  assert.equal({}.hacked, undefined);
});

test('NimoEngine safely handles massive input strings without crashing', () => {
  const engine = createNimoEngine();
  const massiveInput = 'tell me about nimo '.repeat(5000); // ~100 KB
  const response = engine.respond(massiveInput);
  assert.equal(response.executed, false);
  assert.ok(typeof response.text === 'string');
});

test('NimoEngine never executes navigation or actions internally', () => {
  const engine = createNimoEngine();
  const response = engine.respond('Who are you?');
  assert.equal(response.executed, false);
  assert.equal(typeof response.text, 'string');
});
