import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
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
            paidByUser: {
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

    // Compute net balances between all pairs of users
    const balances: { fromUserId: string; toUserId: string; amount: number }[] = []

    for (let i = 0; i < memberIds.length; i++) {
      for (let j = i + 1; j < memberIds.length; j++) {
        const userA = memberIds[i]
        const userB = memberIds[j]

        // A owes B: sum of A's splits in expenses paid by B
        const aOwesBSplits = await db.expenseSplit.findMany({
          where: {
            userId: userA,
            expense: {
              groupId: id,
              createdBy: userB,
            },
          },
        })

        // B owes A: sum of B's splits in expenses paid by A
        const bOwesASplits = await db.expenseSplit.findMany({
          where: {
            userId: userB,
            expense: {
              groupId: id,
              createdBy: userA,
            },
          },
        })

        const aOwesB = aOwesBSplits.reduce((sum, s) => sum + Number(s.amount), 0)
        const bOwesA = bOwesASplits.reduce((sum, s) => sum + Number(s.amount), 0)

        // Subtract settlements
        const settlementsAB = await db.settlement.findMany({
          where: {
            groupId: id,
            fromUserId: userA,
            toUserId: userB,
            status: 'completed',
          },
        })
        const settlementsBA = await db.settlement.findMany({
          where: {
            groupId: id,
            fromUserId: userB,
            toUserId: userA,
            status: 'completed',
          },
        })

        const settledAB = settlementsAB.reduce((sum, s) => sum + Number(s.amount), 0)
        const settledBA = settlementsBA.reduce((sum, s) => sum + Number(s.amount), 0)

        const netAmount = aOwesB - bOwesA - settledAB + settledBA

        if (Math.abs(netAmount) > 0.005) {
          if (netAmount > 0) {
            balances.push({ fromUserId: userA, toUserId: userB, amount: Math.round(netAmount * 100) / 100 })
          } else {
            balances.push({ fromUserId: userB, toUserId: userA, amount: Math.round(-netAmount * 100) / 100 })
          }
        }
      }
    }

    return NextResponse.json({ group, balances })
  } catch (error) {
    console.error('Error fetching group:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const membership = await db.groupMember.findUnique({
      where: {
        groupId_userId: { groupId: id, userId: session.user.id },
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
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const membership = await db.groupMember.findUnique({
      where: {
        groupId_userId: { groupId: id, userId: session.user.id },
      },
    })

    if (!membership || membership.role !== 'admin') {
      return NextResponse.json({ error: 'Only admins can delete the group' }, { status: 403 })
    }

    await db.group.delete({ where: { id } })

    return NextResponse.json({ message: 'Group deleted' })
  } catch (error) {
    console.error('Error deleting group:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
