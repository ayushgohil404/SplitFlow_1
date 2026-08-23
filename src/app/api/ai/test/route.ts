import { NextResponse } from 'next/server'
import { chatWithFallback, isGeminiConfigured } from '@/lib/groq'

// GET /api/ai/test — Diagnostic endpoint (Gemini-only)
export async function GET() {
  const results: any = {
    gemini: { configured: isGeminiConfigured(), keyPrefix: (process.env.GEMINI_API_KEY || '').slice(0, 8) + '...' },
    models: [],
  }

  // Test each Gemini model
  if (isGeminiConfigured()) {
    for (const model of ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro']) {
      for (const endpoint of ['v1beta', 'v1']) {
        try {
          const apiKey = process.env.GEMINI_API_KEY!
          const url = `https://generativelanguage.googleapis.com/${endpoint}/models/${model}:generateContent?key=${apiKey}`
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
          results.models.push({
            model,
            endpoint,
            status: res.ok ? 'ok' : 'error',
            code: res.status,
            message: res.ok ? text.slice(0, 50) : JSON.stringify(data).slice(0, 150),
          })
        } catch (err: any) {
          results.models.push({ model, endpoint, status: 'error', message: (err.message || '').slice(0, 200) })
        }
      }
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
