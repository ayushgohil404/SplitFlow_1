import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth-utils'
import { db } from '@/lib/db'
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

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!isGeminiConfigured()) {
      return NextResponse.json({ error: 'AI service not configured', code: 'NOT_CONFIGURED' }, { status: 200 })
    }

    const body = await req.json()
    const { groupId } = body as { groupId: string }

    if (!groupId) {
      return NextResponse.json({ error: 'groupId is required' }, { status: 400 })
    }

    const membership = await db.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId: user.id } },
    })
    if (!membership) {
      return NextResponse.json({ error: 'Not a member of this group' }, { status: 403 })
    }

    const expenses = await db.expense.findMany({
      where: { groupId },
      include: {
        splits: { include: { user: { select: { id: true, name: true } } } },
        paidBy: { select: { id: true, name: true } },
      },
      orderBy: { date: 'desc' },
    })

    if (expenses.length === 0) {
      return NextResponse.json({
        insights: 'No expenses found in this group yet. Add some expenses to get insights!',
        summary: 'No data available',
      })
    }

    const totalAmount = expenses.reduce((sum, e) => sum + e.amount, 0)
    const categoryTotals: Record<string, number> = {}
    const memberTotals: Record<string, { name: string; paid: number; share: number }> = {}

    for (const expense of expenses) {
      const cat = expense.category ?? 'other'
      categoryTotals[cat] = (categoryTotals[cat] ?? 0) + expense.amount

      const payerName = expense.paidBy?.name ?? 'Unknown'
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
        paidBy: e.paidBy?.name ?? 'Unknown',
        splitType: e.splitType,
      })),
    }

    const systemPrompt = `You are a financial insights assistant for SplitFlow. Analyze the provided expense data and generate actionable insights.

Return ONLY valid JSON:
{
  "insights": "detailed markdown analysis with sections: top categories, patterns, unusual items, trends, member comparisons, savings tips. Use headers, bullets, bold.",
  "summary": "2-3 sentence summary"
}

Be specific with numbers. Reference actual amounts and categories. Provide practical tips.
Do NOT wrap in markdown code blocks. Return raw JSON only.`

    const raw = await chatWithFallback(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Analyze this group's expense data:\n\n${JSON.stringify(expenseData, null, 2)}` },
      ],
      { temperature: 0.3, max_tokens: 2048 }
    )

    let parsed: { insights?: string; summary?: string }
    try {
      parsed = extractJSON(raw) as typeof parsed
    } catch {
      return NextResponse.json({
        insights: raw || 'Unable to generate structured insights.',
        summary: 'AI response could not be parsed.',
      })
    }

    return NextResponse.json({
      insights: parsed.insights ?? 'Unable to generate insights.',
      summary: parsed.summary ?? 'No summary available.',
    })
  } catch (error: any) {
    console.error('Error generating insights:', error?.message || error)
    const msg = error?.message || ''
    let userMsg = 'Failed to generate insights. Please try again later.'
    if (msg.includes('API key') || msg.includes('401') || msg.includes('403')) {
      userMsg = 'AI API key is invalid. Update GEMINI_API_KEY in Vercel settings.'
    } else if (msg.includes('All AI models failed') || msg.includes('Gemini API failed')) {
      userMsg = 'AI models are currently unavailable. Please try again later.'
    }
    return NextResponse.json({ error: userMsg, code: 'AI_ERROR' }, { status: 200 })
  }
}
