export { NimoEngine, createNimoEngine } from './core/nimo-engine.js';
export { ContextResolver } from './context-resolver.js';
export { detectLanguage } from './language-detector.js';
export { matchEntity, matchEntities } from './entity-matcher.js';
export { routeIntent } from './intent-router.js';
export { buildResponse } from './response-builder.js';
export { NIMO_PERSONA } from './persona/nimo-persona.js';
export { KnowledgeRegistry, createKnowledgeRegistry, registerProjectSource, getDefaultRegistry } from './knowledge/registry.js';
export { normalizeProjectEntry, normalizeProjectSource } from './knowledge/schema.js';
export { NIMO_GLOSSARY } from './knowledge/glossary.js';
export { ARCADE_OS_PROJECTS_SOURCE } from './knowledge/sources/arcade-os-projects.js';
export { createArcadeOsAdapter } from './adapters/arcade-os-adapter.js';
export { createToolVerseAdapter } from './adapters/toolverse-adapter.js';
export { createGenericProjectAdapter } from './adapters/generic-project-adapter.js';
export { createBrowserClient } from './integrations/browser-client.js';
export { normalizeText, tokenize } from './utils/normalize-text.js';
export { scoreAliases, tokenOverlapScore, clampScore } from './utils/scoring.js';
export { KnowledgeValidationError, DuplicateKnowledgeError, assertPlainObject, sanitizeObject } from './utils/validation.js';
export { OpenRouterProvider, createOpenRouterProvider } from './services/openrouter.js';
export { createServer, startServer } from './server/server.js';
export { normalizeModuleManifest, MODULE_MANIFEST_STATUSES } from './federation/manifest-schema.js';
export {
  ModuleRegistry, createModuleRegistry, registerModule, unregisterModule, getModule,
  getModules, findByCapability, findByKeyword, getDefaultModuleRegistry
} from './federation/module-registry.js';
export { ProjectFederation, createProjectFederation } from './federation/project-federation.js';
export {
  PROJECT_EVENT_TYPES, SYSTEM_STATUS_TYPES, createProjectEvent, isProjectEvent, createSystemStatus
} from './federation/project-events.js';
export { createModuleNavigationAction } from './federation/navigation-contract.js';
export {
  normalizeAdaptiveSessionContext, ADAPTIVE_INTERACTION_MODES, ADAPTIVE_QUALITY_MODES
} from './adaptive/session-context.js';

export default {
  async fetch(request, env = {}) {
    const origin = request.headers.get('Origin');
    const allowed = String(env.ALLOWED_ORIGINS || 'https://manavagarwal.me,http://localhost:8787')
      .split(',')
      .map(v => v.trim())
      .filter(Boolean);
    const isAllowed = origin ? allowed.includes(origin) : true;
    const requestId = request.headers.get('X-Request-ID') || crypto.randomUUID();

    const corsHeaders = {
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Request-ID',
      'Access-Control-Max-Age': '86400',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'X-Request-ID': requestId,
      ...(origin && isAllowed ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' } : {})
    };

    if (request.method === 'OPTIONS') {
      if (origin && !isAllowed) return new Response(JSON.stringify({ error: 'Origin not allowed' }), { status: 403 });
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const url = new URL(request.url);
    if (url.pathname === '/api/health' && request.method === 'GET') {
      return new Response(JSON.stringify({
        status: 'ok',
        version: '0.2.0',
        runtime: 'cloudflare-worker',
        timestamp: new Date().toISOString()
      }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    if ((url.pathname === '/api/nimo/chat' || url.pathname === '/v1/chat') && request.method === 'POST') {
      let body;
      try { body = await request.json(); } catch {
        return new Response(JSON.stringify({ success: false, error: 'Invalid JSON payload' }), { status: 400, headers: corsHeaders });
      }
      const message = typeof body?.message === 'string' ? body.message.trim() : null;
      if (!message) {
        return new Response(JSON.stringify({ success: false, error: 'Missing or invalid "message" string' }), { status: 400, headers: corsHeaders });
      }

      const { createNimoEngine } = await import('./core/nimo-engine.js');
      const { createGenericProjectAdapter } = await import('./adapters/generic-project-adapter.js');
      const { ARCADE_OS_PROJECTS_SOURCE } = await import('./knowledge/sources/arcade-os-projects.js');
      const engine = createNimoEngine({ adapters: [createGenericProjectAdapter({ source: ARCADE_OS_PROJECTS_SOURCE })] });
      const response = engine.respond(message, body.context || {});

      if (response.intent === 'fallback' && env.OPENROUTER_API_KEY) {
        const { createOpenRouterProvider } = await import('./services/openrouter.js');
        const provider = createOpenRouterProvider({
          apiKey: env.OPENROUTER_API_KEY,
          models: env.OPENROUTER_MODELS ? env.OPENROUTER_MODELS.split(',') : null
        });
        const ai = await provider.complete({ messages: [{ role: 'user', content: message }], requestId });
        if (ai.success) {
          return new Response(JSON.stringify({
            success: true,
            reply: ai.reply,
            model: ai.model,
            source: 'openrouter',
            actions: [],
            context: response.context
          }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
        }
      }

      return new Response(JSON.stringify({
        success: true,
        reply: response.text,
        model: response.intent,
        source: 'core',
        actions: response.actions || [],
        recommendations: response.recommendations || [],
        context: response.context
      }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    return new Response(JSON.stringify({ error: 'Not Found' }), { status: 404, headers: corsHeaders });
  }
};

