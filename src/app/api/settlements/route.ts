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

    const searchParams = new URL(req.url).searchParams
    const groupId = searchParams.get('groupId')

    if (!groupId) {
      return NextResponse.json({ error: 'groupId is required' }, { status: 400 })
    }

    const settlements = await db.settlement.findMany({
      where: { groupId },
      include: {
        fromUser: {
          select: { id: true, name: true, image: true },
        },
        toUser: {
          select: { id: true, name: true, image: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ settlements })
  } catch (error) {
    console.error('Error listing settlements:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { groupId, fromUserId, toUserId, amount, note } = body as {
      groupId: string
      fromUserId: string
      toUserId: string
      amount: number
      note?: string
    }

    if (!groupId || !fromUserId || !toUserId || !amount || amount <= 0) {
      return NextResponse.json(
        { error: 'groupId, fromUserId, toUserId, and amount are required' },
        { status: 400 }
      )
    }

    if (fromUserId === toUserId) {
      return NextResponse.json({ error: 'fromUserId and toUserId must be different' }, { status: 400 })
    }

    // Verify both users are members
    const fromMember = await db.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId: fromUserId } },
    })
    const toMember = await db.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId: toUserId } },
    })

    if (!fromMember || !toMember) {
      return NextResponse.json({ error: 'Both users must be group members' }, { status: 403 })
    }

    const settlement = await db.settlement.create({
      data: {
        groupId,
        fromUserId,
        toUserId,
        amount,
        note: note?.trim() ?? null,
        status: 'completed',
      },
      include: {
        fromUser: { select: { id: true, name: true, image: true } },
        toUser: { select: { id: true, name: true, image: true } },
      },
    })

    const fromUser = await db.user.findUnique({ where: { id: fromUserId } })
    const toUser = await db.user.findUnique({ where: { id: toUserId } })

    await db.activity.create({
      data: {
        userId: session.user.id,
        groupId,
        type: 'settlement_created',
        message: `${fromUser?.name ?? 'Someone'} paid ${toUser?.name ?? 'someone'} $${amount.toFixed(2)}`,
        metadata: { settlementId: settlement.id, amount, fromUserId, toUserId },
      },
    })

    return NextResponse.json({ settlement }, { status: 201 })
  } catch (error) {
    console.error('Error creating settlement:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
