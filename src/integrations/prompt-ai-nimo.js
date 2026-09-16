import { createPromptAIClient } from '../services/prompt-ai.js';

/**
 * Bridge NIMO natural-language requests through Prompt-Aii before execution.
 * The returned plan is descriptive only: NIMO's host remains responsible for
 * performing actions and reporting completion.
 */
export function createPromptAINimoBridge(options = {}) {
  const client = options.client || createPromptAIClient(options);

  return Object.freeze({
    async compile(input, context = {}, bridgeOptions = {}) {
      return client.compile({
        message: input,
        context,
        executionTarget: bridgeOptions.executionTarget || 'browser',
        model: bridgeOptions.model || 'NIMO',
        requestId: bridgeOptions.requestId || context?.requestId || null
      });
    }
  });
}
