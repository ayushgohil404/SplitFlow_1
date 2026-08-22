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

const SYSTEM_PROMPT = `You are an expert expense parser for SplitFlow, an expense splitting app. Parse natural language expense descriptions into structured data.

You must return ONLY valid JSON (no markdown, no explanation) with this exact schema:
{
  "description": "string - clean description of the expense",
  "amount": number - the total amount,
  "splitType": "equal" | "exact" | "percentage" | "single",
  "currency": "string - 3-letter currency code (default INR)",
  "category": "food" | "transport" | "entertainment" | "shopping" | "bills" | "rent" | "travel" | "health" | "education" | "groceries" | "utilities" | "other",
  "splits": [optional array for named people: { "name": "string", "amount": number or null, "percentage": number or null }],
  "emailSplits": [optional array for email-based participants: { "email": "string", "name": "string or null", "amount": number or null, "percentage": number or null }]
}

CRITICAL RULES:
1. If a participant is identified by EMAIL ADDRESS (contains @), put them in "emailSplits" NOT in "splits".
   - Set "email" to their email address
   - Set "name" to whatever name was mentioned, or extract from email (part before @)
   - Set "amount" or "percentage" based on split type

2. If a participant is identified by NAME only (no @), put them in "splits".
   - "me" refers to the person writing the expense. Include "me" as a name in splits.

3. Split type rules:
   - If no split mentioned: splitType = "single", omit splits and emailSplits
   - If split is "equal": include all participants with amount=null, percentage=null
   - If split is "exact": include each person's exact amount. All amounts must add up to total.
   - If split is "percentage": include each person's percentage. All percentages must add up to 100.

4. Default currency is INR unless another currency is specified.
5. Category should be inferred from context.
6. Amount should be a number (not a string).
7. If you cannot determine the amount or text is not an expense, return { "error": "Could not parse expense", "rawText": "<original text>" }.

EXAMPLES:

Input: "100 paid by me and split me 30 and meet123@gmail.com"
Output: {"description":"Expense","amount":100,"splitType":"exact","currency":"INR","category":"other","splits":[{"name":"me","amount":30,"percentage":null}],"emailSplits":[{"email":"meet123@gmail.com","name":"meet123","amount":70,"percentage":null}]}

Input: "Paid ₹1500 for pizza with Alex and Sam, split equally"
Output: {"description":"Pizza","amount":1500,"splitType":"equal","currency":"INR","category":"food","splits":[{"name":"me","amount":null,"percentage":null},{"name":"Alex","amount":null,"percentage":null},{"name":"Sam","amount":null,"percentage":null}]}

Input: "Lunch ₹900 split 60/40 between me and john@gmail.com"
Output: {"description":"Lunch","amount":900,"splitType":"percentage","currency":"INR","category":"food","splits":[{"name":"me","amount":null,"percentage":60}],"emailSplits":[{"email":"john@gmail.com","name":"john","amount":null,"percentage":40}]}

Input: "500 for dinner split equally with raj@gmail.com and priya@gmail.com"
Output: {"description":"Dinner","amount":500,"splitType":"equal","currency":"INR","category":"food","splits":[{"name":"me","amount":null,"percentage":null}],"emailSplits":[{"email":"raj@gmail.com","name":"raj","amount":null,"percentage":null},{"email":"priya@gmail.com","name":"priya","amount":null,"percentage":null}]}

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
