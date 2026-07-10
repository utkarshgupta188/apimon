import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { HttpMethod } from '@prisma/client'
import { z } from 'zod'

const endpointSchema = z.object({
  projectId: z.string().uuid(),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  url: z.string().startsWith('/', 'URL path must start with a slash (e.g., /users)'),
  method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD']).default('GET'),
  description: z.string().optional(),
  expectedStatus: z.number().int().positive().default(200),
  timeout: z.number().int().positive().default(10000),
  enabled: z.boolean().default(true),
  tags: z.array(z.string()).default([]),
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

    // Check project membership
    const membership = await db.member.findFirst({
      where: {
        userId,
        team: { projectId },
      },
    })

    if (!membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const endpoints = await db.endpoint.findMany({
      where: { projectId },
      include: {
        monitors: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ endpoints })
  } catch (error) {
    console.error('Failed to get endpoints:', error)
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
    const result = endpointSchema.safeParse(body)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0].message },
        { status: 400 }
      )
    }

    const { projectId, name, url, method, description, expectedStatus, timeout, enabled, tags } = result.data
    const userId = session.userId

    // Verify membership permissions (Owner or Admin or Member)
    const membership = await db.member.findFirst({
      where: {
        userId,
        team: { projectId },
      },
    })

    if (!membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Check if endpoint with same url and method already exists in this project
    const existing = await db.endpoint.findFirst({
      where: {
        projectId,
        url,
        method: method as HttpMethod,
      },
    })

    if (existing) {
      return NextResponse.json(
        { error: `An endpoint with method ${method} and path "${url}" already exists.` },
        { status: 409 }
      )
    }

    // Create the endpoint and a default monitor in a transaction
    const endpoint = await db.$transaction(async (tx) => {
      const e = await tx.endpoint.create({
        data: {
          projectId,
          name,
          url,
          method: method as HttpMethod,
          description,
          expectedStatus,
          timeout,
          enabled,
          tags,
        },
      })

      // Add background monitor
      await tx.monitor.create({
        data: {
          endpointId: e.id,
          name: `${name} Monitor`,
          intervalSecond: 60,
          isActive: true,
        },
      })

      return e
    })

    // Log action
    await db.activityLog.create({
      data: {
        userId,
        projectId,
        action: 'ENDPOINT_ADD',
        details: `Added endpoint '${method} ${url}'`,
      },
    }).catch(() => {})

    return NextResponse.json({ success: true, endpoint })
  } catch (error) {
    console.error('Failed to create endpoint:', error)
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
      return NextResponse.json({ error: 'Endpoint ID is required' }, { status: 400 })
    }

    const endpoint = await db.endpoint.findUnique({
      where: { id },
    })

    if (!endpoint) {
      return NextResponse.json({ error: 'Endpoint not found' }, { status: 404 })
    }

    const projectId = endpoint.projectId
    const userId = session.userId

    // Verify membership permissions (Owner or Admin or Member)
    const membership = await db.member.findFirst({
      where: {
        userId,
        team: { projectId },
      },
    })

    if (!membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const result = endpointSchema.partial().safeParse(body)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0].message },
        { status: 400 }
      )
    }

    const updated = await db.endpoint.update({
      where: { id },
      data: {
        ...result.data,
        method: result.data.method ? (result.data.method as HttpMethod) : undefined,
      },
    })

    // Log action
    await db.activityLog.create({
      data: {
        userId,
        projectId,
        action: 'SETTINGS_CHANGE',
        details: `Updated endpoint settings for '${updated.method} ${updated.url}'`,
      },
    }).catch(() => {})

    return NextResponse.json({ success: true, endpoint: updated })
  } catch (error) {
    console.error('Failed to update endpoint:', error)
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
      return NextResponse.json({ error: 'Endpoint ID is required' }, { status: 400 })
    }

    const endpoint = await db.endpoint.findUnique({
      where: { id },
    })

    if (!endpoint) {
      return NextResponse.json({ error: 'Endpoint not found' }, { status: 404 })
    }

    const projectId = endpoint.projectId
    const userId = session.userId

    // Verify membership permissions (Owner or Admin)
    const membership = await db.member.findFirst({
      where: {
        userId,
        team: { projectId },
      },
    })

    if (!membership || (membership.role !== 'OWNER' && membership.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Forbidden. Owner or Admin role required' }, { status: 403 })
    }

    await db.endpoint.delete({
      where: { id },
    })

    // Log action
    await db.activityLog.create({
      data: {
        userId,
        projectId,
        action: 'SETTINGS_CHANGE',
        details: `Deleted endpoint '${endpoint.method} ${endpoint.url}'`,
      },
    }).catch(() => {})

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete endpoint:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
