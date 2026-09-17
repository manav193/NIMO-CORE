import { createReversePromptService } from '../services/reverse-prompt.js';

const MAX_BODY_SIZE = 14 * 1024 * 1024;

function parseMultipartImage(contentType, bodyBuffer) {
  const match = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType || '');
  if (!match) throw new Error('Multipart boundary missing');
  const boundary = Buffer.from(`--${match[1] || match[2]}`);
  const parts = [];
  let start = bodyBuffer.indexOf(boundary);
  while (start !== -1) {
    const next = bodyBuffer.indexOf(boundary, start + boundary.length);
    if (next === -1) break;
    const part = bodyBuffer.subarray(start + boundary.length, next);
    const headerEnd = part.indexOf(Buffer.from('\r\n\r\n'));
    if (headerEnd !== -1) {
      const headers = part.subarray(0, headerEnd).toString('utf8');
      const content = part.subarray(headerEnd + 4, part.length - 2);
      parts.push({ headers, content });
    }
    start = next;
  }
  const imagePart = parts.find(p => /name="image"/i.test(p.headers));
  if (!imagePart) throw new Error('Image field is required');
  const type = /Content-Type:\s*([^\r\n]+)/i.exec(imagePart.headers)?.[1]?.trim().toLowerCase();
  const targetPart = parts.find(p => /name="target_model"/i.test(p.headers));
  const targetModel = targetPart ? targetPart.content.toString('utf8').trim() : null;
  const detailPart = parts.find(p => /name="detail"/i.test(p.headers));
  const detail = detailPart ? detailPart.content.toString('utf8').trim() : 'high';
  return { image: { mimeType: type, base64: imagePart.content.toString('base64') }, targetModel, detail };
}

export async function handleReversePrompt(req, res, { service = null, requestId = null } = {}) {
  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'METHOD_NOT_ALLOWED' }));
    return true;
  }

  const contentType = String(req.headers['content-type'] || '');
  if (!contentType.toLowerCase().startsWith('multipart/form-data')) {
    res.writeHead(415, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'MULTIPART_REQUIRED' }));
    return true;
  }

  const chunks = [];
  let total = 0;
  try {
    for await (const chunk of req) {
      total += chunk.length;
      if (total > MAX_BODY_SIZE) throw new Error('Request too large');
      chunks.push(chunk);
    }
    const parsed = parseMultipartImage(contentType, Buffer.concat(chunks));
    const result = await (service || createReversePromptService()).analyze({
      image: parsed.image,
      detail: parsed.detail,
      targetModel: parsed.targetModel,
      requestId
    });
    const status = result.success ? 200 : (result.error === 'MISSING_API_KEY' ? 503 : 502);
    res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(result));
  } catch (error) {
    const status = error.message === 'Request too large' ? 413 : 400;
    res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ success: false, error: status === 413 ? 'PAYLOAD_TOO_LARGE' : 'INVALID_IMAGE_REQUEST', message: error.message }));
  }
  return true;
}
