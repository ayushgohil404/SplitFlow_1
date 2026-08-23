import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth-utils'
import { db } from '@/lib/db'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await req.json()
    const { email, role } = body as { email: string; role?: string }

    if (!email?.trim()) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    const group = await db.group.findUnique({ where: { id } })
    if (!group) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 })
    }

    const targetUser = await db.user.findUnique({ where: { email: email.trim().toLowerCase() } })
    if (!targetUser) {
      return NextResponse.json(
        { error: 'User with this email not found' },
        { status: 404 }
      )
    }

    const existingMember = await db.groupMember.findUnique({
      where: {
        groupId_userId: { groupId: id, userId: targetUser.id },
      },
    })

    if (existingMember) {
      return NextResponse.json({ error: 'User is already a member' }, { status: 409 })
    }

    const member = await db.groupMember.create({
      data: {
        groupId: id,
        userId: targetUser.id,
        role: role === 'admin' ? 'admin' : 'member',
      },
      include: {
        user: { select: { id: true, name: true, email: true, image: true } },
      },
    })

    await db.activity.create({
      data: {
        userId: user.id,
        groupId: id,
        type: 'member_added',
        message: `${user.name ?? 'Someone'} added ${targetUser.name ?? targetUser.email} to the group`,
      },
    })

    return NextResponse.json({ member }, { status: 201 })
  } catch (error) {
    console.error('Error adding member:', error)
    return NextResponse.json({ error: 'Failed to add member. Please try again.' }, { status: 500 })
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
    const body = await req.json()
    const { userId } = body as { userId: string }

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    const targetMember = await db.groupMember.findUnique({
      where: {
        groupId_userId: { groupId: id, userId },
      },
    })

    if (!targetMember) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }

    if (targetMember.role === 'admin') {
      const adminCount = await db.groupMember.count({
        where: { groupId: id, role: 'admin' },
      })
      if (adminCount <= 1) {
        return NextResponse.json(
          { error: 'Cannot remove the last admin' },
          { status: 403 }
        )
      }
    }

    await db.groupMember.delete({
      where: {
        groupId_userId: { groupId: id, userId },
      },
    })

    const targetUser = await db.user.findUnique({ where: { id: userId } })

    await db.activity.create({
      data: {
        userId: user.id,
        groupId: id,
        type: 'member_removed',
        message: `${user.name ?? 'Someone'} removed ${targetUser?.name ?? 'a member'} from the group`,
      },
    })

    return NextResponse.json({ message: 'Member removed' })
  } catch (error) {
    console.error('Error removing member:', error)
    return NextResponse.json({ error: 'Failed to remove member. Please try again.' }, { status: 500 })
  }
}
