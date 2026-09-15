import { assertPlainObject, KnowledgeValidationError, sanitizeObject } from '../utils/validation.js';

const stringArray = (value, field) => {
  if (value == null) return [];
  if (!Array.isArray(value) || value.some(item => typeof item !== 'string')) {
    throw new KnowledgeValidationError(`${field} must be an array of strings.`);
  }
  return [...new Set(value.map(item => item.trim()).filter(Boolean))];
};

const optionalString = (value, field) => {
  if (value == null || value === '') return null;
  if (typeof value !== 'string') throw new KnowledgeValidationError(`${field} must be a string.`);
  return value.trim();
};

export function normalizeProjectEntry(entry, source) {
  assertPlainObject(entry, 'Project entry');
  const id = optionalString(entry.id, 'project.id');
  const name = optionalString(entry.name, 'project.name');
  const summary = optionalString(entry.summary ?? entry.description, 'project.summary');
  if (!id || !/^[a-z0-9][a-z0-9-]*$/.test(id)) throw new KnowledgeValidationError('project.id must be a lowercase kebab-case identifier.');
  if (!name) throw new KnowledgeValidationError(`Project "${id}" requires a name.`);
  if (!summary) throw new KnowledgeValidationError(`Project "${id}" requires a summary.`);
  const routes = entry.routes && typeof entry.routes === 'object' ? { ...entry.routes } : {};
  if (entry.route && !routes.open) routes.open = entry.route;
  if (entry.caseStudyUrl && !routes.caseStudy) routes.caseStudy = entry.caseStudyUrl;
  return Object.freeze({
    id,
    name,
    aliases: stringArray(entry.aliases, `${id}.aliases`),
    category: optionalString(entry.category, `${id}.category`) || 'project',
    type: optionalString(entry.type, `${id}.type`) || 'project',
    summary,
    technologies: stringArray(entry.technologies ?? entry.tech, `${id}.technologies`),
    capabilities: stringArray(entry.capabilities, `${id}.capabilities`),
    routes: Object.freeze(routes),
    liveUrl: optionalString(entry.liveUrl, `${id}.liveUrl`),
    caseStudyUrl: optionalString(entry.caseStudyUrl ?? entry.caseStudy, `${id}.caseStudyUrl`),
    limitations: stringArray(entry.limitations, `${id}.limitations`),
    supportedActions: stringArray(entry.supportedActions, `${id}.supportedActions`),
    keywords: stringArray(entry.keywords, `${id}.keywords`),
    acceptedFormats: stringArray(entry.acceptedFormats, `${id}.acceptedFormats`),
    outputFormats: stringArray(entry.outputFormats, `${id}.outputFormats`),
    processingMode: optionalString(entry.processingMode, `${id}.processingMode`),
    sourceApplication: optionalString(entry.sourceApplication, `${id}.sourceApplication`) || source.application || source.id,
    lastUpdatedVersion: optionalString(entry.lastUpdatedVersion, `${id}.lastUpdatedVersion`) || source.version,
    metadata: Object.freeze(sanitizeObject(entry.metadata || {}))
  });
}

export function normalizeProjectSource(sourceDefinition) {
  assertPlainObject(sourceDefinition, 'Project source');
  const id = optionalString(sourceDefinition.id, 'source.id');
  const version = optionalString(sourceDefinition.version, 'source.version');
  if (!id) throw new KnowledgeValidationError('source.id is required.');
  if (!version) throw new KnowledgeValidationError(`Source "${id}" requires a version.`);
  if (!Array.isArray(sourceDefinition.projects)) throw new KnowledgeValidationError(`Source "${id}" requires a projects array.`);
  const source = { id, version, application: optionalString(sourceDefinition.application, 'source.application') || id };
  return Object.freeze({ ...source, projects: Object.freeze(sourceDefinition.projects.map(entry => normalizeProjectEntry(entry, source))) });
}
