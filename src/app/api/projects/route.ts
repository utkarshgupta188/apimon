import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { z } from 'zod'

const projectCreateSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  description: z.string().optional(),
  environment: z.enum(['PRODUCTION', 'STAGING', 'DEVELOPMENT']).default('DEVELOPMENT'),
  baseUrl: z.string().url('Must be a valid URL').optional().or(z.literal('')),
})

const projectUpdateSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').optional(),
  description: z.string().optional(),
  environment: z.enum(['PRODUCTION', 'STAGING', 'DEVELOPMENT']).optional(),
  baseUrl: z.string().url('Must be a valid URL').optional().or(z.literal('')),
})

export async function GET() {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.userId

    // Find all projects owned by the user or where the user is a team member
    const projects = await db.project.findMany({
      where: {
        OR: [
          { ownerId: userId },
          {
            teams: {
              some: {
                members: {
                  some: { userId },
                },
              },
            },
          },
        ],
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ projects })
  } catch (error) {
    console.error('Failed to get projects:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const result = projectCreateSchema.safeParse(body)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0].message },
        { status: 400 }
      )
    }

    const { name, description, environment, baseUrl } = result.data
    const userId = session.userId

    // Create the project, its default team, and owner membership in a transaction
    const project = await db.$transaction(async (tx) => {
      const p = await tx.project.create({
        data: {
          name,
          description,
          environment,
          baseUrl: baseUrl || null,
          ownerId: userId,
        },
      })

      const team = await tx.team.create({
        data: {
          projectId: p.id,
          name: `${name} Default Team`,
        },
      })

      await tx.member.create({
        data: {
          teamId: team.id,
          userId,
          role: 'OWNER',
        },
      })

      return p
    })

    // Log action
    await db.activityLog.create({
      data: {
        userId,
        projectId: project.id,
        action: 'PROJECT_CREATE',
        details: `Project '${name}' created`,
      },
    }).catch(() => {})

    return NextResponse.json({ success: true, project })
  } catch (error) {
    console.error('Failed to create project:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const id = request.nextUrl.searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 })
    }

    // Check user membership role (must be OWNER or ADMIN)
    const userId = session.userId
    const project = await db.project.findUnique({
      where: { id },
      include: {
        teams: {
          include: {
            members: {
              where: { userId },
            },
          },
        },
      },
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const isOwner = project.ownerId === userId
    const memberRole = project.teams[0]?.members[0]?.role
    const hasPermission = isOwner || memberRole === 'OWNER' || memberRole === 'ADMIN'

    if (!hasPermission) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const result = projectUpdateSchema.safeParse(body)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0].message },
        { status: 400 }
      )
    }

    const { name, description, environment, baseUrl } = result.data

    const updatedProject = await db.project.update({
      where: { id },
      data: {
        name,
        description,
        environment,
        baseUrl: baseUrl === '' ? null : baseUrl,
      },
    })

    // Log action
    await db.activityLog.create({
      data: {
        userId,
        projectId: id,
        action: 'SETTINGS_CHANGE',
        details: `Project settings updated`,
      },
    }).catch(() => {})

    return NextResponse.json({ success: true, project: updatedProject })
  } catch (error) {
    console.error('Failed to update project:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const id = request.nextUrl.searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 })
    }

    const userId = session.userId
    const project = await db.project.findUnique({
      where: { id },
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Only owner can delete project
    if (project.ownerId !== userId) {
      return NextResponse.json({ error: 'Only project owner can delete project' }, { status: 403 })
    }

    await db.project.delete({
      where: { id },
    })

    // Log action
    await db.activityLog.create({
      data: {
        userId,
        action: 'SETTINGS_CHANGE',
        details: `Project '${project.name}' deleted`,
      },
    }).catch(() => {})

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete project:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
