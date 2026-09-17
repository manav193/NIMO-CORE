import { resolveFetch, sanitizeModelOutput, VERIFIED_FREE_CHAT_MODELS } from './openrouter.js';

const DEFAULT_VISION_MODEL = 'inclusionai/ling-3.0-flash-vl:free';
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 20000;
const DEFAULT_TARGET_MODEL = 'Midjourney';

const TARGET_MODELS = new Set([
  'Midjourney',
  'Stable Diffusion',
  'Flux',
  'Adobe Firefly'
]);

const TARGET_GUIDANCE = {
  Midjourney: 'Reconstruct for Midjourney-style prompting: prioritize subject, composition, visual style, lighting, camera cues when inferable, color palette, environment, and concise parameter-ready phrasing. Do not invent unavailable parameters.',
  'Stable Diffusion': 'Reconstruct for Stable Diffusion-style prompting: prioritize explicit subject attributes, composition, lighting, materials, style, camera cues when inferable, and a separate negative prompt with concrete visual exclusions.',
  Flux: 'Reconstruct for Flux-style prompting: prioritize natural-language scene description, subject relationships, composition, lighting, materials, environment, typography/text only when visible, and precise visual constraints.',
  'Adobe Firefly': 'Reconstruct for Adobe Firefly-style prompting: prioritize clear subject, scene, composition, lighting, color, materials, photographic/art direction, and practical visual constraints without inventing hidden metadata.'
};

const SYSTEM_PROMPT = `You are NIMO-Core's reverse prompt engineering vision specialist. Analyze the supplied image and reconstruct a high-quality image-generation prompt that could plausibly reproduce it. Do not claim to know hidden source prompts or metadata. Infer only visible characteristics. Return ONLY valid JSON with this shape: {"prompt":"...","negative_prompt":"...","analysis":{"subject":"...","composition":"...","lighting":"...","style":"...","colors":"...","environment":"...","camera":"..."}}. Make the prompt detailed and production-ready. Mention camera/lens only when visually inferable; otherwise say unknown/inferred.`;

function imageDataUrl(image) {
  if (!image || typeof image !== 'object') throw new Error('Invalid image payload');
  const mime = typeof image.mimeType === 'string' ? image.mimeType.toLowerCase() : '';
  const base64 = typeof image.base64 === 'string' ? image.base64.replace(/^data:[^,]+,/, '') : '';
  if (!base64) throw new Error('Image data is required');
  if (Buffer.byteLength(base64, 'base64') > MAX_IMAGE_BYTES) throw new Error('Image exceeds 10 MB limit');
  const allowed = new Set(['image/png', 'image/jpeg', 'image/webp']);
  if (!allowed.has(mime)) throw new Error('Unsupported image type');
  return `data:${mime};base64,${base64}`;
}

function resolveTargetModel(value) {
  return typeof value === 'string' && TARGET_MODELS.has(value) ? value : DEFAULT_TARGET_MODEL;
}

export class ReversePromptService {
  constructor({ apiKey = globalThis.process?.env?.OPENROUTER_API_KEY || null, model = null, timeoutMs = DEFAULT_TIMEOUT_MS, fetchFn = null } = {}) {
    this.apiKey = typeof apiKey === 'string' ? apiKey.trim() : null;
    this.model = model || globalThis.process?.env?.NIMO_VISION_MODEL || DEFAULT_VISION_MODEL;
    this.timeoutMs = timeoutMs;
    this.fetch = resolveFetch(fetchFn);
  }

  async analyze({ image, detail = 'high', targetModel = DEFAULT_TARGET_MODEL, requestId = null } = {}) {
    const dataUrl = imageDataUrl(image);
    if (!this.apiKey) return { success: false, error: 'MISSING_API_KEY', message: 'Vision AI provider is not configured.' };
    if (!VERIFIED_FREE_CHAT_MODELS.includes(this.model) && !this.model.includes(':')) {
      return { success: false, error: 'MODEL_NOT_ALLOWED', message: 'Configured vision model is not allowed.' };
    }

    const selectedTarget = resolveTargetModel(targetModel);
    const targetGuidance = TARGET_GUIDANCE[selectedTarget];
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
          'HTTP-Referer': 'https://manavagarwal.me',
          'X-Title': 'NIMO Core Reverse Prompt',
          ...(requestId ? { 'X-Request-ID': requestId } : {})
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: [
              { type: 'text', text: `Reverse engineer this image for target model: ${selectedTarget}. Detail level: ${detail}. ${targetGuidance} First decompose the visible image, then reconstruct the target-model prompt from that decomposition.` },
              { type: 'image_url', image_url: { url: dataUrl } }
            ] }
          ],
          temperature: 0.2,
          max_tokens: 1200
        }),
        signal: controller.signal
      });
      if (!response.ok) return { success: false, error: `UPSTREAM_${response.status}`, message: `Vision provider returned HTTP ${response.status}.` };
      const data = await response.json();
      const raw = data?.choices?.[0]?.message?.content;
      const text = sanitizeModelOutput(typeof raw === 'string' ? raw : Array.isArray(raw) ? raw.map(p => p?.text || '').join('\n') : '');
      if (!text) return { success: false, error: 'EMPTY_RESPONSE', message: 'Vision provider returned no analysis.' };

      let parsed;
      try {
        const cleaned = text.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
        parsed = JSON.parse(cleaned);
      } catch {
        parsed = { prompt: text, negative_prompt: '', analysis: {} };
      }
      if (!parsed.prompt || typeof parsed.prompt !== 'string') return { success: false, error: 'INVALID_RESPONSE', message: 'Vision response did not contain a prompt.' };
      return {
        success: true,
        prompt: parsed.prompt.trim(),
        negative_prompt: typeof parsed.negative_prompt === 'string' ? parsed.negative_prompt.trim() : '',
        analysis: parsed.analysis && typeof parsed.analysis === 'object' ? parsed.analysis : {},
        model: data?.model || this.model,
        target_model: selectedTarget,
        source: 'openrouter'
      };
    } catch (error) {
      return { success: false, error: error?.name === 'AbortError' ? 'REQUEST_TIMEOUT' : 'NETWORK_FAILURE', message: 'Vision analysis failed.' };
    } finally {
      clearTimeout(timer);
    }
  }
}

export function createReversePromptService(options) {
  return new ReversePromptService(options);
}
