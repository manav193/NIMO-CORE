import { normalizeText } from './utils/normalize-text.js';
import { scoreAliases } from './utils/scoring.js';

export function matchEntity(query, projects = [], { minimumScore = 0.42 } = {}) {
  const normalized = normalizeText(query);
  if (!normalized || !Array.isArray(projects) || !projects.length) return null;
  let best = null;
  for (const project of projects) {
    if (!project || typeof project !== 'object') continue;
    const aliases = [
      project.id,
      project.name,
      ...(Array.isArray(project.aliases) ? project.aliases : []),
      ...(Array.isArray(project.keywords) ? project.keywords : [])
    ].filter(Boolean);
    const score = scoreAliases(normalized, aliases.map(normalizeText));
    if (!best || score > best.score) best = { entity: project, score };
  }
  return best && best.score >= minimumScore ? best : null;
}

export function matchEntities(query, projects, options) {
  const match = matchEntity(query, projects, options);
  return { project: match?.entity || null, projectScore: match?.score || 0 };
}
