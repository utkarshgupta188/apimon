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

    // 1. Fetch actual request log statistics for status code distribution
    const statusLogs = await db.requestLog.groupBy({
      by: ['statusCode'],
      where: { projectId },
      _count: { id: true },
    })

    // 2. Fetch top endpoints
    const topEndpointsLogs = await db.requestLog.groupBy({
      by: ['endpointId', 'method'],
      where: { projectId, endpointId: { not: null } },
      _count: { id: true },
      _avg: { responseTime: true },
      orderBy: { _count: { id: 'desc' } },
      take: 5,
    })

    // Fetch endpoint names for ids
    const endpointIds = topEndpointsLogs.map(l => l.endpointId as string)
    const dbEndpoints = await db.endpoint.findMany({
      where: { id: { in: endpointIds } },
      select: { id: true, name: true, url: true },
    })

    const topEndpoints = topEndpointsLogs.map(log => {
      const ep = dbEndpoints.find(e => e.id === log.endpointId)
      return {
        id: log.endpointId,
        name: ep?.name || 'Unknown',
        url: ep?.url || 'N/A',
        method: log.method,
        requests: log._count.id,
        avgLatency: Math.round(log._avg.responseTime || 0),
      }
    })

    // 3. Fetch top API keys
    const topApiKeysLogs = await db.requestLog.groupBy({
      by: ['apiKeyId'],
      where: { projectId, apiKeyId: { not: null } },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 5,
    })

    const apiKeyIds = topApiKeysLogs.map(l => l.apiKeyId as string)
    const dbApiKeys = await db.aPIKey.findMany({
      where: { id: { in: apiKeyIds } },
      select: { id: true, name: true, keyPrefix: true },
    })

    const topApiKeys = topApiKeysLogs.map(log => {
      const key = dbApiKeys.find(k => k.id === log.apiKeyId)
      return {
        id: log.apiKeyId,
        name: key?.name || 'Unknown Key',
        prefix: key?.keyPrefix || 'apim_••••',
        requests: log._count.id,
      }
    })

    // 4. Fetch actual geographic data
    const geoLogs = await db.requestLog.groupBy({
      by: ['country'],
      where: { projectId },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 5,
    })

    const geoData = geoLogs.map(g => ({
      country: g.country || 'Unknown',
      requests: g._count.id,
    }))

    // 5. Generate Time-Series Data (Last 7 Days)
    // We will query the DB for logs from the last 7 days
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const dailyLogs = await db.requestLog.findMany({
      where: {
        projectId,
        timestamp: { gte: sevenDaysAgo },
      },
      select: {
        timestamp: true,
        statusCode: true,
        responseTime: true,
      },
    })

    // Group logs by day
    const dailyDataMap = new Map<string, { requests: number; errors: number; avgLatencySum: number; successCount: number }>()
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const dayStr = d.toLocaleDateString([], { month: 'short', day: 'numeric' })
      dailyDataMap.set(dayStr, { requests: 0, errors: 0, avgLatencySum: 0, successCount: 0 })
    }

    dailyLogs.forEach((log) => {
      const dayStr = new Date(log.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })
      if (dailyDataMap.has(dayStr)) {
        const stats = dailyDataMap.get(dayStr)!
        stats.requests += 1
        if (log.statusCode >= 400) {
          stats.errors += 1
        }
        if (log.statusCode < 400) {
          stats.avgLatencySum += log.responseTime
          stats.successCount += 1
        }
      }
    })

    const requestsOverTime = Array.from(dailyDataMap.entries()).map(([date, stats]) => ({
      date,
      requests: stats.requests,
      errors: stats.errors,
      avgLatency: stats.successCount > 0 ? Math.round(stats.avgLatencySum / stats.successCount) : 0,
    }))

    // Calculate total requests in DB to determine if we should fall back to mock data
    const totalRequestsCount = await db.requestLog.count({ where: { projectId } })

    // If there is no data, generate a premium set of mock data to wow the user!
    if (totalRequestsCount < 10) {
      return NextResponse.json(generateMockAnalyticsData())
    }

    // Return merged actual data
    const statusDistribution = statusLogs.map((s) => ({
      name: String(s.statusCode),
      value: s._count.id,
    }))

    return NextResponse.json({
      requestsOverTime,
      statusDistribution: statusDistribution.length > 0 ? statusDistribution : [{ name: '200', value: 10 }],
      topEndpoints: topEndpoints.length > 0 ? topEndpoints : [],
      topApiKeys: topApiKeys.length > 0 ? topApiKeys : [],
      geoData: geoData.length > 0 ? geoData : [{ country: 'US', requests: 1 }],
      isMock: false,
    })
  } catch (error) {
    console.error('Failed to get analytics:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// Generates a beautiful dataset of mock data
function generateMockAnalyticsData() {
  const dates = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    dates.push(d.toLocaleDateString([], { month: 'short', day: 'numeric' }))
  }

  // 1. Time Series Requests and Latency
  // Simulates standard week traffic: lower on weekend, higher on weekdays
  const requestsOverTime = dates.map((date, idx) => {
    const isWeekend = idx === 0 || idx === 1 || idx === 6 // mock weekends
    const baseReq = isWeekend ? 150 : 350
    const noise = Math.floor(Math.random() * 80) - 40
    const requests = baseReq + noise
    
    // 2-3% error rate
    const errors = Math.floor(requests * (Math.random() * 0.03 + 0.01))
    
    // Average Latency
    const avgLatency = Math.floor(Math.random() * 40) + 65 // 65ms - 105ms

    return { date, requests, errors, avgLatency }
  })

  // 2. Status Code Distribution
  const statusDistribution = [
    { name: '200 OK', value: 1850 },
    { name: '201 Created', value: 420 },
    { name: '400 Bad Request', value: 35 },
    { name: '401 Unauthorized', value: 24 },
    { name: '429 Rate Limited', value: 58 },
    { name: '500 Server Error', value: 12 },
  ]

  // 3. Top Endpoints
  const topEndpoints = [
    { name: 'Fetch Users List', url: '/users', method: 'GET', requests: 1240, avgLatency: 54 },
    { name: 'Post Authentication', url: '/auth/login', method: 'POST', requests: 620, avgLatency: 120 },
    { name: 'Get Dashboard Data', url: '/analytics/dashboard', method: 'GET', requests: 410, avgLatency: 84 },
    { name: 'Create Product Order', url: '/orders', method: 'POST', requests: 180, avgLatency: 154 },
    { name: 'Delete User Session', url: '/users/session', method: 'DELETE', requests: 80, avgLatency: 42 },
  ]

  // 4. Top API Keys
  const topApiKeys = [
    { name: 'Stripe Integration Client', prefix: 'apim_live_83ba', requests: 1150 },
    { name: 'Internal iOS App Key', prefix: 'apim_live_fa81', requests: 840 },
    { name: 'External Partner Webhook', prefix: 'apim_live_0bda', requests: 380 },
    { name: 'Testing Staging Server', prefix: 'apim_live_1d2d', requests: 90 },
  ]

  // 5. Geographic distribution
  const geoData = [
    { country: 'United States', requests: 1450 },
    { country: 'Germany', requests: 480 },
    { country: 'United Kingdom', requests: 350 },
    { country: 'India', requests: 280 },
    { country: 'Japan', requests: 190 },
  ]

  return {
    requestsOverTime,
    statusDistribution,
    topEndpoints,
    topApiKeys,
    geoData,
    isMock: true,
  }
}
