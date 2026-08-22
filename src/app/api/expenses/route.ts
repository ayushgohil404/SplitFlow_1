import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth-utils'
import { db } from '@/lib/db'
import { Prisma } from '@prisma/client'

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = new URL(req.url).searchParams
    const groupId = searchParams.get('groupId')
    const limit = parseInt(searchParams.get('limit') ?? '50', 10)
    const offset = parseInt(searchParams.get('offset') ?? '0', 10)

    // If groupId is provided, return expenses for that group
    if (groupId) {
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

      const total = await db.expense.count({ where: { groupId } })

      return NextResponse.json({ expenses, total })
    }

    return NextResponse.json({ error: 'groupId is required' }, { status: 400 })
  } catch (error) {
    console.error('Error listing expenses:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser()
    if (!user) {
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
      nonUserSplits: emailSplits,
      note,
      date,
      isRecurring,
      recurringFrequency,
    } = body as {
      groupId?: string
      description: string
      amount: number
      category?: string
      splitType: 'equal' | 'exact' | 'percentage' | 'share'
      splits?: { userId: string; amount?: number; percentage?: number; share?: number }[]
      nonUserSplits?: { email: string; name?: string; amount?: number; percentage?: number; share?: number }[]
      note?: string
      date?: string
      isRecurring?: boolean
      recurringFrequency?: string
    }

    if (!description?.trim() || !amount || amount <= 0 || !splitType) {
      return NextResponse.json(
        { error: 'description, amount, and splitType are required' },
        { status: 400 }
      )
    }

    // If groupId provided, verify membership
    if (groupId) {
      const membership = await db.groupMember.findUnique({
        where: {
          groupId_userId: { groupId, userId: user.id },
        },
      })
      if (!membership) {
        return NextResponse.json({ error: 'Not a member of this group' }, { status: 403 })
      }
    }

    // Determine participants
    let userSplits: { userId: string; amount: number; percentage: number; share: number }[] = []
    let finalEmailSplits: { email: string; name: string; amount: number; percentage: number; share: number }[] = []

    // Get group members if in a group
    let groupMembers: { userId: string }[] = []
    if (groupId) {
      groupMembers = await db.groupMember.findMany({
        where: { groupId },
        select: { userId: true },
      })
    }

    // Collect all participant user IDs from splits
    const splitUserIds = splits?.map((s) => s.userId) || []

    // If no groupId and no splits provided, use the user alone (for direct expenses with email participants)
    if (!groupId && splitUserIds.length === 0) {
      // Direct expense with only email participants
      userSplits = [{ userId: user.id, amount: 0, percentage: 0, share: 0 }]
    } else if (splitType === 'equal') {
      if (splits && splits.length > 0) {
        // Include owner in direct splits if not already present
        const allParticipantSplits = !groupId && !splits.some((s) => s.userId === user.id)
          ? [{ userId: user.id, amount: 0, percentage: 0, share: 1 }, ...splits]
          : splits

        userSplits = allParticipantSplits.map((s) => ({
          userId: s.userId,
          amount: s.amount ?? 0,
          percentage: 0,
          share: s.share ?? 1,
        }))
        const totalShares = userSplits.reduce((sum, s) => sum + s.share, 0) || 1
        for (const s of userSplits) {
          s.amount = Math.round((amount * s.share) / totalShares * 100) / 100
          s.percentage = Math.round((s.share / totalShares) * 10000) / 100
        }
      } else if (groupMembers.length > 0) {
        const perPerson = Math.round((amount / groupMembers.length) * 100) / 100
        const remainder = Math.round(amount * 100) - Math.round(perPerson * 100) * groupMembers.length
        userSplits = groupMembers.map((m, i) => ({
          userId: m.userId,
          amount: i === 0 ? perPerson + remainder / 100 : perPerson,
          percentage: Math.round((100 / groupMembers.length) * 100) / 100,
          share: 1,
        }))
      } else {
        // Direct expense, equal split between all user participants
        const allIds = [user.id, ...splitUserIds.filter((id) => id !== user.id)]
        const perPerson = Math.round((amount / allIds.length) * 100) / 100
        const remainder = Math.round(amount * 100) - Math.round(perPerson * 100) * allIds.length
        userSplits = allIds.map((id, i) => ({
          userId: id,
          amount: i === 0 ? perPerson + remainder / 100 : perPerson,
          percentage: Math.round((100 / allIds.length) * 100) / 100,
          share: 1,
        }))
      }
    } else if (splitType === 'exact') {
      // Collect all split amounts (user splits + email splits)
      const emailTotal = emailSplits?.reduce((sum, s) => sum + (s.amount ?? 0), 0) ?? 0
      const userSplitTotal = splits?.reduce((sum, s) => sum + (s.amount ?? 0), 0) ?? 0
      const splitsTotal = userSplitTotal + emailTotal

      if (splitsTotal === 0) {
        return NextResponse.json({ error: 'Split amounts are required for exact split type' }, { status: 400 })
      }
      if (Math.abs(splitsTotal - amount) > 0.5) {
        return NextResponse.json({ error: `Split amounts (₹${splitsTotal.toFixed(2)}) must equal total (₹${amount.toFixed(2)})` }, { status: 400 })
      }

      // Process user splits
      if (splits && splits.length > 0) {
        const safeAmount = amount || 1
        userSplits = splits.map((s) => ({
          userId: s.userId,
          amount: s.amount ?? 0,
          percentage: Math.round(((s.amount ?? 0) / safeAmount) * 100 * 100) / 100,
          share: 0,
        }))
      } else if (!groupId) {
        // Direct expense: user's share = total - email splits
        const myAmount = Math.round((amount - emailTotal) * 100) / 100
        userSplits = [{ userId: user.id, amount: myAmount, percentage: Math.round((myAmount / amount) * 10000) / 100, share: 0 }]
      }

      // Process email splits
      if (emailSplits && emailSplits.length > 0) {
        for (const es of emailSplits) {
          const existingUser = await db.user.findUnique({
            where: { email: es.email.trim().toLowerCase() },
          })
          if (existingUser) {
            userSplits.push({
              userId: existingUser.id,
              amount: es.amount ?? 0,
              percentage: Math.round(((es.amount ?? 0) / (amount || 1)) * 100 * 100) / 100,
              share: 0,
            })
          } else {
            finalEmailSplits.push({
              email: es.email.trim().toLowerCase(),
              name: es.name || es.email.split('@')[0],
              amount: es.amount ?? 0,
              percentage: Math.round(((es.amount ?? 0) / (amount || 1)) * 100 * 100) / 100,
              share: 0,
            })
          }
        }
      }
    } else if (splitType === 'percentage') {
      const emailPctTotal = emailSplits?.reduce((sum, s) => sum + (s.percentage ?? 0), 0) ?? 0
      const userPctTotal = splits?.reduce((sum, s) => sum + (s.percentage ?? 0), 0) ?? 0
      const pctTotal = userPctTotal + emailPctTotal

      if (pctTotal === 0) {
        return NextResponse.json({ error: 'Split percentages are required for percentage split type' }, { status: 400 })
      }
      if (Math.abs(pctTotal - 100) > 1) {
        return NextResponse.json({ error: `Percentages add up to ${pctTotal.toFixed(1)}%, must equal 100%` }, { status: 400 })
      }

      if (splits && splits.length > 0) {
        userSplits = splits.map((s) => ({
          userId: s.userId,
          amount: Math.round(amount * ((s.percentage ?? 0) / 100) * 100) / 100,
          percentage: s.percentage ?? 0,
          share: 0,
        }))
      } else if (!groupId) {
        const myPct = Math.round((100 - emailPctTotal) * 100) / 100
        userSplits = [{ userId: user.id, amount: Math.round(amount * myPct / 100 * 100) / 100, percentage: myPct, share: 0 }]
      }

      if (emailSplits && emailSplits.length > 0) {
        for (const es of emailSplits) {
          const existingUser = await db.user.findUnique({
            where: { email: es.email.trim().toLowerCase() },
          })
          if (existingUser) {
            userSplits.push({
              userId: existingUser.id,
              amount: Math.round(amount * ((es.percentage ?? 0) / 100) * 100) / 100,
              percentage: es.percentage ?? 0,
              share: 0,
            })
          } else {
            finalEmailSplits.push({
              email: es.email.trim().toLowerCase(),
              name: es.name || es.email.split('@')[0],
              amount: Math.round(amount * ((es.percentage ?? 0) / 100) * 100) / 100,
              percentage: es.percentage ?? 0,
              share: 0,
            })
          }
        }
      }
    }

    // Process email splits for equal/share modes (exact/percentage already handled above)
    if (emailSplits && emailSplits.length > 0 && splitType !== 'exact' && splitType !== 'percentage') {
      // Check if any email belongs to a registered user
      for (const es of emailSplits) {
        const existingUser = await db.user.findUnique({
          where: { email: es.email.trim().toLowerCase() },
        })

        if (existingUser) {
          // This email belongs to a registered user — create a regular split instead
          if (splitType === 'equal') {
            const perPerson = Math.round((amount / (userSplits.length + 1)) * 100) / 100
            userSplits.push({
              userId: existingUser.id,
              amount: perPerson,
              percentage: Math.round((100 / (userSplits.length + 1)) * 100) / 100,
              share: 1,
            })
          } else {
            userSplits.push({
              userId: existingUser.id,
              amount: es.amount ?? 0,
              percentage: es.percentage ?? 0,
              share: es.share ?? 1,
            })
          }
        } else {
          // Non-user — create non-user split
          finalEmailSplits.push({
            email: es.email.trim().toLowerCase(),
            name: es.name || es.email.split('@')[0],
            amount: es.amount ?? 0,
            percentage: es.percentage ?? 0,
            share: es.share ?? 1,
          })
        }
      }

      // Recalculate splits for all participants (owner + friends + emails)
      if (splitType === 'equal' && emailSplits.length > 0) {
        // Don't filter out zero-amount splits — recalculate for all participants

        // Check if using share-based splitting (any share != 1 or shares differ from count)
        const hasCustomShares = emailSplits.some((es) => (es.share ?? 1) !== 1) ||
          userSplits.some((s) => (s.share ?? 1) !== 1)

        if (hasCustomShares) {
          // Share-based proportional recalculation
          const allShares = [
            ...userSplits.map((s) => s.share || 1),
            ...finalEmailSplits.map((s) => s.share || 1),
          ]
          const totalShares = allShares.reduce((sum, sh) => sum + sh, 0)

          userSplits.forEach((s) => {
            s.amount = Math.round((amount * (s.share || 1)) / totalShares * 100) / 100
            s.percentage = Math.round(((s.share || 1) / totalShares) * 10000) / 100
          })
          finalEmailSplits.forEach((s) => {
            s.amount = Math.round((amount * (s.share || 1)) / totalShares * 100) / 100
            s.percentage = Math.round(((s.share || 1) / totalShares) * 10000) / 100
          })
        } else {
          // Standard equal recalculation
          const totalParticipants = userSplits.length + finalEmailSplits.length
          const perPerson = Math.round((amount / totalParticipants) * 100) / 100
          const remainder = Math.round(amount * 100) - Math.round(perPerson * 100) * totalParticipants

          userSplits.forEach((s, i) => {
            s.amount = i === 0 ? perPerson + remainder / 100 : perPerson
            s.percentage = Math.round((100 / totalParticipants) * 100) / 100
            s.share = 1
          })

          finalEmailSplits.forEach((s) => {
            s.amount = perPerson
            s.percentage = Math.round((100 / totalParticipants) * 100) / 100
            s.share = 1
          })
        }
      }
    }

    // Create the expense
    const expense = await db.expense.create({
      data: {
        groupId: groupId || null,
        description: description.trim(),
        amount,
        category: category ?? undefined,
        splitType,
        note: note?.trim() ?? null,
        date: date ? new Date(date) : new Date(),
        isRecurring: isRecurring ?? false,
        recurringFrequency: recurringFrequency ?? null,
        createdBy: user.id,
        splits: {
          create: userSplits.map((s) => ({
            userId: s.userId,
            amount: s.amount,
            percentage: s.percentage,
            share: s.share,
          })),
        },
        nonUserSplits: {
          create: finalEmailSplits.map((s) => ({
            email: s.email,
            name: s.name,
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
        nonUserSplits: true,
        paidBy: {
          select: { id: true, name: true, image: true },
        },
        group: {
          select: { id: true, name: true, emoji: true, currency: true },
        },
      },
    })

    // Log activity
    await db.activity.create({
      data: {
        userId: user.id,
        groupId: groupId || null,
        type: 'expense_created',
        message: `${user.name ?? 'Someone'} added "${description.trim()}" for ₹${amount.toFixed(2)}`,
        metadata: JSON.stringify({ expenseId: expense.id, amount, isDirect: !groupId }),
      },
    })

    return NextResponse.json({ expense }, { status: 201 })
  } catch (error) {
    console.error('Error creating expense:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
