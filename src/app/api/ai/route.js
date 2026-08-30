const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_MODEL = 'google/gemini-2.0-flash-exp:free';

const SYSTEM_PROMPT = `You are MIMO Core, a world-class professor, theoretical scientist, and senior academic advisor. Teach with precision from fundamentals to researcher level. Break problems into explicit steps, define assumptions, show derivations, and use correct units. For math and science, use LaTeX with inline \\( ... \\) and display \\[ ... \\]. For image questions, inspect the image carefully and distinguish observed facts from inference. Never invent missing data.`;

function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store' }
  });
}

function normalizeContent(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .map(part => part?.text || '')
    .filter(Boolean)
    .join('\n');
}

export async function POST(request) {
  try {
    const body = await request.json();
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) return json({ error: 'OPENROUTER_API_KEY is not configured.' }, 500);

    const model = process.env.OPENROUTER_MODEL || DEFAULT_MODEL;
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...(Array.isArray(body.history) ? body.history.slice(-12) : []),
      ...(body.messages || [])
    ];

    if (!messages.some(message => message.role === 'user')) {
      return json({ error: 'A user message is required.' }, 400);
    }

    const response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.PUBLIC_APP_URL || 'http://localhost:3000',
        'X-Title': 'MIMO Core AI Study Platform'
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.25,
        max_tokens: 1800
      })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) return json({ error: data?.error?.message || `OpenRouter request failed (${response.status}).` }, response.status);

    const reply = normalizeContent(data?.choices?.[0]?.message?.content);
    return json({ reply, model: data?.model || model, usage: data?.usage || null });
  } catch (error) {
    return json({ error: error?.message || 'Unexpected server error.' }, 500);
  }
}
