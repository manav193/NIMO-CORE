import { PROJECTS } from '../knowledge/projects.js';

function normalize(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[–—]/g, '-')
    .replace(/[^a-z0-9+.#\-\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function findProject(text) {
  const value = normalize(text);
  return PROJECTS.find(project =>
    [project.name, project.id, ...(project.aliases || [])]
      .map(normalize)
      .some(alias => alias && value.includes(alias))
  );
}

function findTechnology(text) {
  const value = normalize(text);
  const matches = [];

  for (const project of PROJECTS) {
    for (const technology of project.technologies || []) {
      const normalizedTechnology = normalize(technology);
      if (normalizedTechnology && value.includes(normalizedTechnology)) {
        matches.push({ project, technology });
      }
    }
  }

  return matches;
}

export function resolveDeterministicReply(message, history = []) {
  const text = normalize(message);
  if (!text || history.length > 0) return null;

  const technologyQuestion = /\b(which|what)\s+(project|one|app|game).*\b(use|uses|using|built with)\b/.test(text)
    || /\bwhere\s+is\b.*\bused\b/.test(text);

  if (technologyQuestion) {
    const matches = findTechnology(text);
    if (matches.length === 1) {
      const [{ project, technology }] = matches;
      return {
        reply: `${project.name} uses ${technology}.`,
        source: 'deterministic_technology'
      };
    }

    if (matches.length > 1) {
      const names = [...new Set(matches.map(match => match.project.name))];
      return {
        reply: `${names.join(' and ')} use that technology.`,
        source: 'deterministic_technology'
      };
    }
  }

  const project = findProject(text);
  const asksTech = /\b(tech|technology|technologies|stack|built with|uses)\b/.test(text);
  if (project && asksTech && project.technologies?.length) {
    return {
      reply: `${project.name} uses ${project.technologies.join(', ')}.`,
      source: 'deterministic_project_stack'
    };
  }

  return null;
}
