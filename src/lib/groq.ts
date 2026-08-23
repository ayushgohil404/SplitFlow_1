import Groq from 'groq-sdk';

export type ChatCompletionMessageParam = { role: string; content: string };

const client = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const MODEL = 'llama-3.3-70b-versatile';

export function isGroqConfigured(): boolean {
  const key = process.env.GROQ_API_KEY;
  if (!key || key.length < 10) return false;
  return true;
}

export function isGeminiConfigured(): boolean {
  return isGroqConfigured();
}

export async function chatWithGemini(
  messages: { role: string; content: string }[],
  options: { temperature?: number; max_tokens?: number } = {}
): Promise<string> {
  const { temperature = 0.4, max_tokens = 2048 } = options;

  if (!isGroqConfigured()) {
    throw new Error('GROQ_API_KEY is not configured. Add it in Vercel Environment Variables.');
  }

  const response = await client.chat.completions.create({
    model: MODEL,
    messages: messages.map((m) => ({
      role: m.role as 'system' | 'user' | 'assistant',
      content: m.content,
    })),
    temperature,
    max_tokens,
  });

  const content = response.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('Empty response from AI model');
  }

  return content;
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

  if (!isGroqConfigured()) {
    throw new Error('GROQ_API_KEY is not configured. Add it in Vercel Environment Variables.');
  }

  return chatWithGemini(messages, { temperature, max_tokens });
}
