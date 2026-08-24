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

    const balances: Map<string, number> = new Map()

    for (const m of members) {
      balances.set(m.userId, 0)
    }

    const paidByUser = await db.expense.groupBy({
      by: ['createdBy'],
      where: { groupId },
      _sum: { amount: true },
    })
    for (const entry of paidByUser) {
      const val = balances.get(entry.createdBy) ?? 0
      balances.set(entry.createdBy, val + (entry._sum.amount ?? 0))
    }

    const owedByUser = await db.expenseSplit.groupBy({
      by: ['userId'],
      where: { expense: { groupId } },
      _sum: { amount: true },
    })
    for (const entry of owedByUser) {
      const val = balances.get(entry.userId) ?? 0
      balances.set(entry.userId, val - (entry._sum.amount ?? 0))
    }

    const sentSettlements = await db.settlement.groupBy({
      by: ['fromUserId'],
      where: { groupId, status: 'completed' },
      _sum: { amount: true },
    })
    for (const entry of sentSettlements) {
      const val = balances.get(entry.fromUserId) ?? 0
      balances.set(entry.fromUserId, val - (entry._sum.amount ?? 0))
    }

    const receivedSettlements = await db.settlement.groupBy({
      by: ['toUserId'],
      where: { groupId, status: 'completed' },
      _sum: { amount: true },
    })
    for (const entry of receivedSettlements) {
      const val = balances.get(entry.toUserId) ?? 0
      balances.set(entry.toUserId, val + (entry._sum.amount ?? 0))
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
