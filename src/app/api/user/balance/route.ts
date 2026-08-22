import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id

    // Get all groups the user is a member of
    const memberships = await db.groupMember.findMany({
      where: { userId },
      include: {
        group: {
          select: { id: true, name: true, emoji: true, currency: true },
        },
      },
    })

    const result = await Promise.all(
      memberships.map(async (membership) => {
        const group = membership.group
        const groupId = group.id

        // Get all members of this group
        const members = await db.groupMember.findMany({
          where: { groupId },
          include: {
            user: {
              select: { id: true, name: true, image: true },
            },
          },
        })

        // Compute net balance for the logged-in user against every other member
        const balances: {
          userId: string
          userName: string | null
          userImage: string | null
          amount: number
        }[] = []

        for (const m of members) {
          if (m.userId === userId) continue

          // Net = (what they owe me) - (what I owe them)
          // What they owe me = their splits in expenses I paid - settlements they sent me + settlements I sent them
          // What I owe them = my splits in expenses they paid - settlements I sent them + settlements they sent me

          // Simpler: compute net from perspective of logged-in user
          // Positive = others owe user, Negative = user owes others

          // Splits of OTHER user in expenses paid BY logged-in user (they owe me)
          const theirSplitsInMyExpenses = await db.expenseSplit.findMany({
            where: {
              userId: m.userId,
              expense: {
                groupId,
                createdBy: userId,
              },
            },
          })

          // Splits of logged-in user in expenses paid BY other user (I owe them)
          const mySplitsInTheirExpenses = await db.expenseSplit.findMany({
            where: {
              userId,
              expense: {
                groupId,
                createdBy: m.userId,
              },
            },
          })

          // Settlements from other user to logged-in user (they paid me)
          const settlementsFromThem = await db.settlement.findMany({
            where: {
              groupId,
              fromUserId: m.userId,
              toUserId: userId,
              status: 'completed',
            },
          })

          // Settlements from logged-in user to other user (I paid them)
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

          // Net: positive means they owe me, negative means I owe them
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

    return NextResponse.json({ groups: result })
  } catch (error) {
    console.error('Error fetching user balance:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
