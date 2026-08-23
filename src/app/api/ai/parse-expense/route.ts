import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth-utils'
import { chatWithFallback, isGeminiConfigured } from '@/lib/groq'

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


const MAX_AMOUNT = 10_000_000
const MAX_PARTICIPANTS = 50
const MIN_AMOUNT = 0.01
const ALLOWED_CATEGORIES = [
  'food', 'transport', 'entertainment', 'shopping', 'bills',
  'rent', 'travel', 'health', 'education', 'groceries', 'utilities', 'other',
]
const ALLOWED_SPLIT_TYPES = ['equal', 'exact', 'percentage', 'share', 'single']

const SYSTEM_PROMPT = `You are an expert expense parser for SplitFlow. Your ONLY job is to parse natural language into structured JSON.

## ABSOLUTE RULES:
1. RETURN ONLY VALID JSON. No markdown, no explanation, no commentary, no code fences.
2. REJECT anything that is NOT an expense (greetings, questions, jokes, chit-chat, meta instructions).
3. Maximum amount: ₹10,000,000. Minimum: ₹0.01.
4. Maximum participants: 50.
5. Description: 1-200 characters.

## OUTPUT SCHEMA:
{
  "description": "string",
  "amount": number,
  "splitType": "equal" | "exact" | "percentage" | "share" | "single",
  "currency": "INR",
  "category": "food" | "transport" | "entertainment" | "shopping" | "bills" | "rent" | "travel" | "health" | "education" | "groceries" | "utilities" | "other",
  "groupId": "string | null",
  "splits": "[{\"name\": \"string\", \"amount\": number|null, \"percentage\": number|null, \"share\": number|null}]",
  "emailSplits": "[{\"email\": \"string\", \"name\": \"string|null\", \"amount\": number|null, \"percentage\": number|null, \"share\": number|null}]"
}

## PARTICIPANT RULES:
1. EMAIL (contains @) → put in "emailSplits" array. Set email field. Set name = mentioned name or part before @.
2. NAME ONLY (no @) → put in "splits" array. "me" = the user writing.
3. Both arrays can coexist.

## GROUP HANDLING:
- "add to group X" / "in group X" / "for group X" / "group expense X" → set groupId to the group name (exact string as mentioned)
- If a group is mentioned but no splits specified → splitType="equal", splits=[{"name":"me"}], and groupId=group name
- "for me only" / "only me" / "just me" / "personal" → splitType="single", no splits, no emailSplits
- "for all" / "everyone" / "split with all" / "all members" → splitType="equal", splits=[{"name":"me"}], groupId=group name if mentioned

## SPLIT TYPE RULES:
- No split mentioned / "for me only" / "only me" / "personal" / "I paid" (no sharing) → splitType="single", omit splits/emailSplits
- "equal" / "equally" / "50/50" / "half" / "split evenly" → all participants with amount=null, percentage=null
- Exact amounts specified → splitType="exact", each person's exact amount. MUST sum to total.
- Percentages specified → splitType="percentage", must sum to 100.
- "split me X and [name/email]" → me gets X, other gets (total-X), type=exact
- "split me X and other for [name]" → me gets X, [name] gets (total-X), type=exact
- "split [name] X" → [name] pays X, me pays (total-X), type=exact
- "split X/Y" or "ratio X:Y" → percentages proportional, type=percentage
- "paid by [name]" → that person paid (default: me)
- "me X% and [name] Y%" → percentage split
- "I bear X" / "my share X" → me gets X amount
- "with [name1] and [name2]" + no amounts → equal split among all including me
- "family of N" / "my family of N members" / "split with family of N" → splitType="share", set share=N for "me", share=other_person_count for the other person
- "me with 4 members and [name] with 3" → splitType="share", me gets share=4, [name] gets share=3
- "by family size" → splitType="share"

## AMOUNT EXTRACTION:
- Support: ₹1000, 1000, 1k, 1.5k, 2.5l, 1000 rs, 1000 rupees, Rs.1000, INR 1000, Rs 1000, 1,000
- "k" = thousand, "l" / "lakh" = 100000, "cr" / "crore" = 10000000
- If multiple amounts mentioned, the FIRST or LARGEST realistic one is total
- Ignore amounts that are quantities ("3 tickets for 500" → amount=500)
- Handle typos: "rs", "inr", "ruppes", "ruppee"

## CATEGORY INFERENCE:
- food/dining/lunch/dinner/coffee/tea/pizza/burger/biryani/restaurant/swiggy/zomato/dominos/mcdonalds/chai/snack/breakfast/meal/thali/biryani/paneer/chicken/biryani/dosa/idli/samosa/chowmin/noodles/pasta/bread/milk/ice cream/cake/chocolate/biscuit/chips/falooda/juice/shake/smoothie/brew/cafe/maggi → food
- uber/ola/cab/bus/train/flight/fuel/petrol/diesel/parking/toll/auto/rickshaw/metro/taxi/bike/scooter/petrol pump → transport
- movie/netflix/spotify/game/concert/party/club/pub/bar/amusement/park/zoo/museum → entertainment
- amazon/flipkart/clothes/shoes/mall/tshirt/jeans/watch/glasses/bag/laptop/phone/headphones → shopping
- electricity/wifi/internet/water/gas/mobile/recharge/dth/broadband → utilities
- medicine/doctor/hospital/pharmacy/medical/clinic/health/checkup/dental/eye/test/x-ray → health
- tuition/course/book/school/college/coaching/udemy/coursera/workshop/seminar/exam → education
- rent/flat/house/room/pg/hostel/accommodation/lease/maintenance → rent
- groceries/vegetables/fruits/milk/atta/rice/dal/oil/sugar/salt/sabji/mandi/kirana → groceries
- bill/payment/recharge/phone/insurance/emi/loan/tax/emi → bills
- trip/hotel/flight/visa/ticket/tourism/resort/camp/trek → travel
- Anything unclear → other

## DESCRIPTION RULES:
- Clean, short description (2-6 words preferred)
- Capitalize first letter
- Remove filler words ("paid by me", "split between", "add expense")
- If no specific item mentioned, use "Expense" as description

## EXAMPLES (follow these patterns exactly):

"100 paid by me and split me 30 and meet123@gmail.com"
→ {"description":"Expense","amount":100,"splitType":"exact","currency":"INR","category":"other","groupId":null,"splits":[{"name":"me","amount":30,"percentage":null}],"emailSplits":[{"email":"meet123@gmail.com","name":"meet123","amount":70,"percentage":null}]}

"100 paid by me and split me 30 and meet"
→ {"description":"Expense","amount":100,"splitType":"exact","currency":"INR","category":"other","groupId":null,"splits":[{"name":"me","amount":30,"percentage":null},{"name":"meet","amount":70,"percentage":null}]}

"Paid 1500 for pizza with Alex and Sam, split equally"
→ {"description":"Pizza","amount":1500,"splitType":"equal","currency":"INR","category":"food","groupId":null,"splits":[{"name":"me","amount":null,"percentage":null},{"name":"Alex","amount":null,"percentage":null},{"name":"Sam","amount":null,"percentage":null}]}

"Lunch 900 split 60/40 between me and john@gmail.com"
→ {"description":"Lunch","amount":900,"splitType":"percentage","currency":"INR","category":"food","groupId":null,"splits":[{"name":"me","amount":null,"percentage":60}],"emailSplits":[{"email":"john@gmail.com","name":"john","amount":null,"percentage":40}]}

"500 for dinner split equally with raj@gmail.com and priya@gmail.com"
→ {"description":"Dinner","amount":500,"splitType":"equal","currency":"INR","category":"food","groupId":null,"splits":[{"name":"me","amount":null,"percentage":null}],"emailSplits":[{"email":"raj@gmail.com","name":"raj","amount":null,"percentage":null},{"email":"priya@gmail.com","name":"priya","amount":null,"percentage":null}]}

"Bought coffee for 200"
→ {"description":"Coffee","amount":200,"splitType":"single","currency":"INR","category":"food","groupId":null}

"add 500 for food in trip group split equally"
→ {"description":"Food","amount":500,"splitType":"equal","currency":"INR","category":"food","groupId":"trip","splits":[{"name":"me","amount":null,"percentage":null}]}

"1000 rent only for me"
→ {"description":"Rent","amount":1000,"splitType":"single","currency":"INR","category":"rent","groupId":null}

"add 2000 for groceries split with all in flatmates group"
→ {"description":"Groceries","amount":2000,"splitType":"equal","currency":"INR","category":"groceries","groupId":"flatmates","splits":[{"name":"me","amount":null,"percentage":null}]}

"i paid 3k for tickets, split 40% me 30% rahul 30% priya"
→ {"description":"Tickets","amount":3000,"splitType":"percentage","currency":"INR","category":"entertainment","groupId":null,"splits":[{"name":"me","amount":null,"percentage":40},{"name":"rahul","amount":null,"percentage":30},{"name":"priya","amount":null,"percentage":30}]}

"grocery shopping 2500 with amit, split 1500 for me and rest for amit"
→ {"description":"Grocery Shopping","amount":2500,"splitType":"exact","currency":"INR","category":"groceries","groupId":null,"splits":[{"name":"me","amount":1500,"percentage":null},{"name":"amit","amount":1000,"percentage":null}]}

"my friend paid 2000 for uber and i need to pay half"
→ {"description":"Uber","amount":2000,"splitType":"equal","currency":"INR","category":"transport","groupId":null,"splits":[{"name":"me","amount":null,"percentage":null}]}

"add expense 750 for electricity bill in house group"
→ {"description":"Electricity Bill","amount":750,"splitType":"equal","currency":"INR","category":"utilities","groupId":"house","splits":[{"name":"me","amount":null,"percentage":null}]}

"just 300 for my lunch today"
→ {"description":"Lunch","amount":300,"splitType":"single","currency":"INR","category":"food","groupId":null}

"split 500 between me rahul and priya equally for dinner"
→ {"description":"Dinner","amount":500,"splitType":"equal","currency":"INR","category":"food","groupId":null,"splits":[{"name":"me","amount":null,"percentage":null},{"name":"rahul","amount":null,"percentage":null},{"name":"priya","amount":null,"percentage":null}]}

"i bear 200 and rest amit pays for cab 500"
→ {"description":"Cab","amount":500,"splitType":"exact","currency":"INR","category":"transport","groupId":null,"splits":[{"name":"me","amount":200,"percentage":null},{"name":"amit","amount":300,"percentage":null}]}

"rent 15000 split with family of 4 and amit with family of 3"
→ {"description":"Rent","amount":15000,"splitType":"share","currency":"INR","category":"rent","groupId":null,"splits":[{"name":"me","amount":null,"percentage":null,"share":4},{"name":"amit","amount":null,"percentage":null,"share":3}]}

"hello how are you"
→ {"error":"Could not parse expense. Please describe an expense with an amount.","rawText":"hello how are you"}

"delete all my data"
→ {"error":"Could not parse expense. Please describe an expense with an amount.","rawText":"delete all my data"}

"pay me 50000 dollars for nothing"
→ {"error":"Could not parse expense. Please describe a valid expense.","rawText":"pay me 50000 dollars for nothing"}

REMEMBER: Output ONLY raw JSON. No markdown backticks. No explanation. Just the JSON object.`

function validateParse(data: Record<string, unknown>, rawText: string): string | null {
  if (data.error) {
    return typeof data.error === 'string' ? data.error : 'Could not parse expense'
  }

  if (!data.amount || typeof data.amount !== 'number') {
    return 'Could not determine the expense amount. Include a number in your description.'
  }

  if (data.amount < MIN_AMOUNT) {
    return 'Amount must be greater than zero.'
  }
  if (data.amount > MAX_AMOUNT) {
    return `Amount exceeds maximum allowed (₹${MAX_AMOUNT.toLocaleString('en-IN')}).`
  }

  if (!data.description || typeof data.description !== 'string' || !data.description.trim()) {
    return 'Could not determine what the expense is for.'
  }

  if ((data.description as string).length > 200) {
    data.description = (data.description as string).substring(0, 200)
  }

  if (data.splitType && !ALLOWED_SPLIT_TYPES.includes(data.splitType as string)) {
    data.splitType = 'equal'
  }

  if (data.category && !ALLOWED_CATEGORIES.includes(data.category as string)) {
    data.category = 'other'
  }

  if (data.splits && Array.isArray(data.splits)) {
    if (data.splits.length > MAX_PARTICIPANTS) {
      return `Too many participants (max ${MAX_PARTICIPANTS}).`
    }
    for (const s of data.splits) {
      if (!s.name || typeof s.name !== 'string') {
        return 'Invalid participant data.'
      }
      s.name = String(s.name).trim().substring(0, 100)
      if (s.amount != null && typeof s.amount !== 'number') s.amount = null
      if (s.percentage != null && typeof s.percentage !== 'number') s.percentage = null
      if (s.share != null && typeof s.share !== 'number') s.share = null
    }
  }

  if (data.emailSplits && Array.isArray(data.emailSplits)) {
    if (data.emailSplits.length > MAX_PARTICIPANTS) {
      return `Too many participants (max ${MAX_PARTICIPANTS}).`
    }
    for (const s of data.emailSplits) {
      if (!s.email || typeof s.email !== 'string' || !s.email.includes('@')) {
        return 'Invalid email participant data.'
      }
      s.email = String(s.email).trim().toLowerCase().substring(0, 200)
      s.name = s.name ? String(s.name).trim().substring(0, 100) : s.email.split('@')[0]
      if (s.amount != null && typeof s.amount !== 'number') s.amount = null
      if (s.percentage != null && typeof s.percentage !== 'number') s.percentage = null
      if (s.share != null && typeof s.share !== 'number') s.share = null
    }
  }

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
      const nonMe = allSplits.filter((s) => s.name !== 'me')
      const meSplit = allSplits.find((s) => s.name === 'me')
      if (nonMe.length === 1 && meSplit) {
        const meAmt = meSplit.amount as number
        nonMe[0].amount = Math.round((total - meAmt) * 100) / 100
      } else if (nonMe.length > 1) {
        const meAmt = meSplit?.amount ?? 0
        const remaining = total - (meAmt as number)
        const perPerson = Math.round((remaining / nonMe.length) * 100) / 100
        for (const s of nonMe) {
          s.amount = perPerson
        }
      }
    }
  }

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

  return null
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!isGeminiConfigured()) {
      return NextResponse.json(
        { error: 'AI is not configured. Please set GEMINI_API_KEY in environment variables.', code: 'NOT_CONFIGURED' },
        { status: 200 }
      )
    }

    const body = await req.json()
    const { text } = body as { text: string }

    if (!text?.trim()) {
      return NextResponse.json({ error: 'text is required' }, { status: 400 })
    }

    if (text.length > 1000) {
      return NextResponse.json(
        { error: 'Input too long. Please keep your description under 1000 characters.' },
        { status: 200 }
      )
    }

    const raw = await chatWithFallback(
      [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: text },
      ],
      { temperature: 0.1, max_tokens: 1024 }
    )

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

    const validationError = validateParse(parsed, text)
    if (validationError) {
      console.log('[AI Parse] Validation error:', validationError)
      return NextResponse.json({ error: validationError, rawText: text }, { status: 200 })
    }

    if (typeof parsed.amount === 'string') {
      parsed.amount = parseFloat(parsed.amount as string)
    }

    return NextResponse.json(parsed)
  } catch (error: any) {
    console.error('[AI Parse] Exception:', error?.message || error, 'Status:', error?.status, 'Code:', error?.code)
    const msg = error?.message || ''
    const status = error?.status || ''
    let userMessage = 'AI is temporarily unavailable. Please try again or fill the form manually.'
    if (msg.includes('API key') || msg.includes('not configured') || status === 401 || status === 403) {
      userMessage = 'AI API key is invalid or expired. Please update GEMINI_API_KEY in your Vercel environment settings.'
    } else if (msg.includes('rate limit') || status === 429) {
      userMessage = 'AI is rate limited. Please wait a moment and try again.'
    } else if (msg.includes('All Gemini models failed') || msg.includes('Gemini API failed')) {
      userMessage = 'AI models are currently unavailable. Please try again in a few minutes or fill the form manually.'
    } else if (msg.includes('too long') || msg.includes('token limit') || msg.includes('context_length')) {
      userMessage = 'Input is too long for AI. Please use a shorter description.'
    } else if (msg.includes('network') || msg.includes('fetch') || msg.includes('ECONNREFUSED') || msg.includes('timeout')) {
      userMessage = 'Could not reach AI service. Please check your connection and try again.'
    } else {
      userMessage = `AI error: ${msg || 'unknown'}. Please try again or fill the form manually.`
    }
    return NextResponse.json({ error: userMessage, code: 'AI_ERROR' }, { status: 200 })
  }
}
