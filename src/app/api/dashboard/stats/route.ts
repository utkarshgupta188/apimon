import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = request.nextUrl
    const projectId = searchParams.get('projectId')

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

    // Set time boundaries
    const startOfToday = new Date()
    startOfToday.setHours(0, 0, 0, 0)

    // Parallel aggregate queries for speed
    const [
      totalProjects,
      activeApis,
      activeKeys,
      totalRequests,
      requestsToday,
      rateLimited,
      errorsCount,
      avgResponseTimeAgg,
      uptimeAgg,
    ] = await Promise.all([
      db.project.count({
        where: {
          OR: [
            { ownerId: userId },
            { teams: { some: { members: { some: { userId } } } } },
          ],
        },
      }),
      db.endpoint.count({ where: { projectId, enabled: true } }),
      db.aPIKey.count({ where: { projectId, isActive: true } }),
      db.requestLog.count({ where: { projectId } }),
      db.requestLog.count({
        where: {
          projectId,
          timestamp: { gte: startOfToday },
        },
      }),
      db.requestLog.count({ where: { projectId, statusCode: 429 } }),
      db.requestLog.count({
        where: {
          projectId,
          statusCode: { gte: 400 },
        },
      }),
      db.requestLog.aggregate({
        where: {
          projectId,
          statusCode: { lt: 400 }, // Average of successful responses
        },
        _avg: {
          responseTime: true,
        },
      }),
      db.monitor.aggregate({
        where: {
          endpoint: { projectId },
          isActive: true,
        },
        _avg: {
          uptimePercent: true,
        },
      }),
    ])

    const successCount = totalRequests - errorsCount
    const successRate = totalRequests > 0 ? (successCount / totalRequests) * 100 : 100.0
    const errorRate = totalRequests > 0 ? (errorsCount / totalRequests) * 100 : 0.0

    return NextResponse.json({
      stats: {
        totalProjects,
        activeApis,
        totalRequests,
        requestsToday,
        successRate,
        errorRate,
        avgResponseTime: avgResponseTimeAgg._avg.responseTime || 0,
        activeApiKeys: activeKeys,
        uptimePercent: uptimeAgg._avg.uptimePercent || 100.0,
        rateLimitedRequests: rateLimited,
      },
    })
  } catch (error) {
    console.error('Failed to query dashboard stats:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
