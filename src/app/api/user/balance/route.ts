import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth-utils'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = user.id

    // 1. Group-based balances (existing logic)
    const memberships = await db.groupMember.findMany({
      where: { userId },
      include: {
        group: {
          select: { id: true, name: true, emoji: true, currency: true },
        },
      },
    })

    const groupBalances = await Promise.all(
      memberships.map(async (membership) => {
        const group = membership.group
        const groupId = group.id

        const members = await db.groupMember.findMany({
          where: { groupId },
          include: {
            user: {
              select: { id: true, name: true, image: true },
            },
          },
        })

        const balances: {
          userId: string
          userName: string | null
          userImage: string | null
          amount: number
        }[] = []

        for (const m of members) {
          if (m.userId === userId) continue

          const theirSplitsInMyExpenses = await db.expenseSplit.findMany({
            where: {
              userId: m.userId,
              expense: {
                groupId,
                createdBy: userId,
              },
            },
          })

          const mySplitsInTheirExpenses = await db.expenseSplit.findMany({
            where: {
              userId,
              expense: {
                groupId,
                createdBy: m.userId,
              },
            },
          })

          const settlementsFromThem = await db.settlement.findMany({
            where: {
              groupId,
              fromUserId: m.userId,
              toUserId: userId,
              status: 'completed',
            },
          })

          const settlementsFromMe = await db.settlement.findMany({
            where: {
              groupId,
              fromUserId: userId,
              toUserId: m.userId,
              status: 'completed',
            },
          })

          const theyOweMe = theirSplitsInMyExpenses.reduce((s, x) => s + Number(x.amount), 0)
          const iOweThem = mySplitsInTheirExpenses.reduce((s, x) => s + Number(x.amount), 0)
          const theyPaidMe = settlementsFromThem.reduce((s, x) => s + Number(x.amount), 0)
          const iPaidThem = settlementsFromMe.reduce((s, x) => s + Number(x.amount), 0)

          const net = (theyOweMe - theyPaidMe) - (iOweThem - iPaidThem)

          if (Math.abs(net) > 0.005) {
            balances.push({
              userId: m.userId,
              userName: m.user.name,
              userImage: m.user.image,
              amount: Math.round(net * 100) / 100,
            })
          }
        }

        return {
          groupId,
          groupName: group.name,
          groupEmoji: group.emoji,
          currency: group.currency,
          balances,
        }
      })
    )

    // 2. Direct expense balances (no group)
    // Find all direct expenses where user is involved
    const directExpenses = await db.expense.findMany({
      where: {
        groupId: null,
        OR: [
          { createdBy: userId },
          { splits: { some: { userId } } },
        ],
      },
      include: {
        splits: { include: { user: { select: { id: true, name: true, image: true } } } },
        nonUserSplits: true,
      },
    })

    // Build direct balances map: userId -> net amount
    const directBalances: Record<string, { name: string | null; image: string | null; amount: number }> = {}

    for (const exp of directExpenses) {
      const isPayer = exp.createdBy === userId

      // User splits
      for (const split of exp.splits) {
        if (split.userId === userId) continue // skip self

        if (!directBalances[split.userId]) {
          directBalances[split.userId] = { name: split.user.name, image: split.user.image, amount: 0 }
        }

        if (isPayer) {
          // They owe me (I paid, they have a split)
          directBalances[split.userId].amount += Number(split.amount)
        } else {
          // I owe them (they paid... wait, this is wrong)
          // If I didn't pay, then someone else paid and I have a split — I owe the payer
          // This is handled differently: if I have a split in an expense paid by someone else
        }
      }

      // If I have a split in an expense someone else paid, I owe them
      if (!isPayer) {
        const mySplit = exp.splits.find((s) => s.userId === userId)
        if (mySplit) {
          if (!directBalances[exp.createdBy]) {
            // We need the payer's name — fetch it
            const payer = await db.user.findUnique({
              where: { id: exp.createdBy },
              select: { name: true, image: true },
            })
            directBalances[exp.createdBy] = { name: payer?.name || null, image: payer?.image || null, amount: 0 }
          }
          directBalances[exp.createdBy].amount -= Number(mySplit.amount)
        }
      }

      // Non-user email splits (I paid, they owe me)
      for (const nus of exp.nonUserSplits) {
        if (isPayer) {
          const key = `email:${nus.email}`
          if (!directBalances[key]) {
            directBalances[key] = { name: nus.name || nus.email, image: null, amount: 0 }
          }
          directBalances[key].amount += Number(nus.amount)
        }
      }
    }

    // Also include settlements for direct expenses
    const directSettlementsFromMe = await db.settlement.findMany({
      where: { groupId: null, fromUserId: userId, status: 'completed' },
    })
    const directSettlementsToMe = await db.settlement.findMany({
      where: { groupId: null, toUserId: userId, status: 'completed' },
    })

    for (const s of directSettlementsFromMe) {
      const key = s.toUserId
      if (!directBalances[key]) {
        const other = await db.user.findUnique({
          where: { id: s.toUserId },
          select: { name: true, image: true },
        })
        directBalances[key] = { name: other?.name || null, image: other?.image || null, amount: 0 }
      }
      directBalances[key].amount -= Number(s.amount)
    }

    for (const s of directSettlementsToMe) {
      const key = s.fromUserId
      if (!directBalances[key]) {
        const other = await db.user.findUnique({
          where: { id: s.fromUserId },
          select: { name: true, image: true },
        })
        directBalances[key] = { name: other?.name || null, image: other?.image || null, amount: 0 }
      }
      directBalances[key].amount += Number(s.amount)
    }

    // Format direct balances
    const directList = Object.entries(directBalances)
      .filter(([, v]) => Math.abs(v.amount) > 0.005)
      .map(([key, v]) => ({
        userId: key.startsWith('email:') ? key : key,
        userName: v.name,
        userImage: v.image,
        amount: Math.round(v.amount * 100) / 100,
        isEmail: key.startsWith('email:'),
      }))

    return NextResponse.json({
      groups: groupBalances,
      direct: directList,
    })
  } catch (error) {
    console.error('Error fetching user balance:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
