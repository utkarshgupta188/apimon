import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { hashPassword } from '@/lib/auth'
import { z } from 'zod'

const addMemberSchema = z.object({
  projectId: z.string().uuid(),
  email: z.string().email(),
  role: z.enum(['ADMIN', 'MEMBER']).default('MEMBER'),
})

const updateMemberSchema = z.object({
  projectId: z.string().uuid(),
  memberId: z.string().uuid(),
  role: z.enum(['ADMIN', 'MEMBER', 'OWNER']),
})

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const projectId = request.nextUrl.searchParams.get('projectId')
    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 })
    }

    const userId = session.userId

    // Verify requesting user is a member of the project
    const project = await db.project.findUnique({
      where: { id: projectId },
      include: {
        teams: {
          include: {
            members: {
              include: {
                user: {
                  select: { id: true, name: true, email: true, image: true },
                },
              },
            },
          },
        },
      },
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const isMember = project.teams[0]?.members.some((m) => m.userId === userId)
    if (!isMember && project.ownerId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const members = project.teams[0]?.members || []
    return NextResponse.json({ members })
  } catch (error) {
    console.error('Failed to get team members:', error)
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
    const result = addMemberSchema.safeParse(body)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.errors[0].message },
        { status: 400 }
      )
    }

    const { projectId, email, role } = result.data
    const userId = session.userId

    // Find project and verify permissions (must be Owner or Admin)
    const project = await db.project.findUnique({
      where: { id: projectId },
      include: {
        teams: true,
      },
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const isOwner = project.ownerId === userId

    // Check member role in project team
    const teamId = project.teams[0]?.id
    if (!teamId) {
      return NextResponse.json({ error: 'Team not configured for this project' }, { status: 500 })
    }

    const requesterMember = await db.member.findUnique({
      where: {
        teamId_userId: { teamId, userId },
      },
    })

    const hasPermission = isOwner || requesterMember?.role === 'OWNER' || requesterMember?.role === 'ADMIN'
    if (!hasPermission) {
      return NextResponse.json({ error: 'Forbidden. Owner or Admin role required.' }, { status: 403 })
    }

    // Find invited user by email or auto-create mock user for demonstration
    let targetUser = await db.user.findUnique({
      where: { email: email.toLowerCase() },
    })

    if (!targetUser) {
      // Auto-create invited user with default password (for seamless demo testing)
      const mockPass = await hashPassword('password123')
      targetUser = await db.user.create({
        data: {
          email: email.toLowerCase(),
          passwordHash: mockPass,
          name: email.split('@')[0],
        },
      })
    }

    // Check if user is already in the team
    const existingMember = await db.member.findUnique({
      where: {
        teamId_userId: { teamId, userId: targetUser.id },
      },
    })

    if (existingMember) {
      return NextResponse.json({ error: 'User is already a member of this team' }, { status: 409 })
    }

    // Add user to team
    const member = await db.member.create({
      data: {
        teamId,
        userId: targetUser.id,
        role,
      },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    })

    // Log activity
    await db.activityLog.create({
      data: {
        userId,
        projectId,
        action: 'MEMBER_ADD',
        details: `Invited user '${email}' to the team as ${role}`,
      },
    }).catch(() => {})

    return NextResponse.json({ success: true, member })
  } catch (error) {
    console.error('Failed to add team member:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const result = updateMemberSchema.safeParse(body)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.errors[0].message },
        { status: 400 }
      )
    }

    const { projectId, memberId, role } = result.data
    const userId = session.userId

    const project = await db.project.findUnique({
      where: { id: projectId },
      include: { teams: true },
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const teamId = project.teams[0]?.id
    if (!teamId) {
      return NextResponse.json({ error: 'Team not configured' }, { status: 500 })
    }

    // Verify requester has permissions (must be Owner or Admin)
    const isOwner = project.ownerId === userId
    const requesterMember = await db.member.findUnique({
      where: { teamId_userId: { teamId, userId } },
    })

    const hasPermission = isOwner || requesterMember?.role === 'OWNER' || requesterMember?.role === 'ADMIN'
    if (!hasPermission) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Find member to update
    const memberToUpdate = await db.member.findUnique({
      where: { id: memberId },
    })

    if (!memberToUpdate) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }

    // Prevent changing owner's role if it's the main owner
    if (memberToUpdate.userId === project.ownerId && role !== 'OWNER') {
      return NextResponse.json({ error: 'Cannot change project owner\'s role' }, { status: 400 })
    }

    const updatedMember = await db.member.update({
      where: { id: memberId },
      data: { role },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    })

    return NextResponse.json({ success: true, member: updatedMember })
  } catch (error) {
    console.error('Failed to update member role:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const projectId = request.nextUrl.searchParams.get('projectId')
    const memberId = request.nextUrl.searchParams.get('memberId')

    if (!projectId || !memberId) {
      return NextResponse.json({ error: 'Project ID and Member ID are required' }, { status: 400 })
    }

    const userId = session.userId
    const project = await db.project.findUnique({
      where: { id: projectId },
      include: { teams: true },
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const teamId = project.teams[0]?.id
    if (!teamId) {
      return NextResponse.json({ error: 'Team not configured' }, { status: 500 })
    }

    const memberToDelete = await db.member.findUnique({
      where: { id: memberId },
    })

    if (!memberToDelete) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }

    // Prevent removing project owner
    if (memberToDelete.userId === project.ownerId) {
      return NextResponse.json({ error: 'Cannot remove project owner from team' }, { status: 400 })
    }

    // Verify requester has permissions (must be Owner, Admin, or removing themselves)
    const isOwner = project.ownerId === userId
    const requesterMember = await db.member.findUnique({
      where: { teamId_userId: { teamId, userId } },
    })

    const isSelfRemove = memberToDelete.userId === userId
    const hasPermission = isOwner || requesterMember?.role === 'OWNER' || requesterMember?.role === 'ADMIN' || isSelfRemove

    if (!hasPermission) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await db.member.delete({
      where: { id: memberId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to remove team member:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
