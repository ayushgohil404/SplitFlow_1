import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth-utils'
import { db } from '@/lib/db'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const group = await db.group.findUnique({
      where: { id },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, name: true, image: true },
            },
          },
        },
        expenses: {
          include: {
            splits: true,
            paidBy: {
              select: { id: true, name: true, image: true },
            },
          },
          orderBy: { date: 'desc' },
        },
      },
    })

    if (!group) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 })
    }

    const memberIds = group.members.map((m) => m.userId)

    // Calculate balances using paidAmount from splits (supports multi-payer)
    // For old expenses where paidAmount is all 0, fall back to createdBy paying full amount
    const allSplits = await db.expenseSplit.findMany({
      where: { expense: { groupId: id } },
      select: {
        userId: true,
        amount: true,
        paidAmount: true,
        expenseId: true,
        expense: { select: { createdBy: true, amount: true } },
      },
    })

    // Group splits by expense for backward compatibility check
    const expenseSplitsMap = new Map<string, typeof allSplits>()
    for (const split of allSplits) {
      if (!expenseSplitsMap.has(split.expenseId)) {
        expenseSplitsMap.set(split.expenseId, [])
      }
      expenseSplitsMap.get(split.expenseId)!.push(split)
    }

    // Calculate each member's net balance: sum(paidAmount) - sum(amount)
    const memberNets: Map<string, number> = new Map()
    for (const m of group.members) {
      memberNets.set(m.userId, 0)
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
          const current = memberNets.get(split.userId) ?? 0
          memberNets.set(split.userId, Math.round((current + net) * 100) / 100)
        }
      } else {
        // New expense: use paidAmount from splits
        for (const split of splits) {
          const net = (split.paidAmount || 0) - Number(split.amount)
          const current = memberNets.get(split.userId) ?? 0
          memberNets.set(split.userId, Math.round((current + net) * 100) / 100)
        }
      }
    }

    // Subtract completed settlements
    const settlements = await db.settlement.findMany({
      where: { groupId: id, status: 'completed' },
      select: { fromUserId: true, toUserId: true, amount: true },
    })
    for (const s of settlements) {
      const fromVal = memberNets.get(s.fromUserId) ?? 0
      memberNets.set(s.fromUserId, Math.round((fromVal - Number(s.amount)) * 100) / 100)
      const toVal = memberNets.get(s.toUserId) ?? 0
      memberNets.set(s.toUserId, Math.round((toVal + Number(s.amount)) * 100) / 100)
    }

    // Simplify to minimal pairwise transactions
    const debts: { userId: string; net: number }[] = []
    for (const [uid, net] of memberNets) {
      if (Math.abs(net) > 0.005) {
        debts.push({ userId: uid, net })
      }
    }

    const debtors = debts.filter(d => d.net < -0.005).map(d => ({ userId: d.userId, amount: Math.round(-d.net * 100) / 100 })).sort((a, b) => b.amount - a.amount)
    const creditors = debts.filter(d => d.net > 0.005).map(d => ({ userId: d.userId, amount: Math.round(d.net * 100) / 100 })).sort((a, b) => b.amount - a.amount)

    const balances: { fromUserId: string; toUserId: string; amount: number }[] = []
    let i = 0, j = 0
    while (i < debtors.length && j < creditors.length) {
      const transfer = Math.min(debtors[i].amount, creditors[j].amount)
      const rounded = Math.round(transfer * 100) / 100
      if (rounded > 0) {
        balances.push({
          fromUserId: debtors[i].userId,
          toUserId: creditors[j].userId,
          amount: rounded,
        })
      }
      debtors[i].amount = Math.round((debtors[i].amount - transfer) * 100) / 100
      creditors[j].amount = Math.round((creditors[j].amount - transfer) * 100) / 100
      if (debtors[i].amount <= 0.005) i++
      if (creditors[j].amount <= 0.005) j++
    }

    // Build balance detail with user names
    const userNameMap = new Map<string, string>()
    for (const m of group.members) {
      userNameMap.set(m.userId, m.user?.name || 'Unknown')
    }

    const balancesWithNames = balances.map(b => ({
      from: { id: b.fromUserId, name: userNameMap.get(b.fromUserId) || 'Unknown' },
      to: { id: b.toUserId, name: userNameMap.get(b.toUserId) || 'Unknown' },
      amount: b.amount,
    }))

    return NextResponse.json({ group, balances })
  } catch (error) {
    console.error('Error fetching group:', error)
    return NextResponse.json({ error: 'Failed to load group. Please refresh.' }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const membership = await db.groupMember.findUnique({
      where: {
        groupId_userId: { groupId: id, userId: user.id },
      },
    })

    if (!membership || membership.role !== 'admin') {
      return NextResponse.json({ error: 'Only admins can update the group' }, { status: 403 })
    }

    const body = await req.json()
    const { name, description, emoji, currency } = body as {
      name?: string
      description?: string
      emoji?: string
      currency?: string
    }

    const updateData: Record<string, string | null> = {}
    if (name !== undefined) updateData.name = name.trim()
    if (description !== undefined) updateData.description = description?.trim() ?? null
    if (emoji !== undefined) updateData.emoji = emoji ?? null
    if (currency !== undefined) updateData.currency = currency

    const group = await db.group.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json({ group })
  } catch (error) {
    console.error('Error updating group:', error)
    return NextResponse.json({ error: 'Failed to update group. Please try again.' }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const membership = await db.groupMember.findUnique({
      where: {
        groupId_userId: { groupId: id, userId: user.id },
      },
    })

    if (!membership || membership.role !== 'admin') {
      return NextResponse.json({ error: 'Only admins can delete the group' }, { status: 403 })
    }

    await db.group.delete({ where: { id } })

    return NextResponse.json({ message: 'Group deleted' })
  } catch (error) {
    console.error('Error deleting group:', error)
    return NextResponse.json({ error: 'Failed to delete group. Please try again.' }, { status: 500 })
  }
}
