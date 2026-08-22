import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth-utils'
import { chatWithFallback, isGroqConfigured } from '@/lib/groq'

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

const SYSTEM_PROMPT = `You are an expense categorization assistant. Given an expense description, categorize it into one of these categories and suggest an appropriate emoji.

Categories: food, transport, entertainment, shopping, bills, rent, travel, health, education, groceries, utilities, other

You must return ONLY valid JSON with this schema:
{
  "category": "one of the categories above",
  "emoji": "a single emoji character representing the category",
  "confidence": number between 0 and 1
}

Be confident in your categorization. Use common sense. "groceries" is for grocery/supermarket purchases. "food" is for restaurants, cafes, takeout. "transport" is for rides, gas, parking. "utilities" is for electricity, water, internet, phone bills.

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
        { status: 200 }
      )
    }

    const body = await req.json()
    const { description } = body as { description: string }

    if (!description?.trim()) {
      return NextResponse.json({ error: 'description is required' }, { status: 400 })
    }

    const raw = await chatWithFallback(
      [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: description },
      ],
      { temperature: 0.1, max_tokens: 100 }
    )

    let parsed: { category?: string; emoji?: string; confidence?: number }
    try {
      parsed = extractJSON(raw) as typeof parsed
    } catch {
      // AI returned invalid JSON — return a sensible default
      return NextResponse.json({
        category: 'other',
        emoji: '\ud83d\udcdd',
        confidence: 0.3,
      })
    }

    return NextResponse.json({
      category: parsed.category ?? 'other',
      emoji: parsed.emoji ?? '\ud83d\udcdd',
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
    })
  } catch (error: any) {
    console.error('Error categorizing expense:', error?.message || error)
    const msg = error?.message || ''
    let userMsg = 'Failed to categorize. Try selecting manually.'
    if (msg.includes('API key') || msg.includes('401') || msg.includes('403')) {
      userMsg = 'AI API key is invalid. Update GROQ_API_KEY in Vercel settings.'
    } else if (msg.includes('All AI models failed')) {
      userMsg = 'AI models unavailable. Try selecting manually.'
    }
    return NextResponse.json({ error: userMsg, code: 'AI_ERROR' }, { status: 200 })
  }
}
