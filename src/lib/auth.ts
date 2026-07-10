import { cookies } from 'next/headers'
import { db } from './db'
import bcrypt from 'bcryptjs'

const COOKIE_NAME = 'apimon_session'

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export async function createSession(userId: string) {
  const token = Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2)
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7) // 7 days

  const session = await db.session.create({
    data: {
      userId,
      sessionToken: token,
      expiresAt,
    },
  })

  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    expires: expiresAt,
    path: '/',
  })

  return session
}

export async function getSession() {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(COOKIE_NAME)?.value
    if (!token) return null

    const session = await db.session.findUnique({
      where: { sessionToken: token },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            image: true,
            createdAt: true,
          },
        },
      },
    })

    if (!session) return null

    if (session.expiresAt < new Date()) {
      await db.session.delete({ where: { id: session.id } }).catch(() => {})
      cookieStore.delete(COOKIE_NAME)
      return null
    }

    return session
  } catch (error) {
    console.error('Error getting session:', error)
    return null
  }
}

export async function deleteSession() {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(COOKIE_NAME)?.value
    if (token) {
      await db.session.deleteMany({
        where: { sessionToken: token },
      }).catch(() => {})
    }
    cookieStore.delete(COOKIE_NAME)
  } catch (error) {
    console.error('Error deleting session:', error)
  }
}

export async function getCurrentUser() {
  const session = await getSession()
  return session?.user ?? null
}
