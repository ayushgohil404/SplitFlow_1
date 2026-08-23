import Groq from 'groq-sdk';
import type { ChatCompletionMessageParam } from 'groq-sdk/resources/chat/completions';

// Models that are reliably available on Groq (verified list)
export const CHAT_MODEL = 'llama-3.3-70b-versatile';
const FALLBACK_CHAT_MODELS = [
  'llama-3.1-8b-instant',
  'gemma2-9b-it',
];

// Vision model for receipt scanning
export const VISION_MODEL = 'llama-3.2-11b-vision-preview';
const FALLBACK_VISION_MODELS = [
  'llama-3.2-90b-vision-preview',
];

let _groq: Groq | null = null;

export function getGroq(): Groq {
  if (!_groq) {
    if (!process.env.GROQ_API_KEY) {
      throw new Error('GROQ_API_KEY is not configured');
    }
    _groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }
  return _groq;
}

export function isGroqConfigured(): boolean {
  const key = process.env.GROQ_API_KEY;
  if (!key || key === 'gsk_placeholder' || key.length < 10) return false;
  return true;
}

export function isGeminiConfigured(): boolean {
  const key = process.env.GEMINI_API_KEY;
  if (!key || key.length < 10) return false;
  return true;
}

/**
 * Call Gemini API (free tier) as a last-resort fallback.
 */
export async function chatWithGemini(
  messages: { role: string; content: string }[],
  options: { temperature?: number; max_tokens?: number } = {}
): Promise<string> {
  const { temperature = 0.4, max_tokens = 2048 } = options;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured');

  const model = 'gemini-2.0-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

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

  const body: any = { contents };
  if (systemInstruction) {
    body.systemInstruction = { parts: [{ text: systemInstruction }] };
  }
  body.generationConfig = { temperature, maxOutputTokens: max_tokens };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Gemini ${model} failed (${res.status}): ${text.slice(0, 200)}`);
  }

  const data = await res.json();
  const content = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  if (!content) throw new Error('Empty response from Gemini');
  return content;
}

/**
 * Call AI with automatic fallback: Groq models → Gemini.
 * Fixed: lastError properly scoped, auth errors don't block Gemini fallback.
 */
export async function chatWithFallback(
  messages: ChatCompletionMessageParam[],
  options: {
    temperature?: number;
    max_tokens?: number;
    primaryModel?: string;
    fallbackModels?: string[];
  } = {}
): Promise<string> {
  const {
    temperature = 0.1,
    max_tokens = 1024,
    primaryModel = CHAT_MODEL,
    fallbackModels = FALLBACK_CHAT_MODELS,
  } = options;

  let lastError: any = null;
  let groqTried = false;

  // --- Try Groq models first ---
  let groq: Groq | null = null;
  try {
    groq = getGroq();
  } catch {
    // Groq not configured, skip to Gemini
  }

  if (groq) {
    groqTried = true;
    const allModels = [primaryModel, ...fallbackModels];

    for (const model of allModels) {
      try {
        const response = await groq.chat.completions.create({
          model,
          messages,
          temperature,
          max_tokens,
        });
        const content = response.choices?.[0]?.message?.content ?? '';
        if (content) {
          console.error(`[AI] Success with ${model}`);
          return content;
        }
        throw new Error('Empty response from model');
      } catch (err: any) {
        lastError = err;
        const status = err.status || '';
        const msg = err.message || 'unknown';
        console.error(`[Groq] ${model} failed: status=${status} msg=${msg.slice(0, 150)}`);

        // Only stop retrying on context length errors
        if (msg.includes('context_length') || msg.includes('token limit') || msg.includes('max_tokens')) {
          throw new Error('Input too long for AI. Please use a shorter message.');
        }
        // For 401/403/400, continue to next model (don't break!)
      }
    }
    console.error('[Groq] All models failed, trying Gemini...');
  }

  // --- Try Gemini as fallback ---
  if (isGeminiConfigured()) {
    try {
      const result = await chatWithGemini(messages as any, { temperature, max_tokens });
      console.error('[AI] Success with Gemini (Groq failed)');
      return result;
    } catch (geminiErr: any) {
      console.error('[Gemini] Failed:', geminiErr?.message?.slice(0, 150) || geminiErr);
      const groqMsg = lastError?.message?.slice(0, 100) || (groqTried ? 'all models failed' : 'not configured');
      throw new Error(`All AI providers failed. Groq: ${groqMsg}. Gemini: ${geminiErr?.message?.slice(0, 100) || 'failed'}`);
    }
  }

  // No provider worked
  const groqInfo = groqTried
    ? `Groq: ${lastError?.message?.slice(0, 100) || 'unknown error'}`
    : 'Groq: not configured';
  throw new Error(`AI not working. ${groqInfo}. Gemini: not configured. Add GROQ_API_KEY or GEMINI_API_KEY.`);
}
