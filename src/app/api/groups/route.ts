import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { Prisma } from '@prisma/client'

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const memberships = await db.groupMember.findMany({
      where: { userId: session.user.id },
      include: {
        group: {
          include: {
            _count: {
              select: { members: true },
            },
          },
        },
      },
    })

    const groups = await Promise.all(
      memberships.map(async (m) => {
        const totalExpenses = await db.expense.aggregate({
          where: { groupId: m.groupId },
          _sum: { amount: true },
        })
        return {
          ...m.group,
          memberCount: m.group._count.members,
          totalExpenses: totalExpenses._sum.amount ?? 0,
        }
      })
    )

    return NextResponse.json({ groups })
  } catch (error) {
    console.error('Error listing groups:', error)
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
    const { name, description, emoji, currency, category } = body as {
      name: string
      description?: string
      emoji?: string
      currency?: string
      category?: string
    }

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Group name is required' }, { status: 400 })
    }

    const inviteCode = Math.random().toString(36).substring(2, 10).toUpperCase()

    const group = await db.group.create({
      data: {
        name: name.trim(),
        description: description?.trim() ?? null,
        emoji: emoji ?? null,
        currency: currency ?? 'USD',
        category: category ?? null,
        inviteCode,
        createdBy: session.user.id,
        members: {
          create: {
            userId: session.user.id,
            role: 'admin',
          },
        },
        activities: {
          create: {
            userId: session.user.id,
            type: 'group_created',
            message: `${session.user.name ?? 'Someone'} created the group`,
          },
        },
      },
    })

    return NextResponse.json({ group }, { status: 201 })
  } catch (error) {
    console.error('Error creating group:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
