import { NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth-utils'
import { db } from '@/lib/db'

// One-time reset endpoint — only works for authenticated users
export async function POST() {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const tables = [
      'ExpenseSplit',
      'NonUserExpenseSplit',
      'Settlement',
      'Expense',
      'Activity',
      'GroupMember',
      'Group',
      'Invite',
      'Friendship',
    ] as const

    for (const table of tables) {
      try {
        await db.$executeRawUnsafe(`DELETE FROM "${table}"`)
      } catch (e: any) {
        console.log(`Skip ${table}: ${e.message}`)
      }
    }

    // Delete all users (except self to keep session alive, then delete too)
    try {
      await db.$executeRawUnsafe(`DELETE FROM "User"`)
    } catch (e: any) {
      console.log(`Skip User: ${e.message}`)
    }

    return NextResponse.json({ success: true, message: 'All data cleared. Sign out and sign in fresh.' })
  } catch (error: any) {
    console.error('DB reset error:', error)
    return NextResponse.json({ error: error.message || 'Reset failed' }, { status: 500 })
  }
}
