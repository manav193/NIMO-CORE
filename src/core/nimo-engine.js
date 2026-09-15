import { createKnowledgeRegistry } from '../knowledge/registry.js';
import { ContextResolver } from '../context-resolver.js';
import { detectLanguage } from '../language-detector.js';
import { matchEntity } from '../entity-matcher.js';
import { routeIntent } from '../intent-router.js';
import { buildResponse } from '../response-builder.js';
import { NIMO_PERSONA } from '../persona/nimo-persona.js';

export class NimoEngine {
  constructor({ persona = NIMO_PERSONA, adapters = [], federation = null, registry = federation?.knowledgeRegistry || createKnowledgeRegistry(), contextResolver = new ContextResolver() } = {}) {
    this.persona = persona;
    this.registry = registry;
    this.contextResolver = contextResolver;
    this.adapters = Array.isArray(adapters) ? [...adapters].filter(Boolean) : [];
    this.federation = federation;
    for (const adapter of this.adapters) {
      if (typeof adapter?.getSources === 'function') {
        const sources = adapter.getSources();
        if (Array.isArray(sources)) {
          for (const source of sources) this.registry.registerProjectSource(source);
        }
      }
    }
  }

  respond(input, hostContext = {}) {
    const rawQuery = String(input ?? '').trim();
    const query = rawQuery.length > 8192 ? rawQuery.slice(0, 8192) : rawQuery;
    const language = detectLanguage(query).language;
    const projectList = typeof this.registry?.list === 'function' ? this.registry.list() : [];
    const match = matchEntity(query, projectList);
    const adapterContext = this.adapters.reduce((merged, adapter) => {
      try {
        const ctx = adapter?.getContext?.();
        return ctx && typeof ctx === 'object' ? { ...merged, ...ctx } : merged;
      } catch {
        return merged;
      }
    }, {});
    const safeHostContext = hostContext && typeof hostContext === 'object' ? hostContext : {};
    const context = this.contextResolver.resolve({ explicitProject: match?.entity, hostContext: { ...adapterContext, ...safeHostContext }, query });
    const route = routeIntent(query, { entity: match?.entity, context, registry: this.registry });
    const response = buildResponse(route, { language, registry: this.registry, context, query });
    this.contextResolver.remember({ intent: response.intent, projectId: response.entity?.id || context.projectId });
    return Object.freeze({ ...response, context, executed: false });
  }

  resetContext() { this.contextResolver.reset(); }
}

export function createNimoEngine(options) { return new NimoEngine(options); }
