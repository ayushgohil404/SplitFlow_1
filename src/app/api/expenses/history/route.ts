import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth-utils'
import { db } from '@/lib/db'


export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10) || 50, 100)
    const offset = Math.max(parseInt(searchParams.get('offset') ?? '0', 10) || 0, 0)
    const filter = searchParams.get('filter')
    const search = searchParams.get('search')
    const category = searchParams.get('category')

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

    let expenseIds: Set<string>
    try {
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
      expenseIds = new Set<string>()
      paidExpenses.forEach((e) => expenseIds.add(e.id))
      splitExpenses.forEach((e) => expenseIds.add(e.expenseId))
    } catch (idErr: any) {
      console.error('[History] Failed to fetch expense IDs:', idErr?.message || idErr)
      return NextResponse.json({ expenses: [], total: 0 })
    }

    if (expenseIds.size === 0) {
      return NextResponse.json({ expenses: [], total: 0 })
    }

    const idArray = Array.from(expenseIds)

    let expenses: any[]
    try {
      expenses = await db.expense.findMany({
        where: {
          id: { in: idArray },
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
    } catch (expErr: any) {
      console.error('[History] Failed to fetch expenses:', expErr?.message || expErr)
      return NextResponse.json({ expenses: [], total: 0 })
    }

    let total: number
    try {
      total = await db.expense.count({
        where: {
          id: { in: idArray },
          ...where,
        },
      })
    } catch {
      total = expenses.length
    }

    return NextResponse.json({ expenses, total })
  } catch (error) {
    console.error('Error fetching expense history:', error)
    return NextResponse.json({ error: 'Failed to load expenses. Please refresh.' }, { status: 500 })
  }
}
