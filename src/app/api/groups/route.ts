import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth-utils';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const memberships = await db.groupMember.findMany({
      where: { userId: user.id },
      include: {
        group: {
          include: {
            _count: { select: { members: true } },
          },
        },
      },
    });

    const groups = await Promise.all(
      memberships.map(async (m) => {
        const totalExpenses = await db.expense.aggregate({
          where: { groupId: m.groupId },
          _sum: { amount: true },
        });
        return {
          ...m.group,
          memberCount: m.group._count.members,
          totalExpenses: totalExpenses._sum.amount ?? 0,
        };
      })
    );

    return NextResponse.json({ groups });
  } catch (error) {
    console.error('Error listing groups:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { name, description, emoji, currency, category } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Group name is required' }, { status: 400 });
    }

    const inviteCode = Math.random().toString(36).substring(2, 10).toUpperCase();

    const group = await db.group.create({
      data: {
        name: name.trim(),
        description: description?.trim() ?? null,
        emoji: emoji ?? null,
        currency: currency ?? 'USD',
        category: category ?? null,
        inviteCode,
        createdBy: user.id,
        members: {
          create: { userId: user.id, role: 'admin' },
        },
        activities: {
          create: {
            userId: user.id,
            type: 'group_created',
            message: `${user.name ?? 'Someone'} created the group`,
          },
        },
      },
    });

    return NextResponse.json({ group }, { status: 201 });
  } catch (error) {
    console.error('Error creating group:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
