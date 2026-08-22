import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth-utils'
import { db } from '@/lib/db'
import { getGroq, CHAT_MODEL } from '@/lib/groq'

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
    const { query, groupId } = body as { query: string; groupId?: string }

    if (!query?.trim()) {
      return NextResponse.json({ error: 'query is required' }, { status: 400 })
    }

    // ---- Fetch user context data ----

    // 1. Fetch all groups the user is part of
    const memberships = await db.groupMember.findMany({
      where: { userId: user.id },
      include: { group: { select: { id: true, name: true, emoji: true } } },
    })
    const userGroups = memberships.map((m) => ({
      id: m.group.id,
      name: m.group.name,
      emoji: m.group.emoji,
    }))

    // 2. Fetch friends
    const friends = await db.user.findMany({
      where: {
        OR: [
          { sentFriendRequests: { some: { addresseeId: user.id, status: 'accepted' } } },
          { receivedFriendRequests: { some: { requesterId: user.id, status: 'accepted' } } },
        ],
      },
      select: { id: true, name: true, email: true },
    })

    // 3. Calculate balances (owed to user / user owes)
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

        const theirSplitsInMyExpenses = await db.expenseSplit.findMany({
          where: { userId: m.userId, expense: { groupId: gid, createdBy: user.id } },
        })
        const mySplitsInTheirExpenses = await db.expenseSplit.findMany({
          where: { userId: user.id, expense: { groupId: gid, createdBy: m.userId } },
        })
        const settlementsFromThem = await db.settlement.findMany({
          where: { groupId: gid, fromUserId: m.userId, toUserId: user.id, status: 'completed' },
        })
        const settlementsFromMe = await db.settlement.findMany({
          where: { groupId: gid, fromUserId: user.id, toUserId: m.userId, status: 'completed' },
        })

        const theyOweMe = theirSplitsInMyExpenses.reduce((s, x) => s + Number(x.amount), 0)
        const iOweThem = mySplitsInTheirExpenses.reduce((s, x) => s + Number(x.amount), 0)
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

    // Direct expense balances (no group)
    const directExpenses = await db.expense.findMany({
      where: {
        groupId: null,
        OR: [{ createdBy: user.id }, { splits: { some: { userId: user.id } } }],
      },
      include: { splits: { include: { user: { select: { id: true, name: true } } } }, nonUserSplits: true },
    })

    const directBalances: Record<string, number> = {}
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
          const payerKey = exp.createdBy
          const payer = await db.user.findUnique({ where: { id: payerKey }, select: { name: true } })
          const pKey = payer?.name || payerKey
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

    // Net totals
    const totalOwedToMe = balanceSummary
      .filter((b) => b.direction === 'owes_me')
      .reduce((s, b) => s + b.amount, 0)
    const totalIOwe = balanceSummary
      .filter((b) => b.direction === 'i_owe')
      .reduce((s, b) => s + Math.abs(b.amount), 0)
    const netBalance = Math.round((totalOwedToMe - totalIOwe) * 100) / 100

    // 4. Fetch recent expenses (last 30)
    const recentExpenses = await db.expense.findMany({
      where: {
        OR: [
          { createdBy: user.id },
          { splits: { some: { userId: user.id } } },
        ],
        ...(groupId ? { groupId } : {}),
      },
      include: {
        paidByUser: { select: { name: true } },
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
      paidBy: e.paidByUser.name,
      group: e.group?.name || 'Direct',
      splitWith: e.splits.map((s) => s.user.name).filter(Boolean),
    }))

    // 5. Monthly totals
    const now = new Date()
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const thisMonthExpenses = await db.expense.findMany({
      where: {
        createdBy: user.id,
        date: { gte: thisMonthStart },
      },
    })
    const thisMonthTotal = thisMonthExpenses.reduce((s, e) => s + e.amount, 0)

    // Category breakdown this month
    const categoryTotals: Record<string, number> = {}
    for (const e of thisMonthExpenses) {
      const cat = e.category || 'other'
      categoryTotals[cat] = (categoryTotals[cat] || 0) + e.amount
    }

    // ---- Build system prompt with user data ----
    const systemPrompt = `You are a helpful AI assistant for SplitFlow, an expense splitting app. You help users understand their expenses, balances, and spending patterns.

CURRENCY: All amounts are in INR (Indian Rupees, ₹). Use ₹ symbol when showing amounts.

USER DATA:
- Name: ${user.name || 'User'}
- Total money others owe you (across all groups + direct): ₹${totalOwedToMe.toFixed(2)}
- Total money you owe others: ₹${totalIOwe.toFixed(2)}
- Net balance (positive = you are owed, negative = you owe): ₹${netBalance.toFixed(2)}

DETAILED BALANCES (positive = they owe you, negative = you owe them):
${balanceSummary.length > 0
  ? balanceSummary.map((b) => `  - ${b.name}: ₹${Math.abs(b.amount).toFixed(2)} (${b.direction === 'owes_me' ? 'owes you' : 'you owe'})`).join('\n')
  : '  No outstanding balances.'
}

THIS MONTH'S SPENDING (by ${user.name || 'you'}):
- Total: ₹${thisMonthTotal.toFixed(2)}
- By category: ${Object.entries(categoryTotals).map(([k, v]) => `${k}: ₹${v.toFixed(2)}`).join(', ') || 'None'}

RECENT EXPENSES (last 30):
${expenseSummary.length > 0
  ? expenseSummary.map((e) => `  - ₹${e.amount} for ${e.description} (${e.category}, ${e.date}, paid by ${e.paidBy}, group: ${e.group}, split with: ${e.splitWith.join(', ') || 'none'})`).join('\n')
  : '  No recent expenses.'
}

USER'S GROUPS: ${userGroups.map((g) => `${g.emoji} ${g.name}`).join(', ') || 'None'}
USER'S FRIENDS: ${friends.map((f) => f.name || f.email).join(', ') || 'None'}

RESPONSE RULES:
1. Be conversational and friendly. Use short paragraphs.
2. When asked about money owed/to get back, use the balance data above to give exact ₹ amounts.
3. When asked about spending, reference the expense data and category breakdowns.
4. If the user asks to "add" an expense (e.g., "add 100 for food"), respond with a friendly confirmation and include a JSON block at the END of your message in this exact format:
   ---CREATE_EXPENSE---
   {"description": "...", "amount": ..., "category": "...", "splitType": "single"}
   ---END---
   Infer the category from context (food, transport, entertainment, etc.). Only include this block if the user is clearly asking to add/log an expense.
5. If the user mentions splitting with specific friends, check if they are in the friends list. If yes, mention them by name. If not, say you can't find that person in their friends list.
6. Use ₹ for all amounts. Be specific with numbers.
7. Keep responses concise (2-4 sentences unless more detail is requested).
8. If asked about a specific group, focus your answer on that group's data.
9. Do NOT make up expense data. Only use what is provided above.`

    // Build messages array with conversation memory (last 6 messages for context)
    const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
      { role: 'system', content: systemPrompt },
    ]

    // Add conversation history if provided
    const history = body.history as { role: 'user' | 'assistant'; content: string }[] | undefined
    if (history && history.length > 0) {
      const recentHistory = history.slice(-6) // last 6 messages for context window
      for (const msg of recentHistory) {
        messages.push({ role: msg.role, content: msg.content })
      }
    }

    // Add current query
    messages.push({ role: 'user', content: query })

    const response = await getGroq().chat.completions.create({
      model: CHAT_MODEL,
      messages,
      temperature: 0.4,
      max_tokens: 1024,
    })

    const raw = response.choices?.[0]?.message?.content ?? ''

    // Check if the AI wants to create an expense
    let createExpense = null
    const expenseMatch = raw.match(/---CREATE_EXPENSE---\s*\n?([\s\S]*?)\n?---END---/)
    if (expenseMatch) {
      try {
        createExpense = JSON.parse(expenseMatch[1].trim())
      } catch {
        // ignore parse errors
      }
    }

    // Clean the response text (remove the expense JSON block from display)
    const cleanResponse = raw
      .replace(/---CREATE_EXPENSE---[\s\S]*?---END---/g, '')
      .trim()

    return NextResponse.json({
      text: cleanResponse || 'I could not generate a response. Please try again.',
      createExpense,
    })
  } catch (error) {
    console.error('Error in AI chat:', error)
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    )
  }
}
