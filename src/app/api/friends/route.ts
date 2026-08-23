import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth-utils'
import { db } from '@/lib/db'


export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const accepted = await db.friendship.findMany({
      where: {
        OR: [
          { requesterId: user.id, status: 'accepted' },
          { addresseeId: user.id, status: 'accepted' },
        ],
      },
      include: {
        requester: { select: { id: true, name: true, email: true, image: true } },
        addressee: { select: { id: true, name: true, email: true, image: true } },
      },
    })

    const friends = accepted.map((f) => {
      const isRequester = f.requesterId === user.id
      const friend = isRequester ? f.addressee : f.requester
      return {
        id: friend.id,
        name: friend.name,
        email: friend.email,
        image: friend.image,
        friendshipId: f.id,
        friendsSince: f.updatedAt,
      }
    })

    const pendingReceived = await db.friendship.findMany({
      where: {
        addresseeId: user.id,
        status: 'pending',
      },
      include: {
        requester: { select: { id: true, name: true, email: true, image: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    const pendingSent = await db.friendship.findMany({
      where: {
        requesterId: user.id,
        status: 'pending',
      },
      include: {
        addressee: { select: { id: true, name: true, email: true, image: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({
      friends,
      pendingReceived: pendingReceived.map((f) => ({
        id: f.id,
        user: f.requester,
        createdAt: f.createdAt,
      })),
      pendingSent: pendingSent.map((f) => ({
        id: f.id,
        user: f.addressee,
        createdAt: f.createdAt,
      })),
    })
  } catch (error) {
    console.error('Error fetching friends:', error)
    return NextResponse.json({ error: 'Failed to load friends. Please refresh.' }, { status: 500 })
  }
}


export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { email, userId: targetUserId } = body as { email?: string; userId?: string }

    let targetUser: { id: string; name: string | null; email: string } | null = null

    if (targetUserId) {
      targetUser = await db.user.findUnique({ where: { id: targetUserId } })
      if (!targetUser) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
      }
    } else if (email?.trim()) {
      targetUser = await db.user.findUnique({ where: { email: email.trim().toLowerCase() } })
      if (!targetUser) {
        return NextResponse.json({
          error: 'No account found with this email. You can still add expenses using their email — they will see the expense when they sign up.',
          code: 'USER_NOT_FOUND',
        }, { status: 404 })
      }
    } else {
      return NextResponse.json({ error: 'email or userId is required' }, { status: 400 })
    }

    if (targetUser.id === user.id) {
      return NextResponse.json({ error: 'You cannot add yourself as a friend' }, { status: 400 })
    }

    const existing = await db.friendship.findFirst({
      where: {
        OR: [
          { requesterId: user.id, addresseeId: targetUser.id },
          { requesterId: targetUser.id, addresseeId: user.id },
        ],
        status: { not: 'declined' },
      },
    })

    if (existing) {
      if (existing.status === 'accepted') {
        return NextResponse.json({ error: 'Already friends' }, { status: 409 })
      }
      if (existing.status === 'pending') {
        if (existing.requesterId === user.id) {
          return NextResponse.json({ error: 'Friend request already sent' }, { status: 409 })
        } else {
          await db.friendship.update({
            where: { id: existing.id },
            data: { status: 'accepted' },
          })
          return NextResponse.json({
            message: 'Friend request accepted! You are now friends.',
            friendship: existing,
          })
        }
      }
    }

    const friendship = await db.friendship.create({
      data: {
        requesterId: user.id,
        addresseeId: targetUser.id,
        status: 'pending',
      },
      include: {
        addressee: { select: { id: true, name: true, email: true, image: true } },
      },
    })

    await db.activity.create({
      data: {
        userId: user.id,
        type: 'friend_request_sent',
        message: `${user.name ?? 'Someone'} sent a friend request to ${targetUser.name ?? targetUser.email}`,
      },
    })

    return NextResponse.json({
      message: 'Friend request sent!',
      friendship,
    }, { status: 201 })
  } catch (error) {
    console.error('Error sending friend request:', error)
    return NextResponse.json({ error: 'Failed to send friend request. Please try again.' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const friendshipId = searchParams.get('id')

    if (!friendshipId) {
      return NextResponse.json({ error: 'friendship id is required' }, { status: 400 })
    }

    const friendship = await db.friendship.findUnique({ where: { id: friendshipId } })
    if (!friendship) {
      return NextResponse.json({ error: 'Friendship not found' }, { status: 404 })
    }

    if (friendship.requesterId !== user.id && friendship.addresseeId !== user.id) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    await db.friendship.delete({ where: { id: friendshipId } })

    return NextResponse.json({ message: 'Friend removed' })
  } catch (error) {
    console.error('Error removing friend:', error)
    return NextResponse.json({ error: 'Failed to remove friend. Please try again.' }, { status: 500 })
  }
}
