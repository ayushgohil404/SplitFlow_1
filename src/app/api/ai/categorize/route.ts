import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import ZAI from 'z-ai-web-dev-sdk'
import type { ChatMessage } from 'z-ai-web-dev-sdk'

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

Do NOT wrap the JSON in markdown code blocks. Return raw JSON only.`

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { description } = body as { description: string }

    if (!description?.trim()) {
      return NextResponse.json({ error: 'description is required' }, { status: 400 })
    }

    const zai = await ZAI.create()
    const messages: ChatMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: description },
    ]
    const response = await zai.chat.completions.create({ messages })
    const raw = response.choices?.[0]?.message?.content ?? ''
    const parsed = extractJSON(raw) as { category: string; emoji: string; confidence: number }

    return NextResponse.json({
      category: parsed.category ?? 'other',
      emoji: parsed.emoji ?? '📝',
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
    })
  } catch (error) {
    console.error('Error categorizing expense:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
