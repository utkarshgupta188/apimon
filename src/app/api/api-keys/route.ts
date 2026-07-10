import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { generateApiKey, hashApiKey } from '@/lib/crypto'
import { z } from 'zod'

const keyCreateSchema = z.object({
  projectId: z.string().uuid(),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  expiresAt: z.string().optional().nullable(),
  rateLimit: z.object({
    type: z.enum(['SLIDING_WINDOW', 'FIXED_WINDOW', 'TOKEN_BUCKET']).default('SLIDING_WINDOW'),
    requestsPerSecond: z.number().int().positive().optional().nullable(),
    requestsPerMinute: z.number().int().positive().optional().nullable(),
    requestsPerHour: z.number().int().positive().optional().nullable(),
    requestsPerDay: z.number().int().positive().optional().nullable(),
  }),
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

    const apiKeys = await db.aPIKey.findMany({
      where: { projectId },
      include: {
        rateLimits: true,
        _count: {
          select: { requestLogs: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    // Remove hashed keys from output for safety
    const formattedKeys = apiKeys.map((key) => ({
      id: key.id,
      name: key.name,
      keyPrefix: key.keyPrefix,
      isActive: key.isActive,
      expiresAt: key.expiresAt,
      lastUsedAt: key.lastUsedAt,
      createdAt: key.createdAt,
      rateLimit: key.rateLimits[0] || null,
      requestCount: key._count.requestLogs,
    }))

    return NextResponse.json({ apiKeys: formattedKeys })
  } catch (error) {
    console.error('Failed to list API keys:', error)
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
    const result = keyCreateSchema.safeParse(body)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.errors[0].message },
        { status: 400 }
      )
    }

    const { projectId, name, expiresAt, rateLimit } = result.data
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

    // Generate secure key
    const rawKey = generateApiKey() // returns 'apim_live_...'
    const keyHash = hashApiKey(rawKey)
    const keyPrefix = rawKey.substring(0, 14) // 'apim_live_xxxx'

    // Create API Key and Rate Limit config in a transaction
    const apiKey = await db.$transaction(async (tx) => {
      const key = await tx.aPIKey.create({
        data: {
          projectId,
          userId,
          name,
          keyPrefix,
          keyHash,
          expiresAt: expiresAt ? new Date(expiresAt) : null,
        },
      })

      const rl = await tx.rateLimit.create({
        data: {
          apiKeyId: key.id,
          type: rateLimit.type,
          requestsPerSecond: rateLimit.requestsPerSecond || null,
          requestsPerMinute: rateLimit.requestsPerMinute || null,
          requestsPerHour: rateLimit.requestsPerHour || null,
          requestsPerDay: rateLimit.requestsPerDay || null,
        },
      })

      return { key, rateLimit: rl }
    })

    // Log action
    await db.activityLog.create({
      data: {
        userId,
        projectId,
        action: 'API_KEY_GENERATE',
        details: `Generated API Key '${name}' (prefix: ${keyPrefix})`,
      },
    }).catch(() => {})

    return NextResponse.json({
      success: true,
      apiKey: {
        id: apiKey.key.id,
        name: apiKey.key.name,
        keyPrefix: apiKey.key.keyPrefix,
        expiresAt: apiKey.key.expiresAt,
        isActive: apiKey.key.isActive,
        rateLimit: apiKey.rateLimit,
      },
      rawKey, // Exposed EXACTLY ONCE here
    })
  } catch (error) {
    console.error('Failed to create API key:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const keyId = request.nextUrl.searchParams.get('id')
    const action = request.nextUrl.searchParams.get('action') // 'toggle' or 'regenerate'

    if (!keyId) {
      return NextResponse.json({ error: 'Key ID is required' }, { status: 400 })
    }

    const apiKey = await db.aPIKey.findUnique({
      where: { id: keyId },
    })

    if (!apiKey) {
      return NextResponse.json({ error: 'API Key not found' }, { status: 404 })
    }

    const projectId = apiKey.projectId
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

    if (action === 'toggle') {
      const updated = await db.aPIKey.update({
        where: { id: keyId },
        data: { isActive: !apiKey.isActive },
      })

      // Log action
      await db.activityLog.create({
        data: {
          userId,
          projectId,
          action: 'SETTINGS_CHANGE',
          details: `Toggled API Key '${apiKey.name}' to ${updated.isActive ? 'Active' : 'Inactive'}`,
        },
      }).catch(() => {})

      return NextResponse.json({ success: true, isActive: updated.isActive })
    }

    if (action === 'regenerate') {
      const rawKey = generateApiKey()
      const keyHash = hashApiKey(rawKey)
      const keyPrefix = rawKey.substring(0, 14)

      await db.aPIKey.update({
        where: { id: keyId },
        data: {
          keyPrefix,
          keyHash,
          createdAt: new Date(),
        },
      })

      // Log action
      await db.activityLog.create({
        data: {
          userId,
          projectId,
          action: 'API_KEY_GENERATE',
          details: `Regenerated API Key '${apiKey.name}' (new prefix: ${keyPrefix})`,
        },
      }).catch(() => {})

      return NextResponse.json({
        success: true,
        rawKey, // Exposed EXACTLY ONCE here
        keyPrefix,
      })
    }

    return NextResponse.json({ error: 'Invalid action parameter' }, { status: 400 })
  } catch (error) {
    console.error('Failed to update API key:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const keyId = request.nextUrl.searchParams.get('id')
    if (!keyId) {
      return NextResponse.json({ error: 'Key ID is required' }, { status: 400 })
    }

    const apiKey = await db.aPIKey.findUnique({
      where: { id: keyId },
    })

    if (!apiKey) {
      return NextResponse.json({ error: 'API Key not found' }, { status: 404 })
    }

    const projectId = apiKey.projectId
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

    await db.aPIKey.delete({
      where: { id: keyId },
    })

    // Log action
    await db.activityLog.create({
      data: {
        userId,
        projectId,
        action: 'SETTINGS_CHANGE',
        details: `Deleted API Key '${apiKey.name}'`,
      },
    }).catch(() => {})

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete API key:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
