import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { TriggerType, NotificationMethod } from '@prisma/client'
import { z } from 'zod'

const alertSchema = z.object({
  projectId: z.string().uuid(),
  endpointId: z.string().uuid().optional().nullable(),
  triggerType: z.enum(['API_DOWN', 'HIGH_LATENCY', 'HIGH_ERROR_RATE', 'RATE_LIMIT_EXCEEDED']),
  threshold: z.number().positive(),
  durationSecond: z.number().int().positive().default(60),
  notificationMethod: z.enum(['EMAIL', 'SLACK', 'DISCORD']),
  recipient: z.string().min(1, 'Recipient details are required'),
  isActive: z.boolean().default(true),
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

    // Fetch alerts and notifications log
    const alerts = await db.alert.findMany({
      where: { projectId },
      include: {
        endpoint: { select: { id: true, name: true, url: true, method: true } },
        notifications: {
          orderBy: { timestamp: 'desc' },
          take: 5,
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ alerts })
  } catch (error) {
    console.error('Failed to get alerts:', error)
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
    const result = alertSchema.safeParse(body)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0].message },
        { status: 400 }
      )
    }

    const { projectId, endpointId, triggerType, threshold, durationSecond, notificationMethod, recipient, isActive } = result.data
    const userId = session.userId

    // Check membership
    const membership = await db.member.findFirst({
      where: {
        userId,
        team: { projectId },
      },
    })

    if (!membership || (membership.role !== 'OWNER' && membership.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Forbidden. Owner or Admin role required' }, { status: 403 })
    }

    const alert = await db.alert.create({
      data: {
        projectId,
        endpointId: endpointId || null,
        triggerType: triggerType as TriggerType,
        threshold,
        durationSecond,
        notificationMethod: notificationMethod as NotificationMethod,
        recipient,
        isActive,
      },
    })

    // Log action
    await db.activityLog.create({
      data: {
        userId,
        projectId,
        action: 'SETTINGS_CHANGE',
        details: `Created alert rule on ${triggerType} sent to ${recipient}`,
      },
    }).catch(() => {})

    return NextResponse.json({ success: true, alert })
  } catch (error) {
    console.error('Failed to create alert:', error)
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
      return NextResponse.json({ error: 'Alert ID is required' }, { status: 400 })
    }

    const alert = await db.alert.findUnique({
      where: { id },
    })

    if (!alert) {
      return NextResponse.json({ error: 'Alert not found' }, { status: 404 })
    }

    const projectId = alert.projectId
    const userId = session.userId

    // Verify membership permissions (Owner or Admin)
    const membership = await db.member.findFirst({
      where: {
        userId,
        team: { projectId },
      },
    })

    if (!membership || (membership.role !== 'OWNER' && membership.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const result = alertSchema.partial().safeParse(body)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0].message },
        { status: 400 }
      )
    }

    const updated = await db.alert.update({
      where: { id },
      data: {
        ...result.data,
        triggerType: result.data.triggerType ? (result.data.triggerType as TriggerType) : undefined,
        notificationMethod: result.data.notificationMethod ? (result.data.notificationMethod as NotificationMethod) : undefined,
      },
    })

    return NextResponse.json({ success: true, alert: updated })
  } catch (error) {
    console.error('Failed to update alert:', error)
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
      return NextResponse.json({ error: 'Alert ID is required' }, { status: 400 })
    }

    const alert = await db.alert.findUnique({
      where: { id },
    })

    if (!alert) {
      return NextResponse.json({ error: 'Alert not found' }, { status: 404 })
    }

    const projectId = alert.projectId
    const userId = session.userId

    // Verify membership permissions (Owner or Admin)
    const membership = await db.member.findFirst({
      where: {
        userId,
        team: { projectId },
      },
    })

    if (!membership || (membership.role !== 'OWNER' && membership.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await db.alert.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete alert:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
