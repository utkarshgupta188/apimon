import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

let prisma: PrismaClient

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not defined')
}

// Enable SSL if connecting to Supabase pooler or Neon
const isSupabase = connectionString.includes('supabase.com')
const isNeon = connectionString.includes('neon.tech')
const poolConfig: any = { connectionString }

if (isSupabase || isNeon || connectionString.includes('sslmode=')) {
  poolConfig.ssl = { rejectUnauthorized: false }
}

if (process.env.NODE_ENV === 'production') {
  const pool = new Pool(poolConfig)
  const adapter = new PrismaPg(pool)
  prisma = new PrismaClient({ adapter })
} else {
  if (!globalForPrisma.prisma) {
    const pool = new Pool(poolConfig)
    const adapter = new PrismaPg(pool)
    globalForPrisma.prisma = new PrismaClient({ adapter })
  }
  prisma = globalForPrisma.prisma
}

export const db = prisma
