import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import ZAI from 'z-ai-web-dev-sdk'
import type { VisionMessage, VisionMultimodalContentItem } from 'z-ai-web-dev-sdk'

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

const SYSTEM_PROMPT = `You are a receipt scanning assistant for SplitFlow, an expense splitting app. Analyze the receipt image and extract structured data.

You must return ONLY valid JSON with this schema:
{
  "merchant": "string - the store/merchant name",
  "amount": number - the total amount on the receipt",
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
- Include a rawText field with a plain transcription of the key information on the receipt.
- If the image is not a receipt or is unreadable, return { "error": "Could not read receipt", "rawText": "description of what you see" }

Do NOT wrap the JSON in markdown code blocks. Return raw JSON only.`

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await req.formData()
    const file = formData.get('receipt') as File | null

    if (!file) {
      return NextResponse.json({ error: 'receipt file is required' }, { status: 400 })
    }

    // Convert file to base64
    const bytes = await file.arrayBuffer()
    const base64 = Buffer.from(bytes).toString('base64')
    const mimeType = file.type || 'image/jpeg'
    const dataUrl = `data:${mimeType};base64,${base64}`

    const userContent: VisionMultimodalContentItem[] = [
      { type: 'text', text: 'Analyze this receipt image and extract all the information.' },
      { type: 'image_url', image_url: { url: dataUrl } },
    ]

    const messages: VisionMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userContent },
    ]

    const zai = await ZAI.create()
    const response = await zai.chat.completions.createVision({
      model: 'gpt-4o-mini',
      messages,
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
  } catch (error) {
    console.error('Error reading receipt:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
