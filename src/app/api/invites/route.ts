import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth-utils'
import { db } from '@/lib/db'
import crypto from 'crypto'

// POST /api/invites — Create an invite
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { groupId, email } = body as { groupId: string; email: string }

    if (!groupId || !email?.trim()) {
      return NextResponse.json({ error: 'groupId and email are required' }, { status: 400 })
    }

    // Verify the user is a member of the group
    const membership = await db.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId: user.id } },
    })
    if (!membership) {
      return NextResponse.json({ error: 'Not a member of this group' }, { status: 403 })
    }

    // Check if email user is already a member
    const existingMember = await db.user.findUnique({ where: { email: email.trim().toLowerCase() } })
    if (existingMember) {
      const alreadyInGroup = await db.groupMember.findUnique({
        where: { groupId_userId: { groupId, userId: existingMember.id } },
      })
      if (alreadyInGroup) {
        return NextResponse.json({ error: 'This person is already in the group' }, { status: 400 })
      }
    }

    // Check for existing pending invite
    const existingInvite = await db.invite.findFirst({
      where: {
        groupId,
        inviteeEmail: email.trim().toLowerCase(),
        status: 'pending',
      },
    })
    if (existingInvite) {
      // Return existing invite instead of creating duplicate
      return NextResponse.json({
        id: existingInvite.id,
        code: existingInvite.code,
        inviteLink: `${process.env.NEXTAUTH_URL || ''}/invite/${existingInvite.code}`,
        message: 'Invite already sent',
      })
    }

    // Create invite
    const code = crypto.randomBytes(6).toString('hex').toUpperCase()
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

    const invite = await db.invite.create({
      data: {
        code,
        groupId,
        inviterId: user.id,
        inviteeEmail: email.trim().toLowerCase(),
        inviteeId: existingMember?.id || null,
        expiresAt,
      },
    });

    const baseUrl = process.env.NEXTAUTH_URL || 'https://splitflow-1.vercel.app'

    return NextResponse.json({
      id: invite.id,
      code: invite.code,
      inviteLink: `${baseUrl}/invite/${code}`,
      expiresAt: invite.expiresAt,
    })
  } catch (error) {
    console.error('Error creating invite:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// GET /api/invites?groupId=xxx — List invites for a group
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const groupId = searchParams.get('groupId')

    if (!groupId) {
      return NextResponse.json({ error: 'groupId is required' }, { status: 400 })
    }

    const invites = await db.invite.findMany({
      where: { groupId },
      include: {
        inviter: { select: { id: true, name: true, image: true } },
        invitee: { select: { id: true, name: true, image: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    return NextResponse.json({ invites })
  } catch (error) {
    console.error('Error fetching invites:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
