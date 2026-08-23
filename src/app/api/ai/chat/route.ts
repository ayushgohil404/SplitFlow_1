import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth-utils'
import { db } from '@/lib/db'
import { chatWithFallback, isGroqConfigured } from '@/lib/groq'

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!isGroqConfigured()) {
      return NextResponse.json(
        { error: 'AI is not configured. Please set a valid GROQ_API_KEY in environment variables.', code: 'NOT_CONFIGURED' },
        { status: 200 }
      )
    }

    const body = await req.json()
    const { query, groupId } = body as { query: string; groupId?: string }

    if (!query?.trim()) {
      return NextResponse.json({ error: 'query is required' }, { status: 400 })
    }

    // ---- Fetch user context data ----

    const memberships = await db.groupMember.findMany({
      where: { userId: user.id },
      include: { group: { select: { id: true, name: true, emoji: true } } },
    })
    const userGroups = memberships.map((m) => ({
      id: m.group.id,
      name: m.group.name,
      emoji: m.group.emoji,
    }))

    const acceptedFriendships = await db.friendship.findMany({
      where: {
        OR: [
          { requesterId: user.id, status: 'accepted' },
          { addresseeId: user.id, status: 'accepted' },
        ],
      },
      include: {
        requester: { select: { id: true, name: true, email: true } },
        addressee: { select: { id: true, name: true, email: true } },
      },
    })
    const friends = acceptedFriendships.map((f) => {
      const isRequester = f.requesterId === user.id
      return isRequester ? f.addressee : f.requester
    })

    // Calculate balances (owed to user / user owes)
    const balanceSummary: { name: string; amount: number; direction: 'owes_me' | 'i_owe' }[] = []

    // Group-based balances
    for (const membership of memberships) {
      const gid = membership.groupId
      const members = await db.groupMember.findMany({
        where: { groupId: gid },
        include: { user: { select: { id: true, name: true } } },
      })

      for (const m of members) {
        if (m.userId === user.id) continue

        const [theirSplits, mySplits, settlementsFromThem, settlementsFromMe] = await Promise.all([
          db.expenseSplit.findMany({
            where: { userId: m.userId, expense: { groupId: gid, createdBy: user.id } },
          }),
          db.expenseSplit.findMany({
            where: { userId: user.id, expense: { groupId: gid, createdBy: m.userId } },
          }),
          db.settlement.findMany({
            where: { groupId: gid, fromUserId: m.userId, toUserId: user.id, status: 'completed' },
          }),
          db.settlement.findMany({
            where: { groupId: gid, fromUserId: user.id, toUserId: m.userId, status: 'completed' },
          }),
        ])

        const theyOweMe = theirSplits.reduce((s, x) => s + Number(x.amount), 0)
        const iOweThem = mySplits.reduce((s, x) => s + Number(x.amount), 0)
        const theyPaidMe = settlementsFromThem.reduce((s, x) => s + Number(x.amount), 0)
        const iPaidThem = settlementsFromMe.reduce((s, x) => s + Number(x.amount), 0)

        const net = (theyOweMe - theyPaidMe) - (iOweThem - iPaidThem)
        if (Math.abs(net) > 0.005) {
          const existing = balanceSummary.find((b) => b.name === (m.user.name || m.userId))
          if (existing) {
            existing.amount = Math.round((existing.amount + net) * 100) / 100
          } else {
            balanceSummary.push({
              name: m.user.name || m.userId,
              amount: Math.round(net * 100) / 100,
              direction: net > 0 ? 'owes_me' : 'i_owe',
            })
          }
        }
      }
    }

    // Direct expense balances
    const directExpenses = await db.expense.findMany({
      where: {
        groupId: null,
        OR: [{ createdBy: user.id }, { splits: { some: { userId: user.id } } }],
      },
      include: { splits: { include: { user: { select: { id: true, name: true } } } }, nonUserSplits: true },
    })

    const directBalances: Record<string, number> = {}
    const payerCache: Record<string, string> = {}

    for (const exp of directExpenses) {
      const isPayer = exp.createdBy === user.id
      for (const split of exp.splits) {
        if (split.userId === user.id) continue
        const key = split.user.name || split.userId
        if (!directBalances[key]) directBalances[key] = 0
        if (isPayer) {
          directBalances[key] += Number(split.amount)
        }
      }
      if (!isPayer) {
        const mySplit = exp.splits.find((s) => s.userId === user.id)
        if (mySplit) {
          if (!payerCache[exp.createdBy]) {
            const payer = await db.user.findUnique({ where: { id: exp.createdBy }, select: { name: true } })
            payerCache[exp.createdBy] = payer?.name || exp.createdBy
          }
          const pKey = payerCache[exp.createdBy]
          if (!directBalances[pKey]) directBalances[pKey] = 0
          directBalances[pKey] -= Number(mySplit.amount)
        }
      }
      for (const nus of exp.nonUserSplits) {
        if (isPayer) {
          const key = nus.name || nus.email
          if (!directBalances[key]) directBalances[key] = 0
          directBalances[key] += Number(nus.amount)
        }
      }
    }

    for (const [name, amount] of Object.entries(directBalances)) {
      if (Math.abs(amount) > 0.005) {
        const existing = balanceSummary.find((b) => b.name === name)
        if (existing) {
          existing.amount = Math.round((existing.amount + amount) * 100) / 100
        } else {
          balanceSummary.push({
            name,
            amount: Math.round(amount * 100) / 100,
            direction: amount > 0 ? 'owes_me' : 'i_owe',
          })
        }
      }
    }

    const totalOwedToMe = balanceSummary
      .filter((b) => b.direction === 'owes_me')
      .reduce((s, b) => s + b.amount, 0)
    const totalIOwe = balanceSummary
      .filter((b) => b.direction === 'i_owe')
      .reduce((s, b) => s + Math.abs(b.amount), 0)
    const netBalance = Math.round((totalOwedToMe - totalIOwe) * 100) / 100

    // Recent expenses
    const recentExpenses = await db.expense.findMany({
      where: {
        OR: [
          { createdBy: user.id },
          { splits: { some: { userId: user.id } } },
        ],
        ...(groupId ? { groupId } : {}),
      },
      include: {
        paidBy: { select: { name: true } },
        splits: { include: { user: { select: { name: true } } } },
        group: { select: { name: true } },
      },
      orderBy: { date: 'desc' },
      take: 30,
    })

    const expenseSummary = recentExpenses.map((e) => ({
      description: e.description,
      amount: e.amount,
      category: e.category,
      date: e.date.toISOString().split('T')[0],
      paidBy: e.paidBy?.name || 'Unknown',
      group: e.group?.name || 'Direct',
      splitWith: e.splits.map((s) => s.user.name).filter(Boolean),
    }))

    // Monthly totals
    const now = new Date()
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const thisMonthExpenses = await db.expense.findMany({
      where: { createdBy: user.id, date: { gte: thisMonthStart } },
    })
    const thisMonthTotal = thisMonthExpenses.reduce((s, e) => s + e.amount, 0)

    const categoryTotals: Record<string, number> = {}
    for (const e of thisMonthExpenses) {
      const cat = e.category || 'other'
      categoryTotals[cat] = (categoryTotals[cat] || 0) + e.amount
    }

    // Build system prompt — full chatbot
    const systemPrompt = `You are SplitFlow AI, a friendly and helpful expense-splitting assistant. You help users with ANY request about their expenses, balances, groups, friends, and the app itself.

CURRENCY: All amounts are in INR (Indian Rupees, ₹). Use ₹ symbol.

USER DATA:
- Name: ${user.name || 'User'}
- Total money others owe you: ₹${totalOwedToMe.toFixed(2)}
- Total money you owe others: ₹${totalIOwe.toFixed(2)}
- Net balance: ₹${netBalance.toFixed(2)}

DETAILED BALANCES (positive = they owe you, negative = you owe them):
${balanceSummary.length > 0
  ? balanceSummary.map((b) => `  - ${b.name}: ₹${Math.abs(b.amount).toFixed(2)} (${b.direction === 'owes_me' ? 'owes you' : 'you owe'})`).join('\n')
  : '  No outstanding balances.'
}

THIS MONTH'S SPENDING:
- Total: ₹${thisMonthTotal.toFixed(2)}
- By category: ${Object.entries(categoryTotals).map(([k, v]) => `${k}: ₹${v.toFixed(2)}`).join(', ') || 'None'}

RECENT EXPENSES (last 30):
${expenseSummary.length > 0
  ? expenseSummary.map((e) => `  - ₹${e.amount} for ${e.description} (${e.category}, ${e.date}, paid by ${e.paidBy}, group: ${e.group}, split with: ${e.splitWith.join(', ') || 'none'})`).join('\n')
  : '  No recent expenses.'
}

USER'S GROUPS: ${userGroups.map((g) => `\"${g.name}\" (id: ${g.id})`).join(', ') || 'None'}
USER'S FRIENDS: ${friends.map((f) => `${f.name} (${f.email})`).join(', ') || 'None'}
USER'S EMAIL: ${user.email}

## CAPABILITIES:
1. **Expense Q&A**: Answer questions about spending, balances, who owes whom, category breakdowns, trends
2. **Create Expenses**: When user says things like "add 500 for food", "log expense", "I paid 1000 for...", create an expense
3. **General Chat**: Answer greetings, how-to questions, explain app features, give financial tips
4. **Math Help**: Calculate splits, convert amounts, do quick math

## EXPENSE CREATION RULES:
When the user wants to add/log/create an expense, extract ALL details and output a JSON block at the END:

---CREATE_EXPENSE---
{"description": "string", "amount": number, "category": "food|transport|entertainment|shopping|bills|rent|travel|health|education|groceries|utilities|other", "splitType": "equal|exact|percentage|share|single", "groupId": "group-name-or-null", "splits": [{"name": "me|friend-name", "amount": number|null, "percentage": number|null, "share": number|null}], "emailSplits": [{"email": "string", "name": "string", "amount": number|null, "percentage": number|null}]}
---END---

Rules for expense creation:
- "for me only" / "personal" / "just me" / no sharing mentioned → splitType="single"
- "split with X" / "split equally" / "50/50" → splitType="equal", include all participants including "me"
- "family of N" / "N members" → splitType="share", set share values
- Exact amounts → splitType="exact", amounts must sum to total
- Percentages → splitType="percentage", must sum to 100
- If a name matches a friend, use that friend's name. If not found and it contains @, put in emailSplits
- If a group name is mentioned, set groupId to the group name string
- Always include "me" in splits when splitting with others (user is always a participant)
- The "me" split amount = total - sum of others (for exact)
- Default category based on description context

Before the JSON block, write a friendly confirmation message like "I've prepared this expense for you. Review and confirm to add it!"

## GENERAL RULES:
1. Be conversational and friendly. Use short paragraphs.
2. When asked about money, use the balance data above to give exact ₹ amounts.
3. When asked about spending, reference the expense data and category breakdowns.
4. Keep responses concise (2-4 sentences unless more detail is requested).
5. Do NOT make up expense data. Only use what is provided.
6. Handle greetings naturally ("hi", "hello", "hey")
7. Handle app questions ("how to split?", "what is share split?")
8. If asked about a specific group, focus on that group's data.
9. Support ALL input types: natural language, shorthand ("1k"), slang, typos
10. Always respond — never say you can't help.`

    const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
      { role: 'system', content: systemPrompt },
    ]

    const history = body.history as { role: 'user' | 'assistant'; content: string }[] | undefined
    if (history && history.length > 0) {
      const recentHistory = history.slice(-10)
      for (const msg of recentHistory) {
        messages.push({ role: msg.role, content: msg.content })
      }
    }

    messages.push({ role: 'user', content: query })

    const raw = await chatWithFallback(messages, {
      temperature: 0.4,
      max_tokens: 2048,
    })

    // Check if the AI wants to create an expense
    let createExpense = null
    const expenseMatch = raw.match(/---CREATE_EXPENSE---\s*\n?([\s\S]*?)\n?---END---/)
    if (expenseMatch) {
      try {
        const parsed = JSON.parse(expenseMatch[1].trim())
        // Validate the parsed expense has minimum required fields
        if (parsed.description && parsed.amount && parsed.amount > 0) {
          // Ensure splitType is valid
          const validTypes = ['equal', 'exact', 'percentage', 'share', 'single']
          if (!parsed.splitType || !validTypes.includes(parsed.splitType)) {
            parsed.splitType = 'single'
          }
          // Ensure valid category
          const validCategories = ['food', 'transport', 'entertainment', 'shopping', 'bills', 'rent', 'travel', 'health', 'education', 'groceries', 'utilities', 'other']
          if (!parsed.category || !validCategories.includes(parsed.category)) {
            parsed.category = 'other'
          }
          createExpense = parsed
        }
      } catch {
        // ignore malformed JSON
      }
    }

    const cleanResponse = raw
      .replace(/---CREATE_EXPENSE---[\s\S]*?---END---/g, '')
      .trim()

    return NextResponse.json({
      text: cleanResponse || 'I could not generate a response. Please try again.',
      createExpense,
    })
  } catch (error: any) {
    console.error('Error in AI chat:', error?.message || error, 'Status:', error?.status, 'Code:', error?.code)
    const msg = error?.message || ''
    const status = error?.status || ''
    let userMessage = 'Something went wrong. Please try again.'
    if (msg.includes('API key') || msg.includes('not configured') || status === 401 || status === 403) {
      userMessage = 'AI API key is invalid or expired. Please update GROQ_API_KEY in Vercel environment settings.'
    } else if (msg.includes('rate limit') || status === 429) {
      userMessage = 'AI is rate limited. Please wait a moment and try again.'
    } else if (msg.includes('All AI models failed')) {
      const detail = msg.replace('All AI models failed: ', '')
      userMessage = `AI models unavailable (${detail}). Please try again in a few minutes.`
    } else if (msg.includes('too long') || msg.includes('token limit') || msg.includes('context_length')) {
      userMessage = 'Conversation too long. Start a new chat or clear history.'
    } else if (msg.includes('network') || msg.includes('fetch') || msg.includes('ECONNREFUSED') || msg.includes('timeout')) {
      userMessage = 'Could not reach AI service. Please check your connection and try again.'
    } else {
      userMessage = `AI error: ${msg || 'unknown'}. Please try again.`
    }
    return NextResponse.json({ error: userMessage, code: 'AI_ERROR' }, { status: 200 })
  }
}
