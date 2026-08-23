import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth-utils'
import { isGeminiConfigured } from '@/lib/groq'

// Gemini models that support vision (image input)
const VISION_MODEL = 'gemini-2.5-flash';

function extractJSON(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (codeBlockMatch) {
      return JSON.parse(codeBlockMatch[1].trim())
    }
    const braceMatch = text.match(/\{[\s\S]*\}/)
    if (braceMatch) {
      return JSON.parse(braceMatch[0])
    }
    throw new Error('No valid JSON found')
  }
}

const SYSTEM_PROMPT = `You are a receipt scanning assistant for SplitFlow. Analyze the receipt image and extract structured data.

You must return ONLY valid JSON with this schema:
{
  "merchant": "string - the store/merchant name",
  "amount": number - the total amount on the receipt,
  "date": "string or null - the date in YYYY-MM-DD format if visible, otherwise null",
  "items": [optional array of { "name": "string", "quantity": number, "price": number }],
  "tax": number or null - the tax amount if visible, otherwise null,
  "rawText": "string - a plaintext transcription of the receipt"
}

Rules:
- Extract the merchant/store name from the receipt header.
- Find the TOTAL amount (not subtotal unless total is not available).
- Parse the date if visible. Use YYYY-MM-DD format.
- List individual line items if they are clearly readable.
- Extract tax amount if shown separately.
- Include a rawText field with a plain transcription of the key information.
- If the image is not a receipt or is unreadable, return { "error": "Could not read receipt", "rawText": "description of what you see" }

Return raw JSON only.`

async function callGeminiVision(base64: string, mimeType: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured')

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${VISION_MODEL}:generateContent?key=${apiKey}`

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{
        role: 'user',
        parts: [
          { text: 'Analyze this receipt image and extract all the information.' },
          { inlineData: { mimeType, data: base64 } },
        ],
      }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 2048 },
    }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Gemini vision failed (${res.status}): ${text.slice(0, 200)}`)
  }

  const data = await res.json()
  const content = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
  if (content) return content
  throw new Error('Empty response from vision model')
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!isGeminiConfigured()) {
      return NextResponse.json(
        { error: 'AI service not configured. Set GEMINI_API_KEY.', code: 'NOT_CONFIGURED' },
        { status: 200 }
      )
    }

    const formData = await req.formData()
    const file = formData.get('receipt') as File | null

    if (!file) {
      return NextResponse.json({ error: 'receipt file is required' }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const base64 = Buffer.from(bytes).toString('base64')
    const mimeType = file.type || 'image/jpeg'

    const raw = await callGeminiVision(base64, mimeType)

    let parsed: Record<string, unknown>
    try {
      parsed = extractJSON(raw) as Record<string, unknown>
    } catch {
      return NextResponse.json({
        error: 'Could not parse receipt data. Try a clearer photo or enter details manually.',
        rawText: raw.substring(0, 200),
      }, { status: 200 })
    }

    if (parsed.error) {
      return NextResponse.json({
        error: parsed.error,
        rawText: parsed.rawText ?? null,
      }, { status: 200 })
    }

    return NextResponse.json({
      merchant: parsed.merchant ?? null,
      amount: typeof parsed.amount === 'number' ? parsed.amount : parseFloat(parsed.amount as string) || 0,
      date: parsed.date ?? null,
      items: parsed.items ?? undefined,
      tax: parsed.tax ?? undefined,
      rawText: parsed.rawText ?? null,
    })
  } catch (error: any) {
    console.error('Error reading receipt:', error?.message || error)
    const msg = error?.message || ''
    let userMsg = 'Failed to scan receipt. Try entering details manually.'
    if (msg.includes('API key') || msg.includes('401') || msg.includes('403') || msg.includes('unauthorized') || msg.includes('invalid')) {
      userMsg = 'AI API key is invalid. Update GEMINI_API_KEY in Vercel settings.'
    } else if (msg.includes('All Gemini models failed') || msg.includes('All vision models failed')) {
      userMsg = 'Vision model unavailable. Try a different image or enter manually.'
    }
    return NextResponse.json({ error: userMsg, code: 'AI_ERROR' }, { status: 200 })
  }
}
