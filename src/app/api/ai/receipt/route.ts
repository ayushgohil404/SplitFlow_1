import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth-utils'
import { getGroq, VISION_MODEL, isGroqConfigured } from '@/lib/groq'

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

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!isGroqConfigured()) {
      return NextResponse.json(
        { error: 'AI service not configured. Set GROQ_API_KEY.', code: 'NOT_CONFIGURED' },
        { status: 503 }
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
    const dataUrl = `data:${mimeType};base64,${base64}`

    // Receipt scanning needs vision model — no text fallback
    const groq = getGroq()
    const response = await groq.chat.completions.create({
      model: VISION_MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Analyze this receipt image and extract all the information.' },
            { type: 'image_url', image_url: { url: dataUrl } },
          ],
        },
      ],
      temperature: 0.1,
    })

    const raw = response.choices?.[0]?.message?.content ?? ''
    const parsed = extractJSON(raw) as Record<string, unknown>

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
    if (msg.includes('API key') || msg.includes('401') || msg.includes('403')) {
      userMsg = 'AI API key is invalid. Update GROQ_API_KEY in Vercel settings.'
    }
    return NextResponse.json({ error: userMsg, code: 'AI_ERROR' }, { status: 500 })
  }
}
