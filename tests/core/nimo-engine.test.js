import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createArcadeOsAdapter,
  createGenericProjectAdapter,
  createNimoEngine,
  createToolVerseAdapter
} from '../../src/index.js';

const projectSource = {
  id: 'portfolio-projects',
  version: '1.0.0',
  projects: [
    { id: 'nimo', name: 'NIMO', aliases: ['नीमो'], category: 'system', type: 'assistant', summary: 'A local-first multilingual project assistant.', routes: { caseStudy: 'project-nimo.html' } },
    { id: 'shift-zero', name: 'SHIFT-ZERO', aliases: ['shift zero', 'शिफ्ट जीरो'], category: 'game', type: 'game foundation', summary: 'A gravity-shifting Godot game foundation.', routes: { caseStudy: 'project-shift-zero.html' } },
    { id: 'toolverse-project', name: 'ToolVerse', aliases: ['tool verse'], category: 'web', type: 'web application', summary: 'A browser utility collection.', routes: { open: 'https://toolverse.example/' } }
  ]
};

const toolManifest = {
  version: '1.2.0',
  tools: [
    { id: 'compress-image', name: 'Compress Image', category: 'image', description: 'Reduce image file size.', route: 'tools/compress-image.html', keywords: ['compress', 'image', 'target size'], acceptedFormats: ['image/jpeg', 'image/png'], outputFormats: ['image/jpeg'], processingMode: 'local', capabilities: ['reduce an image below a target size'], limitations: [] },
    { id: 'merge-pdf', name: 'Merge PDF', category: 'pdf', description: 'Merge PDF files.', route: 'tools/merge-pdf.html', keywords: ['merge', 'pdf', 'combine'], acceptedFormats: ['application/pdf'], outputFormats: ['application/pdf'], processingMode: 'local', capabilities: ['merge files'], limitations: [] },
    { id: 'resize-image', name: 'Resize Image', category: 'image', description: 'Resize image dimensions.', route: 'tools/resize-image.html', keywords: ['resize', 'image'], acceptedFormats: ['image/jpeg', 'image/png'], outputFormats: ['image/jpeg', 'image/png'], processingMode: 'local', capabilities: ['change image dimensions'], limitations: [] }
  ]
};

const createEngine = () => createNimoEngine({ adapters: [
  createGenericProjectAdapter({ source: projectSource }),
  createToolVerseAdapter(toolManifest)
] });

test('answers an English project query', () => {
  const response = createEngine().respond('Tell me about SHIFT-ZERO');
  assert.equal(response.intent, 'project_lookup');
  assert.match(response.text, /gravity-shifting Godot/i);
});

test('answers a Hinglish project query', () => {
  const response = createEngine().respond('ToolVerse ke baare mein batao');
  assert.equal(response.language, 'hinglish');
  assert.equal(response.entity.id, 'toolverse-project');
});

test('answers a Hindi project query', () => {
  const response = createEngine().respond('शिफ्ट जीरो के बारे में बताओ');
  assert.equal(response.language, 'hi');
  assert.equal(response.entity.id, 'shift-zero');
});

test('recommends a verified ToolVerse tool', () => {
  const response = createEngine().respond('Which tool should I use to merge PDF files?');
  assert.equal(response.intent, 'recommendation');
  assert.equal(response.recommendations[0].id, 'merge-pdf');
});

test('uses current-page context', () => {
  const response = createEngine().respond('Where am I?', { currentPage: 'ToolVerse / Image Tools' });
  assert.equal(response.intent, 'current_context');
  assert.match(response.text, /ToolVerse \/ Image Tools/);
});

test('resolves a follow-up against the last project', () => {
  const engine = createEngine();
  engine.respond('Tell me about ToolVerse');
  const response = engine.respond('Open it');
  assert.equal(response.intent, 'open_entity');
  assert.equal(response.actions[0].target, 'https://toolverse.example/');
});

test('returns an honest unknown-intent fallback', () => {
  const response = createEngine().respond('quantum banana weather orchestra');
  assert.equal(response.intent, 'fallback');
  assert.match(response.text, /verified information/i);
});

test('generates actions without executing navigation', () => {
  const response = createEngine().respond('Open Compress Image');
  assert.equal(response.actions[0].type, 'navigate');
  assert.equal(response.actions[0].target, 'tools/compress-image.html');
  assert.equal(response.executed, false);
});

test('returns declared local-processing and format facts only', () => {
  const engine = createEngine();
  engine.respond('Tell me about Compress Image');
  assert.match(engine.respond('Does this tool work locally?').text, /local/);
  const formats = engine.respond('What formats does it support?').text;
  assert.match(formats, /image\/jpeg/);
  assert.doesNotMatch(formats, /webp/i);
});

test('prepares Arcade events without executing them', () => {
  const arcade = createArcadeOsAdapter({ version: '1.0.0', projects: [{ id: 'arcade-os', name: 'Arcade OS', aliases: ['arcade'], category: 'system', type: 'system', summary: 'Browser arcade.' }] });
  const response = createNimoEngine({ adapters: [arcade] }).respond('repair arcade');
  assert.deepEqual(response.actions[0], { type: 'arcade-event', target: null, label: 'Run repair', event: 'repair-tool' });
  assert.equal(response.executed, false);
});
