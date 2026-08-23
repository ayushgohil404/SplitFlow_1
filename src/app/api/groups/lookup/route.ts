import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/groups/lookup?code=xxx — Look up a group by inviteCode (for invite links)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const code = searchParams.get('code')

    if (!code) {
      return NextResponse.json({ error: 'code is required' }, { status: 400 })
    }

    const group = await db.group.findUnique({
      where: { inviteCode: code },
      include: {
        creator: { select: { name: true, image: true } },
        _count: { select: { members: true } },
      },
    })

    if (!group) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 })
    }

    return NextResponse.json({
      group: {
        id: group.id,
        name: group.name,
        emoji: group.emoji,
        description: group.description,
        memberCount: group._count?.members || 0,
      },
      creatorName: group.creator?.name || 'Someone',
    })
  } catch (error) {
    console.error('Error looking up group:', error)
    return NextResponse.json({ error: 'Failed to look up group' }, { status: 500 })
  }
}