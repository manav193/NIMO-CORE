import test from 'node:test';
import assert from 'node:assert/strict';
import { ReversePromptService } from '../src/services/reverse-prompt.js';

const fakeResponse = (body, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body
});

test('reverse prompt service sends multimodal OpenRouter content and parses JSON', async () => {
  let request;
  const service = new ReversePromptService({
    apiKey: 'test-key',
    fetchFn: async (url, init) => {
      request = { url, init };
      return fakeResponse({
        model: 'inclusionai/ling-3.0-flash-vl:free',
        choices: [{ message: { content: JSON.stringify({
          prompt: 'cinematic portrait, neon rim light',
          negative_prompt: 'blurry, low quality',
          analysis: { subject: 'portrait', lighting: 'neon' }
        }) } }]
      });
    }
  });

  const result = await service.analyze({ image: { mimeType: 'image/png', base64: 'aGVsbG8=' } });
  assert.equal(result.success, true);
  assert.equal(result.prompt, 'cinematic portrait, neon rim light');
  const payload = JSON.parse(request.init.body);
  assert.equal(payload.messages[1].content[1].type, 'image_url');
  assert.match(payload.messages[1].content[1].image_url.url, /^data:image\/png;base64,/);
});

test('reverse prompt service rejects unsupported image types', async () => {
  const service = new ReversePromptService({ apiKey: 'test-key', fetchFn: async () => fakeResponse({}) });
  await assert.rejects(
    service.analyze({ image: { mimeType: 'image/gif', base64: 'aGVsbG8=' } }),
    /Unsupported image type/
  );
});
