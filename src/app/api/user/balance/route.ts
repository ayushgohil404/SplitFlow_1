import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth-utils'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = user.id

    const memberships = await db.groupMember.findMany({
      where: { userId },
      include: {
        group: {
          select: { id: true, name: true, emoji: true, currency: true },
        },
      },
    })

    const groupBalances = await Promise.all(
      memberships.map(async (membership) => {
        const group = membership.group
        const groupId = group.id

        const members = await db.groupMember.findMany({
          where: { groupId },
          include: {
            user: {
              select: { id: true, name: true, image: true },
            },
          },
        })

        // Get all splits in this group (with paidAmount for multi-payer support)
        const allSplits = await db.expenseSplit.findMany({
          where: { expense: { groupId } },
          select: {
            userId: true,
            amount: true,
            paidAmount: true,
            expenseId: true,
            expense: { select: { createdBy: true, amount: true } },
          },
        })

        // Calculate each member's individual net balance: sum(paidAmount) - sum(amount)
        // For old expenses where paidAmount is all 0, fall back to createdBy paying full amount
        const memberNets: Map<string, number> = new Map()
        for (const m of members) {
          memberNets.set(m.userId, 0)
        }

        // Group splits by expense for backward compatibility check
        const expenseSplitsMap = new Map<string, typeof allSplits>()
        for (const split of allSplits) {
          if (!expenseSplitsMap.has(split.expenseId)) {
            expenseSplitsMap.set(split.expenseId, [])
          }
          expenseSplitsMap.get(split.expenseId)!.push(split)
        }

        for (const [expenseId, splits] of expenseSplitsMap) {
          const hasAnyPayment = splits.some(s => (s.paidAmount || 0) > 0.005)

          if (!hasAnyPayment) {
            // Legacy expense: createdBy paid the full amount
            const createdBy = splits[0].expense.createdBy
            const totalAmount = splits[0].expense.amount
            for (const split of splits) {
              const paidAmt = split.userId === createdBy ? totalAmount : 0
              const net = paidAmt - Number(split.amount)
              const current = memberNets.get(split.userId) ?? 0
              memberNets.set(split.userId, Math.round((current + net) * 100) / 100)
            }
          } else {
            // New expense: use paidAmount from splits
            for (const split of splits) {
              const net = (split.paidAmount || 0) - Number(split.amount)
              const current = memberNets.get(split.userId) ?? 0
              memberNets.set(split.userId, Math.round((current + net) * 100) / 100)
            }
          }
        }

        // Subtract completed settlements
        const settlements = await db.settlement.findMany({
          where: { groupId, status: 'completed' },
          select: { fromUserId: true, toUserId: true, amount: true },
        })
        for (const s of settlements) {
          const fromVal = memberNets.get(s.fromUserId) ?? 0
          memberNets.set(s.fromUserId, Math.round((fromVal - Number(s.amount)) * 100) / 100)
          const toVal = memberNets.get(s.toUserId) ?? 0
          memberNets.set(s.toUserId, Math.round((toVal + Number(s.amount)) * 100) / 100)
        }

        // Simplify debts to get minimal pairwise transactions involving the current user
        const debts: { userId: string; net: number }[] = []
        for (const m of members) {
          const net = memberNets.get(m.userId) ?? 0
          if (Math.abs(net) > 0.005) {
            debts.push({ userId: m.userId, net })
          }
        }

        // Sort: debtors (negative net) descending, creditors (positive net) descending
        const debtors = debts.filter(d => d.net < -0.005).map(d => ({ userId: d.userId, amount: Math.round(-d.net * 100) / 100 })).sort((a, b) => b.amount - a.amount)
        const creditors = debts.filter(d => d.net > 0.005).map(d => ({ userId: d.userId, amount: Math.round(d.net * 100) / 100 })).sort((a, b) => b.amount - a.amount)

        const balances: {
          userId: string
          userName: string | null
          userImage: string | null
          amount: number
        }[] = []

        // Run simplification and extract only transactions involving the current user
        const pairwiseBalances = new Map<string, number>()
        let i = 0, j = 0
        while (i < debtors.length && j < creditors.length) {
          const transfer = Math.min(debtors[i].amount, creditors[j].amount)
          const rounded = Math.round(transfer * 100) / 100
          if (rounded > 0) {
            const debtorId = debtors[i].userId
            const creditorId = creditors[j].userId
            if (debtorId === userId) {
              // User pays creditor
              pairwiseBalances.set(creditorId, (pairwiseBalances.get(creditorId) || 0) - rounded)
            } else if (creditorId === userId) {
              // Debtor pays user
              pairwiseBalances.set(debtorId, (pairwiseBalances.get(debtorId) || 0) + rounded)
            }
          }
          debtors[i].amount = Math.round((debtors[i].amount - transfer) * 100) / 100
          creditors[j].amount = Math.round((creditors[j].amount - transfer) * 100) / 100
          if (debtors[i].amount <= 0.005) i++
          if (creditors[j].amount <= 0.005) j++
        }

        for (const m of members) {
          if (m.userId === userId) continue
          const bal = pairwiseBalances.get(m.userId) ?? 0
          if (Math.abs(bal) > 0.005) {
            balances.push({
              userId: m.userId,
              userName: m.user.name,
              userImage: m.user.image,
              amount: Math.round(bal * 100) / 100,
            })
          }
        }

        return {
          groupId,
          groupName: group.name,
          groupEmoji: group.emoji,
          currency: group.currency,
          balances,
        }
      })
    )

    // Direct expenses (no group)
    const directExpenses = await db.expense.findMany({
      where: {
        groupId: null,
        OR: [
          { createdBy: userId },
          { splits: { some: { userId } } },
        ],
      },
      include: {
        splits: { include: { user: { select: { id: true, name: true, image: true } } } },
        nonUserSplits: true,
      },
    })

    // For direct expenses, calculate balances using paidAmount
    // Get all unique user IDs from direct expenses
    const directUserIds = new Set<string>()
    directUserIds.add(userId)
    for (const exp of directExpenses) {
      for (const split of exp.splits) {
        directUserIds.add(split.userId)
      }
    }

    // Calculate each user's net balance across all direct expenses
    const directNets: Map<string, number> = new Map()
    for (const uid of directUserIds) {
      directNets.set(uid, 0)
    }

    for (const exp of directExpenses) {
      const hasAnyPayment = exp.splits.some(s => (s.paidAmount || 0) > 0.005)

      if (!hasAnyPayment) {
        // Legacy: createdBy paid full amount
        for (const split of exp.splits) {
          const paidAmt = split.userId === exp.createdBy ? exp.amount : 0
          const net = paidAmt - Number(split.amount)
          const current = directNets.get(split.userId) ?? 0
          directNets.set(split.userId, Math.round((current + net) * 100) / 100)
        }
      } else {
        for (const split of exp.splits) {
          const net = (split.paidAmount || 0) - Number(split.amount)
          const current = directNets.get(split.userId) ?? 0
          directNets.set(split.userId, Math.round((current + net) * 100) / 100)
        }
      }
    }

    // Subtract direct settlements
    const directSettlementsFromMe = await db.settlement.findMany({
      where: { groupId: null, fromUserId: userId, status: 'completed' },
    })
    const directSettlementsToMe = await db.settlement.findMany({
      where: { groupId: null, toUserId: userId, status: 'completed' },
    })

    for (const s of directSettlementsFromMe) {
      const val = directNets.get(userId) ?? 0
      directNets.set(userId, Math.round((val - Number(s.amount)) * 100) / 100)
      const otherVal = directNets.get(s.toUserId) ?? 0
      directNets.set(s.toUserId, Math.round((otherVal + Number(s.amount)) * 100) / 100)
    }
    for (const s of directSettlementsToMe) {
      const val = directNets.get(userId) ?? 0
      directNets.set(userId, Math.round((val + Number(s.amount)) * 100) / 100)
      const otherVal = directNets.get(s.fromUserId) ?? 0
      directNets.set(s.fromUserId, Math.round((otherVal - Number(s.amount)) * 100) / 100)
    }

    // Simplify direct debts to get pairwise balances involving user
    const directDebts: { userId: string; net: number }[] = []
    for (const [uid, net] of directNets) {
      if (uid === userId) continue
      if (Math.abs(net) > 0.005) {
        directDebts.push({ userId: uid, net })
      }
    }

    // Include non-user splits (email participants) as debtors
    const emailBalances: Map<string, { name: string; amount: number }> = new Map()
    for (const exp of directExpenses) {
      // Find how much was paid by the user for this expense
      const userPaid = exp.splits.find(s => s.userId === userId)?.paidAmount || 0
      // Total paid by user across this expense
      const totalPaid = exp.splits.reduce((sum, s) => sum + (s.paidAmount || 0), 0)
      const userPaidRatio = totalPaid > 0 ? userPaid / totalPaid : 0

      for (const nus of exp.nonUserSplits) {
        // User's share of what email participant owes
        const userShareOfDebt = Math.round(Number(nus.amount) * userPaidRatio * 100) / 100
        if (userShareOfDebt > 0.005) {
          const key = `email:${nus.email}`
          const existing = emailBalances.get(key)
          emailBalances.set(key, {
            name: nus.name || nus.email,
            amount: Math.round(((existing?.amount || 0) + userShareOfDebt) * 100) / 100,
          })
        }
      }
    }

    // Simplify direct debts
    const directDebtors = directDebts.filter(d => d.net < -0.005).map(d => ({ userId: d.userId, amount: Math.round(-d.net * 100) / 100 })).sort((a, b) => b.amount - a.amount)
    const directCreditors = directDebts.filter(d => d.net > 0.005).map(d => ({ userId: d.userId, amount: Math.round(d.net * 100) / 100 })).sort((a, b) => b.amount - a.amount)

    const directPairwise = new Map<string, number>()
    let di = 0, dj = 0
    while (di < directDebtors.length && dj < directCreditors.length) {
      const transfer = Math.min(directDebtors[di].amount, directCreditors[dj].amount)
      const rounded = Math.round(transfer * 100) / 100
      if (rounded > 0) {
        const debtorId = directDebtors[di].userId
        const creditorId = directCreditors[dj].userId
        if (debtorId === userId) {
          directPairwise.set(creditorId, (directPairwise.get(creditorId) || 0) - rounded)
        } else if (creditorId === userId) {
          directPairwise.set(debtorId, (directPairwise.get(debtorId) || 0) + rounded)
        }
      }
      directDebtors[di].amount = Math.round((directDebtors[di].amount - transfer) * 100) / 100
      directCreditors[dj].amount = Math.round((directCreditors[dj].amount - transfer) * 100) / 100
      if (directDebtors[di].amount <= 0.005) di++
      if (directCreditors[dj].amount <= 0.005) dj++
    }

    const directList: {
      userId: string
      userName: string | null
      userImage: string | null
      amount: number
      isEmail?: boolean
    }[] = []

    // Add user-to-user balances
    for (const [uid, bal] of directPairwise) {
      if (Math.abs(bal) > 0.005) {
        const member = directExpenses
          .flatMap(e => e.splits)
          .find(s => s.userId === uid)?.user
        directList.push({
          userId: uid,
          userName: member?.name || null,
          userImage: member?.image || null,
          amount: Math.round(bal * 100) / 100,
        })
      }
    }

    // Add email participant balances
    for (const [key, val] of emailBalances) {
      if (Math.abs(val.amount) > 0.005) {
        directList.push({
          userId: key,
          userName: val.name,
          userImage: null,
          amount: val.amount,
          isEmail: true,
        })
      }
    }

    return NextResponse.json({
      groups: groupBalances,
      direct: directList,
    })
  } catch (error) {
    console.error('Error fetching user balance:', error)
    return NextResponse.json({ error: 'Failed to load balances. Please refresh.' }, { status: 500 })
  }
}
