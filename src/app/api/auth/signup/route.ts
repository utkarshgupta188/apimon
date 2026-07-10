import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { hashPassword, createSession } from '@/lib/auth'
import { z } from 'zod'

const signupSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  name: z.string().min(2, 'Name must be at least 2 characters').optional(),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const result = signupSchema.safeParse(body)
    
    if (!result.success) {
      return NextResponse.json(
        { error: result.error.errors[0].message },
        { status: 400 }
      )
    }

    const { email, password, name } = result.data

    // Check if user already exists
    const existingUser = await db.user.findUnique({
      where: { email: email.toLowerCase() },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: 'Email already in use' },
        { status: 409 }
      )
    }

    const passwordHash = await hashPassword(password)

    // Create user
    const user = await db.user.create({
      data: {
        email: email.toLowerCase(),
        passwordHash,
        name: name || email.split('@')[0],
      },
    })

    // Log activity
    await db.activityLog.create({
      data: {
        userId: user.id,
        action: 'LOGIN',
        details: 'User registered and logged in',
      },
    }).catch(err => console.error('Failed to write activity log:', err))

    // Create default project for the new user to improve UX
    const defaultProject = await db.project.create({
      data: {
        name: 'My First API Project',
        description: 'Default project created automatically on signup',
        environment: 'DEVELOPMENT',
        ownerId: user.id,
      },
    })

    // Create team for the project
    const defaultTeam = await db.team.create({
      data: {
        projectId: defaultProject.id,
        name: `${user.name || 'User'}'s Team`,
      },
    })

    // Add owner as a member
    await db.member.create({
      data: {
        teamId: defaultTeam.id,
        userId: user.id,
        role: 'OWNER',
      },
    })

    // Log project creation
    await db.activityLog.create({
      data: {
        userId: user.id,
        projectId: defaultProject.id,
        action: 'PROJECT_CREATE',
        details: `Default project '${defaultProject.name}' created`,
      },
    }).catch(err => console.error('Failed to write activity log:', err))

    // Create session
    await createSession(user.id)

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    })
  } catch (error: any) {
    console.error('Signup error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred during registration' },
      { status: 500 }
    )
  }
}
