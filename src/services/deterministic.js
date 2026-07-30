import { PROJECTS } from '../knowledge/projects.js';

const CANONICAL_CONTACT_EMAIL = 'monographpixel@gmail.com';

function normalize(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[–—]/g, '-')
    .replace(/[^a-z0-9+.#\-\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getAliases(project) {
  return [project.name, project.id, ...(project.aliases || [])].map(normalize).filter(Boolean);
}

function findProject(text) {
  const value = normalize(text);
  return PROJECTS.find(project => getAliases(project).some(alias => value.includes(alias)));
}

function findMentionedProjects(text) {
  const value = normalize(text);
  return PROJECTS.filter(project => getAliases(project).some(alias => value.includes(alias)));
}

function findTechnology(text) {
  const value = normalize(text);
  const matches = [];
  for (const project of PROJECTS) {
    for (const technology of project.technologies || []) {
      const normalizedTechnology = normalize(technology);
      if (normalizedTechnology && value.includes(normalizedTechnology)) matches.push({ project, technology });
    }
  }
  return matches;
}

function compareProjects(first, second) {
  const firstStack = first.technologies?.length ? ` Its verified stack includes ${first.technologies.join(', ')}.` : '';
  const secondStack = second.technologies?.length ? ` Its verified stack includes ${second.technologies.join(', ')}.` : '';
  return `${first.name} is ${first.summary.toLowerCase()}${firstStack}\n\n${second.name} is ${second.summary.toLowerCase()}${secondStack}\n\nIn simple terms, ${first.name} and ${second.name} serve different roles: one is ${first.tags?.includes('frontend') || first.tags?.includes('portfolio') ? 'a frontend showcase' : 'a software service or product'}, while the other is ${second.tags?.includes('frontend') || second.tags?.includes('portfolio') ? 'a frontend showcase' : 'a software service or product'}.`;
}

export function resolveDeterministicReply(message, history = []) {
  const text = normalize(message);
  if (!text) return null;

  if (/\b(email|e mail|mail|contact|reach|contact address)\b/.test(text)) {
    return {
      reply: `Manav's official contact email is ${CANONICAL_CONTACT_EMAIL}.`,
      source: 'deterministic_contact'
    };
  }

  const comparisonQuestion = /\b(compare|comparison|difference|versus|vs|between)\b/.test(text);
  if (comparisonQuestion) {
    const projects = findMentionedProjects(text);
    if (projects.length === 2) return { reply: compareProjects(projects[0], projects[1]), source: 'deterministic_comparison' };
  }

  if (history.length > 0) return null;

  const technologyQuestion = /\b(which|what)\s+(project|one|app|game).*\b(use|uses|using|built with)\b/.test(text)
    || /\bwhere\s+is\b.*\bused\b/.test(text);

  if (technologyQuestion) {
    const matches = findTechnology(text);
    if (matches.length === 1) {
      const [{ project, technology }] = matches;
      return { reply: `${project.name} uses ${technology}.`, source: 'deterministic_technology' };
    }
    if (matches.length > 1) {
      const names = [...new Set(matches.map(match => match.project.name))];
      return { reply: `${names.join(' and ')} use that technology.`, source: 'deterministic_technology' };
    }
  }

  const project = findProject(text);
  const asksTech = /\b(tech|technology|technologies|stack|built with|uses)\b/.test(text);
  if (project && asksTech && project.technologies?.length) {
    return { reply: `${project.name} uses ${project.technologies.join(', ')}.`, source: 'deterministic_project_stack' };
  }

  return null;
}