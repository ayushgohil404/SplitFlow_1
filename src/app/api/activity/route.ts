import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth-utils'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = new URL(req.url).searchParams
    const groupId = searchParams.get('groupId')
    const limit = parseInt(searchParams.get('limit') ?? '50', 10)

    // Get user's group IDs for group activity feed
    const myGroupIds = (await db.groupMember.findMany({
      where: { userId: user.id },
      select: { groupId: true },
    })).map(m => m.groupId)

    const where: Record<string, unknown> = {
      OR: [
        { userId: user.id },
        ...(myGroupIds.length > 0 ? [{ groupId: { in: myGroupIds } }] : []),
      ],
    }
    if (groupId) {
      where.groupId = groupId
    }

    const activities = await db.activity.findMany({
      where,
      include: {
        user: {
          select: { id: true, name: true, image: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    return NextResponse.json({ activities })
  } catch (error) {
    console.error('Error fetching activities:', error)
    return NextResponse.json({ error: 'Failed to load activity feed. Please refresh.' }, { status: 500 })
  }
}
