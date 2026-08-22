import Groq from 'groq-sdk';
import type { ChatCompletionMessageParam } from 'groq-sdk/resources/chat/completions';

// Primary model for chat/assistant
export const CHAT_MODEL = 'llama-3.3-70b-versatile';
// Fallback models in order of preference
const FALLBACK_CHAT_MODELS = [
  'llama-3.1-8b-instant',
  'llama3-70b-8192',
  'mixtral-8x7b-32768',
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
  return !!process.env.GROQ_API_KEY && process.env.GROQ_API_KEY !== 'gsk_placeholder';
}

/**
 * Call Groq chat completion with automatic model fallback.
 * Tries primary model, then fallbacks on failure.
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

  const groq = getGroq();
  const allModels = [primaryModel, ...fallbackModels];
  let lastError: Error | null = null;

  for (const model of allModels) {
    try {
      const response = await groq.chat.completions.create({
        model,
        messages,
        temperature,
        max_tokens,
      });
      const content = response.choices?.[0]?.message?.content ?? '';
      if (content) return content;
      throw new Error('Empty response from model');
    } catch (err: any) {
      lastError = err;
      console.error(`[Groq] Model ${model} failed: ${err.message || err.status || 'unknown'}`);
      // Don't retry on auth errors
      if (err.status === 401 || err.status === 403) {
        throw new Error('AI API key is invalid or expired. Please update GROQ_API_KEY.');
      }
      // Continue to next model
    }
  }

  throw lastError || new Error('All AI models failed. Please try again later.');
}
