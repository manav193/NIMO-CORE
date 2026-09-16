import { createKnowledgeRegistry } from '../knowledge/registry.js';
import { ContextResolver } from '../context-resolver.js';
import { detectLanguage } from '../language-detector.js';
import { matchEntity } from '../entity-matcher.js';
import { routeIntent } from '../intent-router.js';
import { buildResponse } from '../response-builder.js';
import { NIMO_PERSONA } from '../persona/nimo-persona.js';
import {
  EVENT_TYPES,
  createLearningEvent,
  extractSafeInputMetadata,
  extractSafeResponseMetadata
} from '../learning/events.js';
import { OUTCOMES } from '../learning/outcomes.js';

export class NimoEngine {
  constructor({
    persona = NIMO_PERSONA,
    adapters = [],
    federation = null,
    registry = federation?.knowledgeRegistry || createKnowledgeRegistry(),
    contextResolver = new ContextResolver(),
    learningStore = null,
    onEvent = null
  } = {}) {
    this.persona = persona;
    this.registry = registry;
    this.contextResolver = contextResolver;
    this.adapters = Array.isArray(adapters) ? [...adapters].filter(Boolean) : [];
    this.federation = federation;
    this.learningStore = learningStore || null;
    this.onEvent = typeof onEvent === 'function' ? onEvent : null;
    for (const adapter of this.adapters) {
      if (typeof adapter?.getSources === 'function') {
        const sources = adapter.getSources();
        if (Array.isArray(sources)) {
          for (const source of sources) this.registry.registerProjectSource(source);
        }
      }
    }
  }

  respond(input, hostContext = {}, options = {}) {
    const startTime = Date.now();
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

    // Fault-isolated learning observation
    const activeStore = options.learningStore || this.learningStore;
    const activeOnEvent = options.onEvent || this.onEvent;

    if (activeStore || activeOnEvent) {
      try {
        const isFallback = response.intent === 'fallback';
        const event = createLearningEvent({
          requestId: safeHostContext.requestId || options.requestId || null,
          eventType: isFallback ? EVENT_TYPES.DETERMINISTIC_RESOLUTION : EVENT_TYPES.INTERACTION_SUCCESS,
          source: 'core',
          intent: response.intent || null,
          project: response.entity?.id || context.projectId || null,
          language,
          inputMetadata: extractSafeInputMetadata(query),
          responseMetadata: extractSafeResponseMetadata(response),
          outcome: isFallback ? OUTCOMES.UNKNOWN : OUTCOMES.SUCCESS,
          latency: Date.now() - startTime
        });

        if (activeStore && typeof activeStore.record === 'function') {
          Promise.resolve(activeStore.record(event)).catch(() => {});
        }
        if (typeof activeOnEvent === 'function') {
          try { activeOnEvent(event); } catch {}
        }
      } catch {
        // Learning observation failure is safely ignored to protect normal response path
      }
    }

    return Object.freeze({ ...response, context, executed: false });
  }

  resetContext() { this.contextResolver.reset(); }
}

export function createNimoEngine(options) { return new NimoEngine(options); }
