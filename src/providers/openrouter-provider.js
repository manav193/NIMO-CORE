import { OpenRouterProvider } from '../services/openrouter.js';

export function createOpenRouterProviderManifest() {
  return {
    id: 'openrouter',
    name: 'OpenRouter',
    type: 'ai',
    capabilities: ['chat', 'vision', 'code']
  };
}

export function createOpenRouterProviderAdapter(options = {}) {
  const client = new OpenRouterProvider(options);
  return {
    manifest: createOpenRouterProviderManifest(),
    client,
    async execute(input) {
      return client.complete(input);
    }
  };
}
