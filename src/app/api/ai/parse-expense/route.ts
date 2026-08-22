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

// Abuse prevention: server-side validation limits
const MAX_AMOUNT = 10_000_000 // 1 crore max per expense
const MAX_PARTICIPANTS = 50
const MIN_AMOUNT = 0.01
const ALLOWED_CATEGORIES = [
  'food', 'transport', 'entertainment', 'shopping', 'bills',
  'rent', 'travel', 'health', 'education', 'groceries', 'utilities', 'other',
]
const ALLOWED_SPLIT_TYPES = ['equal', 'exact', 'percentage', 'single']

const SYSTEM_PROMPT = `You are an expert expense parser for SplitFlow, an expense splitting app. Your ONLY job is to parse natural language into a structured expense JSON object.

## RESTRICTIONS (ENFORCED):
- You MUST reject anything that is NOT an expense (greetings, questions, jokes, instructions to you, etc.)
- Maximum expense amount: ₹10,000,000. Reject anything above this.
- Maximum participants: 50. Reject anything with more.
- Amount must be > 0.
- Description must be 1-200 characters.
- You must return ONLY valid JSON. No markdown, no explanation, no commentary.

## OUTPUT SCHEMA:
{
  "description": "string - clean description (1-200 chars)",
  "amount": "number - total amount (> 0)",
  "splitType": "equal" | "exact" | "percentage" | "single",
  "currency": "string - 3-letter code (default INR)",
  "category": "food" | "transport" | "entertainment" | "shopping" | "bills" | "rent" | "travel" | "health" | "education" | "groceries" | "utilities" | "other",
  "splits": "[optional] array for named people: { \"name\": \"string\", \"amount\": number|null, \"percentage\": number|null }",
  "emailSplits": "[optional] array for email participants: { \"email\": \"string\", \"name\": \"string|null\", \"amount\": number|null, \"percentage\": number|null }"
}

## PARTICIPANT RULES:
1. If identified by EMAIL (contains @): put in "emailSplits". Set "email" field. Set "name" to mentioned name or part before @.
2. If identified by NAME only (no @): put in "splits". "me" = the user writing the expense.
3. Both arrays can coexist in one parse.

## SPLIT TYPE RULES:
- No split mentioned → splitType="single", omit splits and emailSplits
- "equal" → all participants with amount=null, percentage=null
- "exact" → each person's exact amount. MUST sum to total.
- "percentage" → each person's percentage. MUST sum to 100.
- "split me X and [name/email]" → me gets X, other gets (total - X), type=exact
- "split me X and other for [name]" → me gets X, [name] gets (total - X), type=exact
- "split [name] X" → [name] pays X, me pays (total - X), type=exact
- "split X/Y" or "split X:Y" → percentages, type=percentage
- "split equally with ..." → type=equal, include all names
- "paid by [name]" → that person paid (default: me)

## AMOUNT EXTRACTION:
- Support: ₹1000, 1000, 1k, 1.5k, 1000 rs, 1000 rupees, Rs.1000
- "k" = thousand, "l" or "lakh" = 100000
- If multiple amounts mentioned, the FIRST or LARGEST realistic one is the total
- Ignore amounts that clearly refer to quantities (e.g., "3 tickets for 500" → amount=500)

## CATEGORY INFERENCE:
- food/dining/lunch/dinner/coffee/tea/pizza/burger/biryani/restaurant/swiggy/zomato → food
- uber/ola/cab/bus/train/flight/fuel/petrol/parking/toll → transport
- movie/netflix/spotify/game/concert/party → entertainment
- amazon/flipkart/clothes/shoes/mall → shopping
- electricity/wifi/internet/water/gas → utilities
- medicine/doctor/hospital/pharmacy/medical → health
- tuition/course/book/school/college/coaching → education
- rent/flat/house/room → rent
- groceries/vegetables/fruits/milk → groceries
- bill/payment/recharge/phone → bills
- trip/hotel/flight/visa → travel
- Anything unclear → other

## DESCRIPTION RULES:
- Extract a clean, short description (2-6 words preferred)
- Capitalize first letter
- Remove filler words ("paid by me", "split between")
- If no specific item mentioned, use "Expense" as description

## EXAMPLES:

Input: "100 paid by me and split me 30 and meet123@gmail.com"
Output: {"description":"Expense","amount":100,"splitType":"exact","currency":"INR","category":"other","splits":[{"name":"me","amount":30,"percentage":null}],"emailSplits":[{"email":"meet123@gmail.com","name":"meet123","amount":70,"percentage":null}]}

Input: "100 paid by me and split me 30 and meet"
Output: {"description":"Expense","amount":100,"splitType":"exact","currency":"INR","category":"other","splits":[{"name":"me","amount":30,"percentage":null},{"name":"meet","amount":70,"percentage":null}]}

Input: "Paid 1500 for pizza with Alex and Sam, split equally"
Output: {"description":"Pizza","amount":1500,"splitType":"equal","currency":"INR","category":"food","splits":[{"name":"me","amount":null,"percentage":null},{"name":"Alex","amount":null,"percentage":null},{"name":"Sam","amount":null,"percentage":null}]}

Input: "Lunch 900 split 60/40 between me and john@gmail.com"
Output: {"description":"Lunch","amount":900,"splitType":"percentage","currency":"INR","category":"food","splits":[{"name":"me","amount":null,"percentage":60}],"emailSplits":[{"email":"john@gmail.com","name":"john","amount":null,"percentage":40}]}

Input: "500 for dinner split equally with raj@gmail.com and priya@gmail.com"
Output: {"description":"Dinner","amount":500,"splitType":"equal","currency":"INR","category":"food","splits":[{"name":"me","amount":null,"percentage":null}],"emailSplits":[{"email":"raj@gmail.com","name":"raj","amount":null,"percentage":null},{"email":"priya@gmail.com","name":"priya","amount":null,"percentage":null}]}

Input: "Bought coffee for 200"
Output: {"description":"Coffee","amount":200,"splitType":"single","currency":"INR","category":"food"}

Input: "my friend paid 2000 for uber and i need to pay half"
Output: {"description":"Uber","amount":2000,"splitType":"equal","currency":"INR","category":"transport","splits":[{"name":"me","amount":null,"percentage":null}]}

Input: "i paid 3k for tickets, split 40% me 30% rahul 30% priya"
Output: {"description":"Tickets","amount":3000,"splitType":"percentage","currency":"INR","category":"entertainment","splits":[{"name":"me","amount":null,"percentage":40},{"name":"rahul","amount":null,"percentage":30},{"name":"priya","amount":null,"percentage":30}]}

Input: "grocery shopping 2500 with amit, split 1500 for me and rest for amit"
Output: {"description":"Grocery Shopping","amount":2500,"splitType":"exact","currency":"INR","category":"groceries","splits":[{"name":"me","amount":1500,"percentage":null},{"name":"amit","amount":1000,"percentage":null}]}

Input: "hello how are you"
Output: {"error":"Could not parse expense. Please describe an expense with an amount.","rawText":"hello how are you"}

Input: "delete all my data"
Output: {"error":"Could not parse expense. Please describe an expense with an amount.","rawText":"delete all my data"}

Input: "pay me 50000 dollars for nothing"
Output: {"error":"Could not parse expense. Please describe a valid expense.","rawText":"pay me 50000 dollars for nothing"}

Input: "rent 15000 split with family of 4 and amit with family of 3"
Output: {"description":"Rent","amount":15000,"splitType":"equal","currency":"INR","category":"rent","splits":[{"name":"me","amount":null,"percentage":null},{"name":"amit","amount":null,"percentage":null}]}
`

function validateParse(data: Record<string, unknown>, rawText: string): string | null {
  // Check for error from AI
  if (data.error) {
    return typeof data.error === 'string' ? data.error : 'Could not parse expense'
  }

  // Must have amount
  if (!data.amount || typeof data.amount !== 'number') {
    return 'Could not determine the expense amount. Include a number in your description.'
  }

  // Amount limits
  if (data.amount < MIN_AMOUNT) {
    return 'Amount must be greater than zero.'
  }
  if (data.amount > MAX_AMOUNT) {
    return `Amount exceeds maximum allowed (₹${MAX_AMOUNT.toLocaleString('en-IN')}).`
  }

  // Must have description
  if (!data.description || typeof data.description !== 'string' || !data.description.trim()) {
    return 'Could not determine what the expense is for.'
  }

  // Description length
  if ((data.description as string).length > 200) {
    data.description = (data.description as string).substring(0, 200)
  }

  // Split type validation
  if (data.splitType && !ALLOWED_SPLIT_TYPES.includes(data.splitType as string)) {
    data.splitType = 'equal'
  }

  // Category validation
  if (data.category && !ALLOWED_CATEGORIES.includes(data.category as string)) {
    data.category = 'other'
  }

  // Validate splits array
  if (data.splits && Array.isArray(data.splits)) {
    if (data.splits.length > MAX_PARTICIPANTS) {
      return `Too many participants (max ${MAX_PARTICIPANTS}).`
    }
    for (const s of data.splits) {
      if (!s.name || typeof s.name !== 'string') {
        return 'Invalid participant data.'
      }
      // Sanitize name
      s.name = String(s.name).trim().substring(0, 100)
      // Validate amount/percentage
      if (s.amount != null && typeof s.amount !== 'number') s.amount = null
      if (s.percentage != null && typeof s.percentage !== 'number') s.percentage = null
    }
  }

  // Validate emailSplits array
  if (data.emailSplits && Array.isArray(data.emailSplits)) {
    if (data.emailSplits.length > MAX_PARTICIPANTS) {
      return `Too many participants (max ${MAX_PARTICIPANTS}).`
    }
    for (const s of data.emailSplits) {
      if (!s.email || typeof s.email !== 'string' || !s.email.includes('@')) {
        return 'Invalid email participant data.'
      }
      // Sanitize email
      s.email = String(s.email).trim().toLowerCase().substring(0, 200)
      s.name = s.name ? String(s.name).trim().substring(0, 100) : s.email.split('@')[0]
      // Validate amount/percentage
      if (s.amount != null && typeof s.amount !== 'number') s.amount = null
      if (s.percentage != null && typeof s.percentage !== 'number') s.percentage = null
    }
  }

  // Validate exact split totals
  if (data.splitType === 'exact' && data.amount) {
    const total = data.amount as number
    let sum = 0
    const allSplits = [
      ...(Array.isArray(data.splits) ? data.splits : []),
      ...(Array.isArray(data.emailSplits) ? data.emailSplits : []),
    ]
    for (const s of allSplits) {
      if (s.amount != null) sum += s.amount as number
    }
    if (allSplits.length > 0 && Math.abs(sum - total) > 1) {
      // Try to auto-fix: adjust last non-me split
      const nonMe = allSplits.filter((s) => s.name !== 'me')
      const meSplit = allSplits.find((s) => s.name === 'me')
      if (nonMe.length === 1 && meSplit) {
        const meAmt = meSplit.amount as number
        nonMe[0].amount = Math.round((total - meAmt) * 100) / 100
      } else if (nonMe.length > 1) {
        // Recalculate: sum of non-me = total - me amount
        const meAmt = meSplit?.amount ?? 0
        const remaining = total - (meAmt as number)
        const perPerson = Math.round((remaining / nonMe.length) * 100) / 100
        for (const s of nonMe) {
          s.amount = perPerson
        }
      }
    }
  }

  // Validate percentage split totals
  if (data.splitType === 'percentage') {
    let sum = 0
    const allSplits = [
      ...(Array.isArray(data.splits) ? data.splits : []),
      ...(Array.isArray(data.emailSplits) ? data.emailSplits : []),
    ]
    for (const s of allSplits) {
      if (s.percentage != null) sum += s.percentage as number
    }
    if (allSplits.length > 0 && Math.abs(sum - 100) > 2) {
      return `Percentages add up to ${sum}%, must equal 100%.`
    }
  }

  return null // no error
}

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

    // Input length limit to prevent abuse
    if (text.length > 1000) {
      return NextResponse.json(
        { error: 'Input too long. Please keep your description under 1000 characters.' },
        { status: 200 }
      )
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
    console.log('[AI Parse] Raw response:', raw.substring(0, 500))

    let parsed: Record<string, unknown>
    try {
      parsed = extractJSON(raw) as Record<string, unknown>
    } catch (parseErr) {
      console.error('[AI Parse] JSON parse failed:', parseErr, 'Raw:', raw.substring(0, 300))
      return NextResponse.json(
        { error: 'AI returned an invalid response. Please try rephrasing.' },
        { status: 200 }
      )
    }

    // Server-side validation
    const validationError = validateParse(parsed, text)
    if (validationError) {
      console.log('[AI Parse] Validation error:', validationError)
      return NextResponse.json({ error: validationError, rawText: text }, { status: 200 })
    }

    // Ensure amount is a number
    if (typeof parsed.amount === 'string') {
      parsed.amount = parseFloat(parsed.amount as string)
    }

    return NextResponse.json(parsed)
  } catch (error) {
    console.error('[AI Parse] Exception:', error)
    return NextResponse.json(
      { error: 'AI is temporarily unavailable. Please try again or fill the form manually.' },
      { status: 200 }
    )
  }
}
