// Type for AI messages (compatible with Groq SDK type shape)
export type ChatCompletionMessageParam = { role: string; content: string };

// ─── Gemini-only AI (Groq removed — all models decommissioned) ───────────────

export const CHAT_MODEL = 'gemini-2.0-flash';

// Models to try in order
const GEMINI_MODELS = [
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-1.5-pro',
  'gemini-pro',
];

// API endpoint variants to try
const GEMINI_ENDPOINTS = [
  'v1beta',
  'v1',
];

export function isGroqConfigured(): boolean {
  return false; // Groq no longer used
}

export function isGeminiConfigured(): boolean {
  const key = process.env.GEMINI_API_KEY;
  if (!key || key.length < 10) return false;
  return true;
}

/**
 * Call Gemini API with automatic model and endpoint fallback.
 */
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

  let lastError: Error | null = null;

  // Try each model
  for (const model of GEMINI_MODELS) {
    // Try each endpoint variant
    for (const endpoint of GEMINI_ENDPOINTS) {
      const url = `https://generativelanguage.googleapis.com/${endpoint}/models/${model}:generateContent?key=${apiKey}`;

      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const text = await res.text().catch(() => '');
          const errMsg = `Gemini ${model} (${endpoint}) failed (${res.status}): ${text.slice(0, 150)}`;
          console.error(`[AI] ${errMsg}`);
          lastError = new Error(errMsg);

          // If model not found (404), try next model
          if (res.status === 404) break; // break inner loop, try next model
          // If auth error (401/403), no point retrying
          if (res.status === 401 || res.status === 403) {
            throw new Error(`Gemini API key invalid or unauthorized (${res.status}). Check your GEMINI_API_KEY.`);
          }
          // For other errors (400, 429, 500), try next endpoint/model
          continue;
        }

        const data = await res.json();
        const content = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
        if (content) {
          console.error(`[AI] Success with Gemini ${model} (${endpoint})`);
          return content;
        }

        // Check for safety blocks
        const blockReason = data?.candidates?.[0]?.finishReason;
        if (blockReason && blockReason !== 'STOP') {
          lastError = new Error(`Gemini response blocked: ${blockReason}`);
          console.error(`[AI] ${lastError.message}`);
          continue; // try next model
        }

        lastError = new Error('Empty response from Gemini');
        console.error(`[AI] ${lastError.message}`);
      } catch (err: unknown) {
        if (err instanceof Error && (err.message.includes('unauthorized') || err.message.includes('invalid'))) {
          throw err; // Re-throw auth errors immediately
        }
        lastError = err instanceof Error ? err : new Error(String(err));
        console.error(`[AI] Gemini ${model} (${endpoint}) exception:`, lastError.message);
      }
    }
  }

  throw new Error(
    `All Gemini models failed. Last error: ${lastError?.message || 'unknown'}. `
    + `Models tried: ${GEMINI_MODELS.join(', ')}`
  );
}

/**
 * Call AI — now Gemini-only with automatic model/endpoint fallback.
 * Kept the same function signature for compatibility.
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
  const { temperature = 0.4, max_tokens = 2048 } = options;

  if (!isGeminiConfigured()) {
    throw new Error('GEMINI_API_KEY is not configured. Please add it in Vercel environment settings.');
  }

  return chatWithGemini(messages, {
    temperature,
    max_tokens,
  });
}
