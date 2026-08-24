import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth-utils'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const friendId = new URL(req.url).searchParams.get('friendId')
    if (!friendId) {
      return NextResponse.json({ error: 'friendId is required' }, { status: 400 })
    }

    // Find all expenses where both users are involved as splitters
    // Use two separate some conditions
    const expenses = await db.expense.findMany({
      where: {
        AND: [
          {
            splits: {
              some: {
                userId: user.id,
              },
            },
          },
          {
            splits: {
              some: {
                userId: friendId,
              },
            },
          },
        ],
      },
      include: {
        splits: {
          where: {
            userId: { in: [user.id, friendId] },
          },
          include: {
            user: {
              select: { id: true, name: true, image: true },
            },
          },
        },
        paidBy: {
          select: { id: true, name: true, image: true },
        },
        group: {
          select: { id: true, name: true, emoji: true },
        },
      },
      orderBy: { date: 'desc' },
      take: 50,
    })

    const expenseDetails = expenses.map(exp => {
      const mySplit = exp.splits.find(s => s.userId === user.id)
      const friendSplit = exp.splits.find(s => s.userId === friendId)
      const hasPayments = exp.splits.some(s => (s.paidAmount || 0) > 0.005)
      let friendPaid = 0
      let iPaid = 0
      if (hasPayments) {
        iPaid = Number(mySplit?.paidAmount || 0)
        friendPaid = Number(friendSplit?.paidAmount || 0)
      } else {
        iPaid = exp.createdBy === user.id ? Number(exp.amount) : 0
        friendPaid = exp.createdBy === friendId ? Number(exp.amount) : 0
      }
      let yourShare = Number(mySplit?.amount || 0)
      let friendShare = Number(friendSplit?.amount || 0)
      let netForThisExpense = 0
      if (hasPayments) {
        const myNet = yourShare - iPaid
        netForThisExpense = -myNet
      } else {
        if (iPaid > 0 && friendPaid <= 0) {
          netForThisExpense = friendShare
        } else if (friendPaid > 0 && iPaid <= 0) {
          netForThisExpense = -yourShare
        }
      }

      return {
        id: exp.id,
        description: exp.description,
        amount: Number(exp.amount),
        category: exp.category,
        date: exp.date,
        splitType: exp.splitType,
        groupName: exp.group?.name || null,
        groupEmoji: exp.group?.emoji || null,
        paidBy: { name: exp.paidBy?.name || 'Unknown', id: exp.paidBy?.id },
        yourShare,
        friendShare,
        iPaid,
        friendPaid,
        net: Math.round(netForThisExpense * 100) / 100,
      }
    })

    // Find settlements between us
    const settlements = await db.settlement.findMany({
      where: {
        OR: [
          { fromUserId: user.id, toUserId: friendId, status: 'completed' },
          { fromUserId: friendId, toUserId: user.id, status: 'completed' },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    })

    return NextResponse.json({
      expenses: expenseDetails,
      settlements: settlements.map(s => ({
        id: s.id,
        fromUserId: s.fromUserId,
        toUserId: s.toUserId,
        amount: Number(s.amount),
        note: s.note,
        createdAt: s.createdAt,
      })),
    })
  } catch (error) {
    console.error('Error fetching friend expenses:', error)
    return NextResponse.json({ error: 'Failed to load details. Please refresh.' }, { status: 500 })
  }
}
