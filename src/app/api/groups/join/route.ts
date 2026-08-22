import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { inviteCode } = body as { inviteCode: string }

    if (!inviteCode?.trim()) {
      return NextResponse.json({ error: 'Invite code is required' }, { status: 400 })
    }

    const group = await db.group.findUnique({
      where: { inviteCode: inviteCode.trim().toUpperCase() },
    })

    if (!group) {
      return NextResponse.json({ error: 'Invalid invite code' }, { status: 404 })
    }

    const existingMember = await db.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId: group.id,
          userId: session.user.id,
        },
      },
    })

    if (existingMember) {
      return NextResponse.json({ error: 'Already a member of this group' }, { status: 409 })
    }

    await db.groupMember.create({
      data: {
        groupId: group.id,
        userId: session.user.id,
        role: 'member',
      },
    })

    await db.activity.create({
      data: {
        userId: session.user.id,
        groupId: group.id,
        type: 'member_joined',
        message: `${session.user.name ?? 'Someone'} joined the group`,
      },
    })

    return NextResponse.json({ group })
  } catch (error) {
    console.error('Error joining group:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
