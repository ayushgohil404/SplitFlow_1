import { NextResponse } from 'next/server'
import { chatWithFallback, isGroqConfigured, isGeminiConfigured, getGroq } from '@/lib/groq'

// GET /api/ai/test — Diagnostic endpoint
export async function GET() {
  const results: any = {
    groq: { configured: isGroqConfigured(), keyPrefix: (process.env.GROQ_API_KEY || '').slice(0, 8) + '...' },
    gemini: { configured: isGeminiConfigured(), keyPrefix: (process.env.GEMINI_API_KEY || '').slice(0, 8) + '...' },
    models: [],
  }

  // Test each Groq model
  if (isGroqConfigured()) {
    try {
      const groq = getGroq()
      for (const model of ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'gemma2-9b-it']) {
        try {
          const res = await groq.chat.completions.create({
            model,
            messages: [{ role: 'user', content: 'Say hi' }],
            temperature: 0.1,
            max_tokens: 10,
          })
          results.models.push({ model, status: 'ok', response: (res.choices?.[0]?.message?.content || '').slice(0, 50) })
        } catch (err: any) {
          results.models.push({ model, status: 'error', code: err.status || '', message: (err.message || '').slice(0, 200) })
        }
      }
    } catch (err: any) {
      results.groq.initError = err.message
    }
  }

  // Test full fallback chain
  try {
    const res = await chatWithFallback(
      [{ role: 'user' as const, content: 'Say hello in one word' }],
      { temperature: 0.1, max_tokens: 20 }
    )
    results.fallback = { status: 'ok', response: res.slice(0, 100) }
  } catch (err: any) {
    results.fallback = { status: 'error', message: (err.message || '').slice(0, 300) }
  }

  return NextResponse.json(results)
}
