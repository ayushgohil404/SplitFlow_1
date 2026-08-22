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

    const searchParams = new URL(req.url).searchParams
    const groupId = searchParams.get('groupId')
    const limit = parseInt(searchParams.get('limit') ?? '50', 10)
    const offset = parseInt(searchParams.get('offset') ?? '0', 10)

    if (!groupId) {
      return NextResponse.json({ error: 'groupId is required' }, { status: 400 })
    }

    const expenses = await db.expense.findMany({
      where: { groupId },
      include: {
        splits: {
          include: {
            user: {
              select: { id: true, name: true, image: true },
            },
          },
        },
        paidByUser: {
          select: { id: true, name: true, image: true },
        },
        group: {
          select: { id: true, name: true, emoji: true, currency: true },
        },
      },
      orderBy: { date: 'desc' },
      take: limit,
      skip: offset,
    })

    const total = await db.expense.count({ where: { groupId } })

    return NextResponse.json({ expenses, total })
  } catch (error) {
    console.error('Error listing expenses:', error)
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
    const {
      groupId,
      description,
      amount,
      category,
      splitType,
      splits,
      note,
      date,
      isRecurring,
      recurringFrequency,
    } = body as {
      groupId: string
      description: string
      amount: number
      category?: string
      splitType: 'equal' | 'exact' | 'percentage'
      splits?: { userId: string; amount?: number; percentage?: number; share?: number }[]
      note?: string
      date?: string
      isRecurring?: boolean
      recurringFrequency?: string
    }

    if (!groupId || !description?.trim() || !amount || amount <= 0 || !splitType) {
      return NextResponse.json(
        { error: 'groupId, description, amount, and splitType are required' },
        { status: 400 }
      )
    }

    // Verify membership
    const membership = await db.groupMember.findUnique({
      where: {
        groupId_userId: { groupId, userId: session.user.id },
      },
    })
    if (!membership) {
      return NextResponse.json({ error: 'Not a member of this group' }, { status: 403 })
    }

    // Get all group members for auto-splitting
    const groupMembers = await db.groupMember.findMany({
      where: { groupId },
      select: { userId: true },
    })

    let finalSplits: { userId: string; amount: number; percentage: number; share: number }[] = []

    if (splitType === 'equal') {
      if (splits && splits.length > 0) {
        // Use provided splits with share values
        finalSplits = splits.map((s) => ({
          userId: s.userId,
          amount: s.amount ?? 0,
          percentage: 0,
          share: s.share ?? 1,
        }))
        const totalShares = finalSplits.reduce((sum, s) => sum + s.share, 0)
        for (const s of finalSplits) {
          s.amount = Math.round((amount * s.share) / totalShares) * 100 / 100
          s.percentage = Math.round((s.share / totalShares) * 10000) / 100
        }
      } else {
        // Auto-calculate equal splits among all members
        const perPerson = Math.round((amount / groupMembers.length) * 100) / 100
        const remainder = Math.round(amount * 100) - Math.round(perPerson * 100) * groupMembers.length
        finalSplits = groupMembers.map((m, i) => ({
          userId: m.userId,
          amount: i === 0 ? perPerson + remainder / 100 : perPerson,
          percentage: Math.round((100 / groupMembers.length) * 100) / 100,
          share: 1,
        }))
      }
    } else if (splitType === 'exact') {
      if (!splits || splits.length === 0) {
        return NextResponse.json({ error: 'Splits are required for exact split type' }, { status: 400 })
      }
      const splitsTotal = splits.reduce((sum, s) => sum + (s.amount ?? 0), 0)
      if (Math.abs(splitsTotal - amount) > 0.01) {
        return NextResponse.json({ error: 'Split amounts must equal the total expense amount' }, { status: 400 })
      }
      finalSplits = splits.map((s) => ({
        userId: s.userId,
        amount: s.amount!,
        percentage: Math.round(((s.amount! / amount) * 100) * 100) / 100,
        share: 0,
      }))
    } else if (splitType === 'percentage') {
      if (!splits || splits.length === 0) {
        return NextResponse.json({ error: 'Splits are required for percentage split type' }, { status: 400 })
      }
      const pctTotal = splits.reduce((sum, s) => sum + (s.percentage ?? 0), 0)
      if (Math.abs(pctTotal - 100) > 0.01) {
        return NextResponse.json({ error: 'Percentages must add up to 100' }, { status: 400 })
      }
      finalSplits = splits.map((s) => ({
        userId: s.userId,
        amount: Math.round(amount * (s.percentage! / 100) * 100) / 100,
        percentage: s.percentage!,
        share: 0,
      }))
    }

    const expense = await db.expense.create({
      data: {
        groupId,
        description: description.trim(),
        amount,
        category: category ?? null,
        splitType,
        note: note?.trim() ?? null,
        date: date ? new Date(date) : new Date(),
        isRecurring: isRecurring ?? false,
        recurringFrequency: recurringFrequency ?? null,
        createdBy: session.user.id,
        splits: {
          create: finalSplits.map((s) => ({
            userId: s.userId,
            amount: s.amount,
            percentage: s.percentage,
            share: s.share,
          })),
        },
      },
      include: {
        splits: {
          include: {
            user: {
              select: { id: true, name: true, image: true },
            },
          },
        },
        paidByUser: {
          select: { id: true, name: true, image: true },
        },
      },
    })

    await db.activity.create({
      data: {
        userId: session.user.id,
        groupId,
        type: 'expense_created',
        message: `${session.user.name ?? 'Someone'} added "${description.trim()}" for $${amount.toFixed(2)}`,
        metadata: { expenseId: expense.id, amount },
      },
    })

    return NextResponse.json({ expense }, { status: 201 })
  } catch (error) {
    console.error('Error creating expense:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
