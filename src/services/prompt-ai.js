/**
 * Prompt-Aii bridge for NIMO-CORE.
 *
 * Prompt-Aii remains the prompt-compilation backend; NIMO-CORE owns
 * orchestration, context, action state, and execution boundaries.
 */

import { createPromptAiiLearningEvent } from '../learning/prompt-aii-events.js';

const DEFAULT_TIMEOUT_MS = 12000;

function cleanBaseUrl(value) {
  return String(value || '').trim().replace(/\/+$/, '');
}

function resolveFetch(fetchFn) {
  if (typeof fetchFn === 'function') return (url, init) => fetchFn(url, init);
  return (url, init) => globalThis.fetch(url, init);
}

function validatePlan(plan) {
  if (!plan || typeof plan !== 'object' || Array.isArray(plan)) {
    return { ok: false, error: 'INVALID_PLAN' };
  }
  if (typeof plan.goal !== 'string' || !plan.goal.trim()) {
    return { ok: false, error: 'MISSING_GOAL' };
  }
  if (!Array.isArray(plan.steps)) {
    return { ok: false, error: 'MISSING_STEPS' };
  }
  return { ok: true };
}

export class PromptAIClient {
  constructor({
    baseUrl = globalThis.process?.env?.PROMPT_AI_URL || 'http://localhost:3001',
    integrationKey = globalThis.process?.env?.NIMO_INTEGRATION_KEY || null,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    fetchFn = null,
    learningStore = null,
    onLearningEvent = null
  } = {}) {
    this.baseUrl = cleanBaseUrl(baseUrl);
    this.integrationKey = typeof integrationKey === 'string' && integrationKey.trim()
      ? integrationKey.trim()
      : null;
    this.timeoutMs = Math.max(1000, Number(timeoutMs) || DEFAULT_TIMEOUT_MS);
    this.fetch = resolveFetch(fetchFn);
    this.learningStore = learningStore || null;
    this.onLearningEvent = typeof onLearningEvent === 'function' ? onLearningEvent : null;
  }

  isConfigured() {
    return Boolean(this.integrationKey && this.baseUrl);
  }

  async #recordLearningEvent({ requestId, input, context, executionTarget, model, result, latency }) {
    if (!this.learningStore && !this.onLearningEvent) return;
    try {
      const event = createPromptAiiLearningEvent({
        requestId,
        input,
        intent: context?.intent || null,
        language: context?.language || null,
        target: executionTarget,
        model: typeof model === 'object' ? model : { model },
        strategy: context?.strategy || null,
        outcome: result?.success ? 'success' : 'failure',
        errorCode: result?.success ? null : result?.error || 'PROMPT_AI_FAILURE',
        latency
      });

      if (this.learningStore && typeof this.learningStore.record === 'function') {
        await this.learningStore.record(event);
      }
      if (this.onLearningEvent) {
        try { this.onLearningEvent(event); } catch {}
      }
    } catch {
      // Learning telemetry is fault-isolated from the Prompt-Aii request path.
    }
  }

  async compile({ message, context = {}, executionTarget = 'browser', model = 'NIMO', requestId = null } = {}) {
    const startedAt = Date.now();
    const input = typeof message === 'string' ? message.trim() : '';
    if (!input) {
      const result = { success: false, error: 'INVALID_MESSAGE', source: 'prompt-ai' };
      await this.#recordLearningEvent({ requestId, input, context, executionTarget, model, result, latency: Date.now() - startedAt });
      return result;
    }
    if (!this.isConfigured()) {
      const result = { success: false, error: 'PROMPT_AI_NOT_CONFIGURED', source: 'prompt-ai' };
      await this.#recordLearningEvent({ requestId, input, context, executionTarget, model, result, latency: Date.now() - startedAt });
      return result;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await this.fetch(`${this.baseUrl}/api/integrations/nimo/prompt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-NIMO-Integration-Key': this.integrationKey,
          ...(requestId ? { 'X-Request-ID': requestId } : {})
        },
        body: JSON.stringify({
          message: input,
          context,
          execution_target: executionTarget,
          model
        }),
        signal: controller.signal
      });

      let data = null;
      try { data = await response.json(); } catch {}

      if (!response.ok) {
        const result = {
          success: false,
          error: data?.detail || `HTTP_${response.status}`,
          status: response.status,
          source: 'prompt-ai'
        };
        await this.#recordLearningEvent({ requestId, input, context, executionTarget, model, result, latency: Date.now() - startedAt });
        return result;
      }

      const validation = validatePlan(data);
      if (!validation.ok) {
        const result = { success: false, error: validation.error, source: 'prompt-ai' };
        await this.#recordLearningEvent({ requestId, input, context, executionTarget, model, result, latency: Date.now() - startedAt });
        return result;
      }

      const result = {
        success: true,
        source: 'prompt-ai',
        bridgeVersion: data.bridge_version || 'unknown',
        goal: data.goal,
        steps: data.steps.slice(0, 32).map(step => ({
          action: typeof step?.action === 'string' ? step.action.slice(0, 80) : '',
          target: step?.target == null ? null : String(step.target).slice(0, 500),
          input: step?.input == null ? null : String(step.input).slice(0, 2000),
          condition: step?.condition == null ? null : String(step.condition).slice(0, 500)
        })),
        successCriteria: Array.isArray(data.success_criteria) ? data.success_criteria.slice(0, 16) : [],
        safetyNotes: Array.isArray(data.safety_notes) ? data.safety_notes.slice(0, 16) : [],
        request: input,
        context: data.context && typeof data.context === 'object' ? data.context : context
      };
      await this.#recordLearningEvent({ requestId, input, context, executionTarget, model, result, latency: Date.now() - startedAt });
      return result;
    } catch (error) {
      const result = {
        success: false,
        error: error?.name === 'AbortError' ? 'PROMPT_AI_TIMEOUT' : 'PROMPT_AI_NETWORK_FAILURE',
        source: 'prompt-ai'
      };
      await this.#recordLearningEvent({ requestId, input, context, executionTarget, model, result, latency: Date.now() - startedAt });
      return result;
    } finally {
      clearTimeout(timer);
    }
  }
}

export function createPromptAIClient(options) {
  return new PromptAIClient(options);
}
