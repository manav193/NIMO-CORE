export const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
export const DEFAULT_OPENROUTER_MODEL = 'google/gemini-2.0-flash-exp:free';
export const DEFAULT_AI_TEMPERATURE = 0.25;

export function createOpenRouterHeaders(apiKey, appUrl = 'http://localhost:3000') {
  return {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': appUrl,
    'X-Title': 'MIMO Core AI Study Platform'
  };
}
