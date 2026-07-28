import { PROJECT_IDS } from '../knowledge/projects.js';

const ALLOWED_LANGUAGES = new Set(['en', 'hi', 'hinglish']);
const ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;

function cleanId(value, fallback = null) {
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim().toLowerCase();
  return ID_PATTERN.test(normalized) ? normalized : fallback;
}

export function validateChatPayload(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, status: 400, error: 'Invalid JSON payload.' };
  }

  const message = typeof input.message === 'string' ? input.message.trim() : '';
  if (!message) return { ok: false, status: 400, error: 'Message is required.' };
  if (message.length > 1000) return { ok: false, status: 400, error: 'Message exceeds 1000 characters.' };

  const rawContext = input.context && typeof input.context === 'object' ? input.context : {};
  const projectId = cleanId(rawContext.projectId || rawContext.project);
  const context = {
    projectId: projectId && PROJECT_IDS.has(projectId) ? projectId : null,
    pageId: cleanId(rawContext.pageId || rawContext.page, 'home'),
    sectionId: cleanId(rawContext.sectionId || rawContext.section, 'home'),
    language: ALLOWED_LANGUAGES.has(rawContext.language) ? rawContext.language : 'en'
  };

  const rawHistory = Array.isArray(input.history) ? input.history.slice(-10) : [];
  const history = rawHistory
    .filter(item => item && (item.role === 'user' || item.role === 'assistant') && typeof item.content === 'string')
    .map(item => ({ role: item.role, content: item.content.trim().slice(0, 1000) }))
    .filter(item => item.content);

  return { ok: true, value: { message, context, history } };
}
