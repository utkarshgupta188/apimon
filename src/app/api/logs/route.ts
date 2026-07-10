import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { HttpMethod } from '@prisma/client'

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

    // Parse filters
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status')
    const method = searchParams.get('method')
    const apiKeyId = searchParams.get('apiKeyId')
    const endpointId = searchParams.get('endpointId')
    const isExport = searchParams.get('export') === 'csv'
    
    // Pagination
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const skip = (page - 1) * limit

    // Build Prisma query filters
    const where: any = { projectId }

    if (status) {
      where.statusCode = parseInt(status)
    }

    if (method) {
      where.method = method as HttpMethod
    }

    if (apiKeyId) {
      where.apiKeyId = apiKeyId
    }

    if (endpointId) {
      where.endpointId = endpointId
    }

    if (search) {
      where.OR = [
        { ipAddress: { contains: search, mode: 'insensitive' } },
        { userAgent: { contains: search, mode: 'insensitive' } },
        { country: { contains: search, mode: 'insensitive' } },
        { errorDetails: { contains: search, mode: 'insensitive' } },
        {
          endpoint: {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { url: { contains: search, mode: 'insensitive' } },
            ]
          }
        },
        {
          apiKey: {
            name: { contains: search, mode: 'insensitive' },
          }
        }
      ]
    }

    // 1. EXPORT CSV
    if (isExport) {
      const logs = await db.requestLog.findMany({
        where,
        include: {
          apiKey: { select: { name: true, keyPrefix: true } },
          endpoint: { select: { name: true, url: true } },
        },
        orderBy: { timestamp: 'desc' },
        take: 1000, // Cap export to last 1000 items
      })

      // Compile CSV
      const csvHeaders = 'Timestamp,API Key Name,Key Prefix,Endpoint Name,Endpoint Path,Method,Status Code,Response Time (ms),IP Address,Country,User Agent,Errors\n'
      const csvRows = logs.map((log) => {
        const timestamp = new Date(log.timestamp).toISOString()
        const keyName = log.apiKey?.name ? `"${log.apiKey.name.replace(/"/g, '""')}"` : 'N/A'
        const prefix = log.apiKey?.keyPrefix || 'N/A'
        const epName = log.endpoint?.name ? `"${log.endpoint.name.replace(/"/g, '""')}"` : 'N/A'
        const epPath = log.endpoint?.url || 'N/A'
        const logMethod = log.method
        const statusCode = log.statusCode
        const responseTime = log.responseTime
        const ip = log.ipAddress || '127.0.0.1'
        const country = log.country || 'US'
        const ua = log.userAgent ? `"${log.userAgent.replace(/"/g, '""')}"` : 'Unknown'
        const errors = log.errorDetails ? `"${log.errorDetails.replace(/"/g, '""')}"` : ''

        return `${timestamp},${keyName},${prefix},${epName},${epPath},${logMethod},${statusCode},${responseTime},${ip},${country},${ua},${errors}`
      }).join('\n')

      const csvContent = csvHeaders + csvRows

      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename="apimon_request_logs.csv"',
        },
      })
    }

    // 2. PAGINATED RESPONSE
    const [total, logs] = await db.$transaction([
      db.requestLog.count({ where }),
      db.requestLog.findMany({
        where,
        include: {
          apiKey: { select: { id: true, name: true, keyPrefix: true } },
          endpoint: { select: { id: true, name: true, url: true } },
        },
        orderBy: { timestamp: 'desc' },
        skip,
        take: limit,
      }),
    ])

    return NextResponse.json({
      logs,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Failed to get request logs:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
