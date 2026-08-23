export type ChatCompletionMessageParam = { role: string; content: string };


export const CHAT_MODEL = 'gemini-2.5-flash';


const GEMINI_MODEL = 'gemini-2.5-flash';

export function isGroqConfigured(): boolean {
  return false;
}

export function isGeminiConfigured(): boolean {
  const key = process.env.GEMINI_API_KEY;
  if (!key || key.length < 10) return false;
  return true;
}


export async function chatWithGemini(
  messages: { role: string; content: string }[],
  options: { temperature?: number; max_tokens?: number } = {}
): Promise<string> {
  const { temperature = 0.4, max_tokens = 2048 } = options;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured');

  // Separate system prompt from conversation
  let systemInstruction: string | undefined;
  const contents: { role: string; parts: { text: string }[] }[] = [];

  for (const msg of messages) {
    if (msg.role === 'system') {
      systemInstruction = msg.content;
    } else {
      contents.push({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }],
      });
    }
  }

  const body: Record<string, unknown> = { contents };
  if (systemInstruction) {
    body.systemInstruction = { parts: [{ text: systemInstruction }] };
  }
  body.generationConfig = { temperature, maxOutputTokens: max_tokens };

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const errMsg = `Gemini ${GEMINI_MODEL} failed (${res.status}): ${text.slice(0, 200)}`;
    console.error(`[AI] ${errMsg}`);
    if (res.status === 401 || res.status === 403) {
      throw new Error(`Gemini API key invalid or unauthorized (${res.status}). Check your GEMINI_API_KEY.`);
    }
    throw new Error(errMsg);
  }

  const data = await res.json();
  const content = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  if (content) {
    console.error(`[AI] Success with Gemini ${GEMINI_MODEL}`);
    return content;
  }

  const blockReason = data?.candidates?.[0]?.finishReason;
  if (blockReason && blockReason !== 'STOP') {
    throw new Error(`Gemini response blocked: ${blockReason}`);
  }

  throw new Error('Empty response from Gemini');
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
  const { temperature = 0.4, max_tokens = 2048 } = options;

  if (!isGeminiConfigured()) {
    throw new Error('GEMINI_API_KEY is not configured. Please add it in Vercel environment settings.');
  }

  return chatWithGemini(messages, {
    temperature,
    max_tokens,
  });
}
