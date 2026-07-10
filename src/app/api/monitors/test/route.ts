import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const endpointId = request.nextUrl.searchParams.get('endpointId')
    if (!endpointId) {
      return NextResponse.json({ error: 'Endpoint ID is required' }, { status: 400 })
    }

    const userId = session.userId

    // Fetch endpoint and check project membership
    const endpoint = await db.endpoint.findUnique({
      where: { id: endpointId },
      include: {
        project: {
          include: {
            teams: {
              include: {
                members: {
                  where: { userId },
                },
              },
            },
          },
        },
        monitors: true,
      },
    })

    if (!endpoint) {
      return NextResponse.json({ error: 'Endpoint not found' }, { status: 404 })
    }

    const isMember = endpoint.project.teams[0]?.members.length > 0 || endpoint.project.ownerId === userId
    if (!isMember) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const monitor = endpoint.monitors[0]
    if (!monitor) {
      return NextResponse.json({ error: 'Monitor not configured for endpoint' }, { status: 500 })
    }

    let latency = 0
    let statusCode = endpoint.expectedStatus

    const baseUrl = endpoint.project.baseUrl

    if (baseUrl) {
      // REAL PING
      const targetUrl = `${baseUrl.replace(/\/$/, '')}${endpoint.url}`
      const start = Date.now()
      
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), endpoint.timeout)

        const response = await fetch(targetUrl, {
          method: endpoint.method,
          signal: controller.signal,
        })
        
        clearTimeout(timeoutId)
        latency = Date.now() - start
        statusCode = response.status
      } catch (err: any) {
        latency = Date.now() - start
        statusCode = err.name === 'AbortError' ? 504 : 502
      }
    } else {
      // SIMULATED PING
      latency = Math.floor(Math.random() * 60) + 20 // 20ms - 80ms
      // 98% chance of success (expectedStatus), 2% chance of 500 server error
      const isSuccess = Math.random() > 0.02
      statusCode = isSuccess ? endpoint.expectedStatus : 500
    }

    const isUp = statusCode === endpoint.expectedStatus

    // Calculate rolling uptime percent: new_uptime = (old_uptime * 9 + (isUp ? 100 : 0)) / 10
    const currentUptime = monitor.uptimePercent
    const newUptime = (currentUptime * 9 + (isUp ? 100 : 0)) / 10

    // Update Monitor
    const updatedMonitor = await db.monitor.update({
      where: { id: monitor.id },
      data: {
        lastCheckedAt: new Date(),
        lastStatusCode: statusCode,
        lastLatency: latency,
        uptimePercent: newUptime,
      },
    })

    // Log request
    await db.requestLog.create({
      data: {
        projectId: endpoint.projectId,
        endpointId: endpoint.id,
        method: endpoint.method,
        statusCode,
        responseTime: latency,
        ipAddress: '127.0.0.1 (Self-Monitor)',
        country: 'US',
        userAgent: 'APIMon Uptime Bot v1.0',
        errorDetails: isUp ? null : `Uptime Monitor Check Failed: HTTP ${statusCode} (Expected: ${endpoint.expectedStatus})`,
      },
    }).catch(() => {})

    return NextResponse.json({
      success: true,
      latency,
      statusCode,
      uptimePercent: newUptime,
    })
  } catch (error) {
    console.error('Failed to run monitor ping check:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
