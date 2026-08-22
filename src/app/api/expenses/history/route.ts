import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth-utils'
import { db } from '@/lib/db'

// GET /api/expenses/history — All expenses for the current user (group + direct)
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const limit = parseInt(searchParams.get('limit') ?? '50', 10)
    const offset = parseInt(searchParams.get('offset') ?? '0', 10)
    const filter = searchParams.get('filter') // 'all' | 'group' | 'direct'
    const search = searchParams.get('search') // search in description
    const category = searchParams.get('category')

    // Build where clause
    const where: any = {}

    if (filter === 'group') {
      where.groupId = { not: null }
    } else if (filter === 'direct') {
      where.groupId = null
    }

    if (search?.trim()) {
      where.description = { contains: search.trim(), mode: 'insensitive' }
    }

    if (category?.trim()) {
      where.category = category.trim()
    }

    // Get all expenses where user is involved:
    // 1. Expenses the user created (paid for)
    // 2. Expenses where user has a split
    const [paidExpenses, splitExpenses] = await Promise.all([
      db.expense.findMany({
        where: { ...where, createdBy: user.id },
        select: { id: true },
      }),
      db.expenseSplit.findMany({
        where: { userId: user.id },
        select: { expenseId: true },
      }),
    ])

    const expenseIds = new Set<string>()
    paidExpenses.forEach((e) => expenseIds.add(e.id))
    splitExpenses.forEach((e) => expenseIds.add(e.expenseId))

    const expenses = await db.expense.findMany({
      where: {
        id: { in: Array.from(expenseIds) },
        ...where,
      },
      include: {
        splits: {
          include: {
            user: {
              select: { id: true, name: true, image: true },
            },
          },
        },
        nonUserSplits: true,
        paidBy: {
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

    const total = await db.expense.count({
      where: {
        id: { in: Array.from(expenseIds) },
        ...where,
      },
    })

    return NextResponse.json({ expenses, total })
  } catch (error) {
    console.error('Error fetching expense history:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
