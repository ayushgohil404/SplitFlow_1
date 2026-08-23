import Groq from 'groq-sdk';
import type { ChatCompletionMessageParam } from 'groq-sdk/resources/chat/completions';

// Models that are reliably available on Groq (verified list)
export const CHAT_MODEL = 'llama-3.3-70b-versatile';
const FALLBACK_CHAT_MODELS = [
  'llama-3.1-8b-instant',
  'llama3-70b-8192',
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

/**
 * Call Groq chat completion with automatic model fallback.
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

  let groq: Groq;
  try {
    groq = getGroq();
  } catch (initErr: any) {
    throw new Error('GROQ_API_KEY is not configured. ' + (initErr.message || ''));
  }

  const allModels = [primaryModel, ...fallbackModels];
  let lastError: any = null;
  const errors: string[] = [];

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
      const status = err.status || '';
      const code = err.code || '';
      const msg = err.message || 'unknown';
      const errInfo = `[Groq] ${model}: status=${status} code=${code} msg=${msg}`;
      console.error(errInfo);
      errors.push(errInfo);

      // Don't retry on auth errors
      if (status === 401 || status === 403) {
        throw new Error('AI API key is invalid or expired. Please update GROQ_API_KEY.');
      }
      // Don't retry on context length exceeded
      if (msg.includes('context_length') || msg.includes('token limit') || msg.includes('max_tokens')) {
        throw new Error('Input too long for AI. Please use a shorter message.');
      }
      // Continue to next model
    }
  }

  // Log all errors for debugging
  console.error('[Groq] All models failed:', errors.join(' | '));
  const status = (lastError as any)?.status || '';
  const msg = lastError?.message || 'unknown';
  const detail = status ? `${status}: ${msg}` : msg;
  throw new Error(`All AI models failed: ${detail}`);
}
