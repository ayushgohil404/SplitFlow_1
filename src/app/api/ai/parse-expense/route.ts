import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth-utils'
import { getGroq, CHAT_MODEL } from '@/lib/groq'

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

const SYSTEM_PROMPT = `You are an expert expense parser. Parse natural language expense descriptions into structured data.

You must return ONLY valid JSON (no markdown, no explanation) with this exact schema:
{
  "description": "string - clean description of the expense",
  "amount": number - the total amount,
  "splitType": "equal" | "exact" | "percentage" | "single",
  "currency": "string - 3-letter currency code (default INR)",
  "category": "food" | "transport" | "entertainment" | "shopping" | "bills" | "rent" | "travel" | "health" | "education" | "groceries" | "utilities" | "other",
  "splits": [optional array of { "name": "string", "percentage": number } or { "name": "string", "amount": number }]
}

Rules:
- If no split is mentioned, use "single" for splitType and omit splits.
- If split is "equal", include splits array with names of people mentioned. For equal splits, set percentage to null and amount to null per person.
- If split is "percentage", include each person's percentage.
- If split is "exact", include each person's exact amount.
- "me" refers to the person writing the expense. Include "me" as a name in splits.
- Default currency is INR unless another currency is specified.
- Category should be inferred from context.
- Amount should be a number (not a string).
- If you cannot determine the amount or the text is not an expense, return { "error": "Could not parse expense", "rawText": "<original text>" }.

Examples:
Input: "Paid ₹1500 for pizza with Alex and Sam, split equally"
Output: {"description":"Pizza","amount":1500,"splitType":"equal","currency":"INR","category":"food","splits":[{"name":"me","percentage":null,"amount":null},{"name":"Alex","percentage":null,"amount":null},{"name":"Sam","percentage":null,"amount":null}]}

Input: "Lunch ₹900 split 60/40 between me and John"
Output: {"description":"Lunch","amount":900,"splitType":"percentage","currency":"INR","category":"food","splits":[{"name":"me","percentage":60},{"name":"John","percentage":40}]}

Input: "Uber ride ₹450 paid by me for the group"
Output: {"description":"Uber ride","amount":450,"splitType":"equal","currency":"INR","category":"transport","splits":[{"name":"me","percentage":null,"amount":null}]}

Input: "Bought coffee for ₹200"
Output: {"description":"Coffee","amount":200,"splitType":"single","currency":"INR","category":"food"}`

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json({ error: 'AI service not configured' }, { status: 503 })
    }

    const body = await req.json()
    const { text } = body as { text: string }

    if (!text?.trim()) {
      return NextResponse.json({ error: 'text is required' }, { status: 400 })
    }

    const response = await getGroq().chat.completions.create({
      model: CHAT_MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: text },
      ],
      temperature: 0.1,
    })

    const raw = response.choices?.[0]?.message?.content ?? ''
    const parsed = extractJSON(raw) as Record<string, unknown>

    if (parsed.error) {
      return NextResponse.json({ error: parsed.error, rawText: text }, { status: 200 })
    }

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
