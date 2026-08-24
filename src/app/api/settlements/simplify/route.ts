import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth-utils'
import { db } from '@/lib/db'

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

    const members = await db.groupMember.findMany({
      where: { groupId },
      select: { userId: true },
    })

    if (members.length === 0) {
      return NextResponse.json({ settlements: [] })
    }

    // Calculate each member's net balance using paidAmount from splits
    const balances: Map<string, number> = new Map()
    for (const m of members) {
      balances.set(m.userId, 0)
    }

    // Get all splits with expense info for backward compatibility
    const allSplits = await db.expenseSplit.findMany({
      where: { expense: { groupId } },
      select: {
        userId: true,
        amount: true,
        paidAmount: true,
        expenseId: true,
        expense: { select: { createdBy: true, amount: true } },
      },
    })

    // Group splits by expense for backward compatibility
    const expenseSplitsMap = new Map<string, typeof allSplits>()
    for (const split of allSplits) {
      if (!expenseSplitsMap.has(split.expenseId)) {
        expenseSplitsMap.set(split.expenseId, [])
      }
      expenseSplitsMap.get(split.expenseId)!.push(split)
    }

    for (const [, splits] of expenseSplitsMap) {
      const hasAnyPayment = splits.some(s => (s.paidAmount || 0) > 0.005)

      if (!hasAnyPayment) {
        // Legacy expense: createdBy paid the full amount
        const createdBy = splits[0].expense.createdBy
        const totalAmount = splits[0].expense.amount
        for (const split of splits) {
          const paidAmt = split.userId === createdBy ? totalAmount : 0
          const net = paidAmt - Number(split.amount)
          const current = balances.get(split.userId) ?? 0
          balances.set(split.userId, Math.round((current + net) * 100) / 100)
        }
      } else {
        for (const split of splits) {
          const net = (split.paidAmount || 0) - Number(split.amount)
          const current = balances.get(split.userId) ?? 0
          balances.set(split.userId, Math.round((current + net) * 100) / 100)
        }
      }
    }

    // Subtract completed settlements
    const sentSettlements = await db.settlement.groupBy({
      by: ['fromUserId'],
      where: { groupId, status: 'completed' },
      _sum: { amount: true },
    })
    for (const entry of sentSettlements) {
      const val = balances.get(entry.fromUserId) ?? 0
      balances.set(entry.fromUserId, Math.round((val - (entry._sum.amount ?? 0)) * 100) / 100)
    }

    const receivedSettlements = await db.settlement.groupBy({
      by: ['toUserId'],
      where: { groupId, status: 'completed' },
      _sum: { amount: true },
    })
    for (const entry of receivedSettlements) {
      const val = balances.get(entry.toUserId) ?? 0
      balances.set(entry.toUserId, Math.round((val + (entry._sum.amount ?? 0)) * 100) / 100)
    }

    const debtors: { userId: string; amount: number }[] = []
    const creditors: { userId: string; amount: number }[] = []

    for (const [userId, balance] of balances) {
      if (balance < -0.005) {
        debtors.push({ userId, amount: Math.round(-balance * 100) / 100 })
      } else if (balance > 0.005) {
        creditors.push({ userId, amount: Math.round(balance * 100) / 100 })
      }
    }

    debtors.sort((a, b) => b.amount - a.amount)
    creditors.sort((a, b) => b.amount - a.amount)

    const simplified: { fromUserId: string; toUserId: string; amount: number }[] = []
    let i = 0
    let j = 0

    while (i < debtors.length && j < creditors.length) {
      const transferAmount = Math.min(debtors[i].amount, creditors[j].amount)
      const rounded = Math.round(transferAmount * 100) / 100

      if (rounded > 0) {
        simplified.push({
          fromUserId: debtors[i].userId,
          toUserId: creditors[j].userId,
          amount: rounded,
        })
      }

      debtors[i].amount = Math.round((debtors[i].amount - transferAmount) * 100) / 100
      creditors[j].amount = Math.round((creditors[j].amount - transferAmount) * 100) / 100

      if (debtors[i].amount <= 0.005) i++
      if (creditors[j].amount <= 0.005) j++
    }

    if (simplified.length === 0) {
      return NextResponse.json({ settlements: [] })
    }

    const allUserIds = [...new Set(simplified.flatMap((s) => [s.fromUserId, s.toUserId]))]
    const users = await db.user.findMany({
      where: { id: { in: allUserIds } },
      select: { id: true, name: true },
    })
    const nameMap = new Map(users.map((u) => [u.id, u.name || 'Unknown']))

    const result = simplified.map((s) => ({
      fromUserId: s.fromUserId,
      fromUserName: nameMap.get(s.fromUserId) || 'Unknown',
      toUserId: s.toUserId,
      toUserName: nameMap.get(s.toUserId) || 'Unknown',
      amount: s.amount,
    }))

    return NextResponse.json({ settlements: result })
  } catch (error) {
    console.error('Error simplifying debts:', error)
    return NextResponse.json({ error: 'Failed to simplify debts. Please try again.' }, { status: 500 })
  }
}
