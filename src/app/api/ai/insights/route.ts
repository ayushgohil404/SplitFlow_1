import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth-utils'
import { db } from '@/lib/db'
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

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { groupId } = body as { groupId: string }

    if (!groupId) {
      return NextResponse.json({ error: 'groupId is required' }, { status: 400 })
    }

    // Verify membership
    const membership = await db.groupMember.findUnique({
      where: {
        groupId_userId: { groupId, userId: user.id },
      },
    })
    if (!membership) {
      return NextResponse.json({ error: 'Not a member of this group' }, { status: 403 })
    }

    // Fetch all expenses for the group with splits and user info
    const expenses = await db.expense.findMany({
      where: { groupId },
      include: {
        splits: {
          include: {
            user: {
              select: { id: true, name: true },
            },
          },
        },
        paidByUser: {
          select: { id: true, name: true },
        },
      },
      orderBy: { date: 'desc' },
    })

    if (expenses.length === 0) {
      return NextResponse.json({
        insights: 'No expenses found in this group yet. Add some expenses to get insights!',
        summary: 'No data available',
      })
    }

    // Prepare data summary for the LLM
    const totalAmount = expenses.reduce((sum, e) => sum + e.amount, 0)
    const categoryTotals: Record<string, number> = {}
    const memberTotals: Record<string, { name: string; paid: number; share: number }> = {}

    for (const expense of expenses) {
      const cat = expense.category ?? 'other'
      categoryTotals[cat] = (categoryTotals[cat] ?? 0) + expense.amount

      const payerName = expense.paidByUser.name ?? 'Unknown'
      if (!memberTotals[expense.createdBy]) {
        memberTotals[expense.createdBy] = { name: payerName, paid: 0, share: 0 }
      }
      memberTotals[expense.createdBy].paid += expense.amount

      for (const split of expense.splits) {
        const memberName = split.user.name ?? 'Unknown'
        if (!memberTotals[split.userId]) {
          memberTotals[split.userId] = { name: memberName, paid: 0, share: 0 }
        }
        memberTotals[split.userId].share += split.amount
      }
    }

    const expenseData = {
      totalExpenses: expenses.length,
      totalAmount: Math.round(totalAmount * 100) / 100,
      categoryBreakdown: categoryTotals,
      memberBreakdown: Object.values(memberTotals).map((m) => ({
        name: m.name,
        paid: Math.round(m.paid * 100) / 100,
        share: Math.round(m.share * 100) / 100,
        balance: Math.round((m.paid - m.share) * 100) / 100,
      })),
      dateRange: {
        earliest: expenses[expenses.length - 1]?.date.toISOString() ?? null,
        latest: expenses[0]?.date.toISOString() ?? null,
      },
      recentExpenses: expenses.slice(0, 20).map((e) => ({
        description: e.description,
        amount: e.amount,
        category: e.category,
        date: e.date.toISOString(),
        paidBy: e.paidByUser.name ?? 'Unknown',
        splitType: e.splitType,
      })),
    }

    const systemPrompt = `You are a financial insights assistant for SplitFlow, an expense splitting app. Analyze the provided expense data and generate actionable insights.

You must return ONLY valid JSON with this schema:
{
  "insights": "string - detailed markdown-formatted analysis with sections for: top spending categories, spending patterns, unusual patterns, spending trends, member comparisons, and money-saving suggestions. Use markdown formatting (headers, bullet points, bold).",
  "summary": "string - a concise 2-3 sentence summary of the key findings"
}

Be specific with numbers. Reference actual amounts and categories. If there are interesting patterns (e.g., one person paying much more, certain categories dominating), highlight them. Provide practical money-saving tips relevant to the group's spending patterns.

Do NOT wrap the JSON in markdown code blocks. Return raw JSON only.`

    const zai = await ZAI.create()
    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Analyze this group's expense data:\n\n${JSON.stringify(expenseData, null, 2)}` },
    ]
    const response = await zai.chat.completions.create({ messages })
    const raw = response.choices?.[0]?.message?.content ?? ''
    const parsed = extractJSON(raw) as { insights: string; summary: string }

    return NextResponse.json({
      insights: parsed.insights ?? 'Unable to generate insights.',
      summary: parsed.summary ?? 'No summary available.',
    })
  } catch (error) {
    console.error('Error generating insights:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
