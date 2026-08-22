import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import ZAI from 'z-ai-web-dev-sdk'
import type { ChatMessage } from 'z-ai-web-dev-sdk'

function extractJSON(text: string): unknown {
  // Try direct parse first
  try {
    return JSON.parse(text)
  } catch {
    // Try extracting from markdown code block
    const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (codeBlockMatch) {
      return JSON.parse(codeBlockMatch[1].trim())
    }
    // Try finding first { ... } block
    const braceMatch = text.match(/\{[\s\S]*\}/)
    if (braceMatch) {
      return JSON.parse(braceMatch[0])
    }
    throw new Error('No valid JSON found')
  }
}

async function chatCompletion(systemPrompt: string, userMessage: string): Promise<string> {
  const zai = await ZAI.create()
  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage },
  ]
  const response = await zai.chat.completions.create({ messages })
  return response.choices?.[0]?.message?.content ?? ''
}

const SYSTEM_PROMPT = `You are an expert expense parser. Parse natural language expense descriptions into structured data.

You must return ONLY valid JSON (no markdown, no explanation) with this exact schema:
{
  "description": "string - clean description of the expense",
  "amount": number - the total amount,
  "splitType": "equal" | "exact" | "percentage" | "single",
  "currency": "string - 3-letter currency code (default USD)",
  "category": "food" | "transport" | "entertainment" | "shopping" | "bills" | "rent" | "travel" | "health" | "education" | "groceries" | "utilities" | "other",
  "splits": [optional array of { "name": "string", "percentage": number } or { "name": "string", "amount": number }]
}

Rules:
- If no split is mentioned, use "single" for splitType and omit splits.
- If split is "equal", include splits array with names of people mentioned. For equal splits, set percentage to null and amount to null per person.
- If split is "percentage", include each person's percentage.
- If split is "exact", include each person's exact amount.
- "me" refers to the person writing the expense. Include "me" as a name in splits.
- Default currency is USD unless another currency is specified.
- Category should be inferred from context.
- Amount should be a number (not a string).
- If you cannot determine the amount or the text is not an expense, return { "error": "Could not parse expense", "rawText": "<original text>" }.

Examples:
Input: "Paid $45 for pizza with Alex and Sam, split equally"
Output: {"description":"Pizza","amount":45,"splitType":"equal","currency":"USD","category":"food","splits":[{"name":"me","percentage":null,"amount":null},{"name":"Alex","percentage":null,"amount":null},{"name":"Sam","percentage":null,"amount":null}]}

Input: "Lunch $30 split 60/40 between me and John"
Output: {"description":"Lunch","amount":30,"splitType":"percentage","currency":"USD","category":"food","splits":[{"name":"me","percentage":60},{"name":"John","percentage":40}]}

Input: "Uber ride $22 paid by me for the group"
Output: {"description":"Uber ride","amount":22,"splitType":"equal","currency":"USD","category":"transport","splits":[{"name":"me","percentage":null,"amount":null}]}

Input: "Bought coffee for $5"
Output: {"description":"Coffee","amount":5,"splitType":"single","currency":"USD","category":"food"}`

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { text } = body as { text: string }

    if (!text?.trim()) {
      return NextResponse.json({ error: 'text is required' }, { status: 400 })
    }

    const raw = await chatCompletion(SYSTEM_PROMPT, text)
    const parsed = extractJSON(raw) as Record<string, unknown>

    if (parsed.error) {
      return NextResponse.json({ error: parsed.error, rawText: text }, { status: 200 })
    }

    // Ensure amount is a number
    if (typeof parsed.amount === 'string') {
      parsed.amount = parseFloat(parsed.amount as string)
    }

    return NextResponse.json(parsed)
  } catch (error) {
    console.error('Error parsing expense:', error)
    return NextResponse.json(
      { error: 'Could not parse expense' },
      { status: 200 }
    )
  }
}
