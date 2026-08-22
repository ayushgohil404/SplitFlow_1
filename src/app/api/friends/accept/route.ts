import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth-utils'
import { db } from '@/lib/db'

// POST /api/friends/accept — Accept or decline friend request
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { friendshipId, action } = body as { friendshipId: string; action: 'accept' | 'decline' }

    if (!friendshipId || !action) {
      return NextResponse.json({ error: 'friendshipId and action are required' }, { status: 400 })
    }

    const friendship = await db.friendship.findUnique({
      where: { id: friendshipId },
      include: {
        requester: { select: { id: true, name: true, email: true } },
        addressee: { select: { id: true, name: true, email: true } },
      },
    })

    if (!friendship) {
      return NextResponse.json({ error: 'Friend request not found' }, { status: 404 })
    }

    // Only the addressee can accept/decline
    if (friendship.addresseeId !== user.id) {
      return NextResponse.json({ error: 'Not authorized to respond to this request' }, { status: 403 })
    }

    if (friendship.status !== 'pending') {
      return NextResponse.json({ error: `Request already ${friendship.status}` }, { status: 400 })
    }

    if (action === 'decline') {
      await db.friendship.delete({ where: { id: friendshipId } })
      return NextResponse.json({ message: 'Friend request declined' })
    }

    // Accept
    const updated = await db.friendship.update({
      where: { id: friendshipId },
      data: { status: 'accepted' },
      include: {
        requester: { select: { id: true, name: true, email: true, image: true } },
        addressee: { select: { id: true, name: true, email: true, image: true } },
      },
    })

    // Create activity for both users
    await db.activity.createMany({
      data: [
        {
          userId: user.id,
          type: 'friend_accepted',
          message: `${user.name ?? 'You'} and ${friendship.requester.name ?? friendship.requester.email} are now friends`,
        },
        {
          userId: friendship.requesterId,
          type: 'friend_accepted',
          message: `${friendship.requester.name ?? 'Someone'} and ${user.name ?? 'you'} are now friends`,
        },
      ],
    })

    // Link any non-user splits: if this friend had expenses where this email was used as non-user
    await db.nonUserSplit.updateMany({
      where: {
        email: friendship.requester.email?.toLowerCase(),
        linkedUserId: null,
      },
      data: { linkedUserId: friendship.requesterId },
    })

    return NextResponse.json({
      message: 'Friend request accepted!',
      friendship: updated,
    })
  } catch (error) {
    console.error('Error accepting friend request:', error)
    return NextResponse.json({ error: 'Failed to respond to friend request. Please try again.' }, { status: 500 })
  }
}
