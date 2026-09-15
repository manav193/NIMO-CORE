import { KnowledgeValidationError, assertPlainObject } from '../utils/validation.js';

const arrayOfStrings = (value, field) => {
  if (value == null) return [];
  if (!Array.isArray(value) || value.some(item => typeof item !== 'string')) throw new KnowledgeValidationError(`${field} must be an array of strings.`);
  return value;
};

export function createToolVerseAdapter(manifest, { getContext = () => ({}) } = {}) {
  assertPlainObject(manifest, 'ToolVerse manifest');
  if (typeof manifest.version !== 'string' || !manifest.version.trim()) throw new KnowledgeValidationError('ToolVerse manifest.version is required.');
  if (!Array.isArray(manifest.tools)) throw new KnowledgeValidationError('ToolVerse manifest.tools must be an array.');

  const projects = manifest.tools.map((tool, index) => {
    assertPlainObject(tool, `ToolVerse tool at index ${index}`);
    if (typeof tool.id !== 'string' || typeof tool.name !== 'string' || typeof tool.description !== 'string' || typeof tool.route !== 'string') {
      throw new KnowledgeValidationError(`ToolVerse tool at index ${index} requires id, name, description, and route strings.`);
    }
    return {
      id: tool.id,
      name: tool.name,
      aliases: arrayOfStrings(tool.aliases, `${tool.id}.aliases`),
      category: tool.category || 'utility',
      type: 'browser utility',
      summary: tool.description,
      routes: { open: tool.route },
      keywords: arrayOfStrings(tool.keywords, `${tool.id}.keywords`),
      acceptedFormats: arrayOfStrings(tool.acceptedFormats, `${tool.id}.acceptedFormats`),
      outputFormats: arrayOfStrings(tool.outputFormats, `${tool.id}.outputFormats`),
      processingMode: tool.processingMode || null,
      capabilities: arrayOfStrings(tool.capabilities, `${tool.id}.capabilities`),
      limitations: arrayOfStrings(tool.limitations, `${tool.id}.limitations`),
      supportedActions: ['lookup', 'recommend', 'navigate'],
      sourceApplication: 'toolverse',
      lastUpdatedVersion: manifest.version
    };
  });

  const source = { id: 'toolverse', application: 'ToolVerse', version: manifest.version, projects };
  return Object.freeze({
    id: 'toolverse',
    kind: 'toolverse',
    manifestVersion: manifest.version,
    getSources: () => [source],
    getContext,
    executeAction: undefined
  });
}
