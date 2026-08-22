import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth-utils'
import { db } from '@/lib/db'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const expense = await db.expense.findUnique({
      where: { id },
      include: {
        splits: {
          include: {
            user: {
              select: { id: true, name: true, image: true },
            },
          },
        },
        paidBy: {
          select: { id: true, name: true, image: true },
        },
        group: {
          select: { id: true, name: true, emoji: true, currency: true },
        },
      },
    })

    if (!expense) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 })
    }

    return NextResponse.json({ expense })
  } catch (error) {
    console.error('Error fetching expense:', error)
    return NextResponse.json({ error: 'Failed to load expense details. Please refresh.' }, { status: 500 })
  }
}

export async function PATCH(
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
    const {
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
      description?: string
      amount?: number
      category?: string
      splitType?: 'equal' | 'exact' | 'percentage'
      splits?: { userId: string; amount?: number; percentage?: number; share?: number }[]
      note?: string
      date?: string
      isRecurring?: boolean
      recurringFrequency?: string
    }

    const existing = await db.expense.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {}
    if (description !== undefined) updateData.description = description.trim()
    if (amount !== undefined) updateData.amount = amount
    if (category !== undefined) updateData.category = category ?? null
    if (splitType !== undefined) updateData.splitType = splitType
    if (note !== undefined) updateData.note = note?.trim() ?? null
    if (date !== undefined) updateData.date = new Date(date)
    if (isRecurring !== undefined) updateData.isRecurring = isRecurring
    if (recurringFrequency !== undefined) updateData.recurringFrequency = recurringFrequency ?? null

    // Handle split updates
    if (splits || splitType === 'equal') {
      const currentSplitType = splitType ?? existing.splitType
      const currentAmount = amount ?? existing.amount

      let finalSplits: { userId: string; amount: number; percentage: number; share: number }[] = []

      if (currentSplitType === 'equal' && (!splits || splits.length === 0)) {
        // Recalculate equal splits among existing splits' users
        const existingSplits = await db.expenseSplit.findMany({
          where: { expenseId: id },
        })
        const splitCount = existingSplits.length || 1
        const perPerson = Math.round((currentAmount / splitCount) * 100) / 100
        const remainder = Math.round(currentAmount * 100) - Math.round(perPerson * 100) * splitCount
        finalSplits = existingSplits.map((s, i) => ({
          userId: s.userId,
          amount: i === 0 ? perPerson + remainder / 100 : perPerson,
          percentage: Math.round((100 / existingSplits.length) * 100) / 100,
          share: 1,
        }))
      } else if (currentSplitType === 'equal' && splits && splits.length > 0) {
        finalSplits = splits.map((s) => ({
          userId: s.userId,
          amount: 0,
          percentage: 0,
          share: s.share ?? 1,
        }))
        const totalShares = finalSplits.reduce((sum, s) => sum + s.share, 0)
        for (const s of finalSplits) {
          s.amount = Math.round((currentAmount * s.share) / totalShares * 100) / 100
          s.percentage = Math.round((s.share / totalShares) * 10000) / 100
        }
      } else if (currentSplitType === 'exact' && splits) {
        const safeAmount = currentAmount || 1
        finalSplits = splits.map((s) => ({
          userId: s.userId,
          amount: s.amount ?? 0,
          percentage: Math.round(((s.amount ?? 0) / safeAmount) * 100 * 100) / 100,
          share: 0,
        }))
      } else if (currentSplitType === 'percentage' && splits) {
        finalSplits = splits.map((s) => ({
          userId: s.userId,
          amount: Math.round(currentAmount * ((s.percentage ?? 0) / 100) * 100) / 100,
          percentage: s.percentage ?? 0,
          share: 0,
        }))
      } else {
        // No split changes needed
        const expense = await db.expense.update({
          where: { id },
          data: updateData,
          include: {
            splits: {
              include: { user: { select: { id: true, name: true, image: true } } },
            },
            paidBy: { select: { id: true, name: true, image: true } },
          },
        })
        return NextResponse.json({ expense })
      }

      // Delete existing splits and recreate
      await db.expenseSplit.deleteMany({ where: { expenseId: id } })

      await db.expenseSplit.createMany({
        data: finalSplits.map((s) => ({
          expenseId: id,
          userId: s.userId,
          amount: s.amount,
          percentage: s.percentage,
          share: s.share,
        })),
      })
    }

    const expense = await db.expense.update({
      where: { id },
      data: updateData,
      include: {
        splits: {
          include: { user: { select: { id: true, name: true, image: true } } },
        },
        paidBy: { select: { id: true, name: true, image: true } },
      },
    })

    return NextResponse.json({ expense })
  } catch (error) {
    console.error('Error updating expense:', error)
    return NextResponse.json({ error: 'Failed to update expense. Please try again.' }, { status: 500 })
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

    const expense = await db.expense.findUnique({ where: { id } })
    if (!expense) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 })
    }

    await db.expense.delete({ where: { id } })

    return NextResponse.json({ message: 'Expense deleted' })
  } catch (error) {
    console.error('Error deleting expense:', error)
    return NextResponse.json({ error: 'Failed to delete expense. Please try again.' }, { status: 500 })
  }
}
