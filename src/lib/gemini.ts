const GEMINI_MODEL = 'gemini-2.5-flash';

export type ChatCompletionMessageParam = { role: string; content: string };

export function isGeminiConfigured(): boolean {
  const key = process.env.GEMINI_API_KEY;
  if (!key || key.length < 10) return false;
  return true;
}

async function callGeminiAPI(
  messages: { role: string; content: string }[],
  options: { temperature?: number; max_tokens?: number } = {}
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured. Add it in Vercel Environment Variables.');
  }

  const { temperature = 0.4, max_tokens = 2048 } = options;

  const systemMessage = messages.find((m) => m.role === 'system');
  const nonSystem = messages.filter((m) => m.role !== 'system');

  if (nonSystem.length === 0) {
    throw new Error('No user messages to send to Gemini.');
  }

  const contents = nonSystem.map((m) => ({
    role: m.role === 'assistant' ? 'model' as const : 'user' as const,
    parts: [{ text: m.content }],
  }));

  const body: Record<string, unknown> = {
    contents,
    generationConfig: {
      temperature,
      maxOutputTokens: max_tokens,
    },
  };

  if (systemMessage) {
    body.systemInstruction = { parts: [{ text: systemMessage.content }] };
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  console.log(`[Gemini] Calling ${GEMINI_MODEL}, ${contents.length} messages, ${max_tokens} max tokens`);

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    console.error(`[Gemini] API error ${res.status}:`, text.slice(0, 500));
    throw new Error(`Gemini API failed (${res.status}): ${text.slice(0, 300)}`);
  }

  const data = await res.json();
  const content = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!content) {
    const reason = data?.candidates?.[0]?.finishReason;
    console.error(`[Gemini] Empty response. finishReason:`, reason, 'Full:', JSON.stringify(data).slice(0, 500));
    throw new Error(reason === 'SAFETY' ? 'Response blocked by safety filters.' : 'Empty response from Gemini.');
  }

  console.log(`[Gemini] Success, response length: ${content.length}`);
  return content;
}

export async function chatWithGemini(
  messages: { role: string; content: string }[],
  options: { temperature?: number; max_tokens?: number } = {}
): Promise<string> {
  if (!isGeminiConfigured()) {
    throw new Error('GEMINI_API_KEY is not configured. Add it in Vercel Environment Variables.');
  }

  return callGeminiAPI(messages, options);
}

export async function chatWithFallback(
  messages: ChatCompletionMessageParam[],
  options: {
    temperature?: number;
    max_tokens?: number;
    primaryModel?: string;
    fallbackModels?: string[];
  } = {}
): Promise<string> {
  if (!isGeminiConfigured()) {
    throw new Error('GEMINI_API_KEY is not configured. Add it in Vercel Environment Variables.');
  }

  return callGeminiAPI(messages, options);
}
