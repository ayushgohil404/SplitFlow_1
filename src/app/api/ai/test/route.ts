import { NextResponse } from 'next/server'
import { chatWithFallback, isGeminiConfigured } from '@/lib/groq'

// GET /api/ai/test — Diagnostic endpoint
export async function GET() {
  const results: any = {
    gemini: { configured: isGeminiConfigured(), keyPrefix: (process.env.GEMINI_API_KEY || '').slice(0, 8) + '...' },
  }

  // Test the model directly
  if (isGeminiConfigured()) {
    try {
      const apiKey = process.env.GEMINI_API_KEY!
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: 'Say hi' }] }],
          generationConfig: { maxOutputTokens: 10 },
        }),
      })
      const data = await res.json().catch(() => ({}))
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || ''
      results.model = {
        name: 'gemini-2.5-flash',
        status: res.ok ? 'ok' : 'error',
        code: res.status,
        response: res.ok ? text.slice(0, 50) : JSON.stringify(data).slice(0, 200),
      }
    } catch (err: any) {
      results.model = { status: 'error', message: (err.message || '').slice(0, 200) }
    }
  }

  // Test full fallback chain
  try {
    const res = await chatWithFallback(
      [{ role: 'user', content: 'Say hello in one word' }],
      { temperature: 0.1, max_tokens: 20 }
    )
    results.fallback = { status: 'ok', response: res.slice(0, 100) }
  } catch (err: any) {
    results.fallback = { status: 'error', message: (err.message || '').slice(0, 300) }
  }

  return NextResponse.json(results)
}
