import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { db } from './lib/db'

const protectedRoutes = [
  '/dashboard',
  '/projects',
  '/analytics',
  '/settings',
  '/alerts',
  '/logs',
]

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Check if it's a protected UI route
  const isProtected = protectedRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  )

  const token = request.cookies.get('apimon_session')?.value

  if (isProtected) {
    if (!token) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    try {
      // Check database session
      const session = await db.session.findUnique({
        where: { sessionToken: token },
      })

      if (!session || session.expiresAt < new Date()) {
        const response = NextResponse.redirect(new URL('/login', request.url))
        response.cookies.delete('apimon_session')
        return response
      }
    } catch (error) {
      console.error('Session validation error in proxy:', error)
      // Fallback in case database is down or offline - allow local development
      if (process.env.NODE_ENV !== 'production' && token === 'mock-session-token') {
        return NextResponse.next()
      }
      return NextResponse.redirect(new URL('/login', request.url))
    }
  }

  // Redirect / to /dashboard if logged in, otherwise let load landing page
  if (pathname === '/') {
    if (token) {
      try {
        const session = await db.session.findUnique({
          where: { sessionToken: token },
        })
        if (session && session.expiresAt > new Date()) {
          return NextResponse.redirect(new URL('/dashboard', request.url))
        }
      } catch (e) {}
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes, handled separately)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',
  ],
}
