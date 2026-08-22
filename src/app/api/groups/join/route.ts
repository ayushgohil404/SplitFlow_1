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
          userId: user.id,
        },
      },
    })

    if (existingMember) {
      return NextResponse.json({ error: 'Already a member of this group' }, { status: 409 })
    }

    await db.groupMember.create({
      data: {
        groupId: group.id,
        userId: user.id,
        role: 'member',
      },
    })

    await db.activity.create({
      data: {
        userId: user.id,
        groupId: group.id,
        type: 'member_joined',
        message: `${user.name ?? 'Someone'} joined the group`,
      },
    })

    return NextResponse.json({ group })
  } catch (error) {
    console.error('Error joining group:', error)
    return NextResponse.json({ error: 'Failed to join group. Please try again.' }, { status: 500 })
  }
}
