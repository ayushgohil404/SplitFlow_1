import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth-utils'
import { db } from '@/lib/db'

// POST /api/invites/accept — Accept or decline an invite
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { code, action } = body as { code: string; action: 'accept' | 'decline' }

    if (!code || !action) {
      return NextResponse.json({ error: 'code and action are required' }, { status: 400 })
    }

    // Find the invite
    const invite = await db.invite.findUnique({
      where: { code },
      include: {
        group: { include: { creator: { select: { name: true } } } },
        inviter: { select: { name: true } },
      },
    })

    if (!invite) {
      return NextResponse.json({ error: 'Invite not found' }, { status: 404 })
    }

    if (invite.status !== 'pending') {
      return NextResponse.json({ error: `Invite already ${invite.status}` }, { status: 400 })
    }

    if (new Date() > invite.expiresAt) {
      await db.invite.update({ where: { id: invite.id }, data: { status: 'expired' } })
      return NextResponse.json({ error: 'Invite has expired' }, { status: 400 })
    }

    if (action === 'decline') {
      await db.invite.update({ where: { id: invite.id }, data: { status: 'declined' } })
      return NextResponse.json({ message: 'Invite declined' })
    }

    // Accept: add user to group
    // Check if already a member
    const alreadyMember = await db.groupMember.findUnique({
      where: { groupId_userId: { groupId: invite.groupId, userId: user.id } },
    })

    if (!alreadyMember) {
      await db.groupMember.create({
        data: {
          groupId: invite.groupId,
          userId: user.id,
          role: invite.role,
        },
      })

      // Log activity
      await db.activity.create({
        data: {
          userId: user.id,
          groupId: invite.groupId,
          type: 'member_joined',
          message: `${user.name || 'Someone'} joined the group via invite`,
        },
      })
    }

    // Update invite
    await db.invite.update({
      where: { id: invite.id },
      data: {
        status: 'accepted',
        inviteeId: user.id,
      },
    })

    return NextResponse.json({
      message: 'Invite accepted!',
      group: {
        id: invite.group.id,
        name: invite.group.name,
        emoji: invite.group.emoji,
      },
    })
  } catch (error) {
    console.error('Error accepting invite:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// GET /api/invites/accept?code=xxx — Get invite details (for the invite page)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const code = searchParams.get('code')

    if (!code) {
      return NextResponse.json({ error: 'code is required' }, { status: 400 })
    }

    const invite = await db.invite.findUnique({
      where: { code },
      include: {
        group: { include: { _count: { select: { members: true } } } },
        inviter: { select: { name: true, image: true } },
      },
    })

    if (!invite) {
      return NextResponse.json({ error: 'Invite not found' }, { status: 404 })
    }

    const isExpired = new Date() > invite.expiresAt
    const isAccepted = invite.status !== 'pending'

    return NextResponse.json({
      id: invite.id,
      code: invite.code,
      status: invite.status,
      isExpired,
      isAccepted,
      expiresAt: invite.expiresAt,
      group: {
        id: invite.group.id,
        name: invite.group.name,
        emoji: invite.group.emoji,
        description: invite.group.description,
        memberCount: invite.group._count?.members || 0,
      },
      inviter: {
        name: invite.inviter.name,
        image: invite.inviter.image,
      },
      inviteeEmail: invite.inviteeEmail,
    })
  } catch (error) {
    console.error('Error fetching invite:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
