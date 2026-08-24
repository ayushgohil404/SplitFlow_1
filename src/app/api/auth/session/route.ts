import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) {
    return Response.json({ user: null }, { status: 200 })
  }
  return Response.json({ session })
}
