import { PrismaClient } from '@prisma/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'
import { createClient } from '@libsql/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient() {
  const dbUrl = process.env.DATABASE_URL!
  const authToken = process.env.DATABASE_AUTH_TOKEN

  // If DATABASE_AUTH_TOKEN is set, use Turso cloud (libsql)
  // Otherwise fall back to local SQLite file
  if (authToken) {
    const libsql = createClient({
      url: dbUrl,
      authToken: authToken,
    })
    const adapter = new PrismaLibSql(libsql)
    return new PrismaClient({ adapter })
  }

  // Local development fallback
  return new PrismaClient({
    log: ['query'],
  })
}

export const db = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
