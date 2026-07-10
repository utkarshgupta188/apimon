import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { hashApiKey } from '@/lib/crypto'
import { checkRateLimit } from '@/lib/rate-limiter'
import { HttpMethod } from '@prisma/client'

// Helper to extract geo IP headers or fallback
function getRequestMetadata(request: NextRequest) {
  const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0] || request.headers.get('x-real-ip') || '127.0.0.1'
  const userAgent = request.headers.get('user-agent') || 'Unknown'
  const country = request.headers.get('x-vercel-ip-country') || 'US' // Vercel geo IP header
  return { ipAddress, userAgent, country }
}

async function handleApiGateway(
  request: NextRequest,
  pathParams: string[]
) {
  const startTime = Date.now()
  const path = '/' + pathParams.join('/')
  const method = request.method as HttpMethod
  
  // 1. Extract API Key
  let apiKeyString = request.headers.get('x-api-key')
  const authHeader = request.headers.get('authorization')
  
  if (!apiKeyString && authHeader?.startsWith('Bearer ')) {
    apiKeyString = authHeader.substring(7)
  }
  
  if (!apiKeyString) {
    return NextResponse.json(
      { error: 'Unauthorized. API Key is missing. Pass it via x-api-key or Authorization Bearer header.' },
      { status: 401 }
    )
  }

  // 2. Validate API Key
  const hashed = hashApiKey(apiKeyString)
  
  const apiKey = await db.aPIKey.findUnique({
    where: { keyHash: hashed },
    include: {
      project: true,
      rateLimits: true,
    },
  })

  if (!apiKey || !apiKey.isActive) {
    return NextResponse.json(
      { error: 'Unauthorized. API Key is invalid or deactivated.' },
      { status: 401 }
    )
  }

  if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
    return NextResponse.json(
      { error: 'Unauthorized. API Key has expired.' },
      { status: 401 }
    )
  }

  // Get metadata
  const { ipAddress, userAgent, country } = getRequestMetadata(request)
  const projectId = apiKey.projectId

  // Update last used timestamp in background
  db.aPIKey.update({
    where: { id: apiKey.id },
    data: { lastUsedAt: new Date() },
  }).catch((err: any) => console.error('Failed to update API key lastUsedAt:', err))

  // 3. Rate Limiting Check
  const rateLimitConfig = apiKey.rateLimits[0]
  if (rateLimitConfig) {
    const rlResult = await checkRateLimit(apiKey.id, {
      requestsPerSecond: rateLimitConfig.requestsPerSecond,
      requestsPerMinute: rateLimitConfig.requestsPerMinute,
      requestsPerHour: rateLimitConfig.requestsPerHour,
      requestsPerDay: rateLimitConfig.requestsPerDay,
      type: rateLimitConfig.type,
    })

    if (!rlResult.success) {
      // Log blocked request
      await db.requestLog.create({
        data: {
          projectId,
          apiKeyId: apiKey.id,
          method,
          statusCode: 429,
          responseTime: 0,
          ipAddress,
          country,
          userAgent,
          errorDetails: `Rate Limit Exceeded. (Type: ${rateLimitConfig.type})`,
        },
      }).catch((e: any) => console.error('Log block failed:', e))

      // Trigger Alert if configured for rate limit exceeded
      triggerAlert(projectId, null, 'RATE_LIMIT_EXCEEDED', 1, `Rate limit exceeded on key: ${apiKey.name}`).catch((e: any) => {})

      return new NextResponse(
        JSON.stringify({
          error: 'Too Many Requests',
          message: `API rate limit exceeded. Retry in ${rlResult.retryAfter} seconds.`,
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': String(rlResult.retryAfter),
            'X-RateLimit-Limit': String(rlResult.limit),
            'X-RateLimit-Remaining': String(rlResult.remaining),
            'X-RateLimit-Reset': String(rlResult.reset),
          },
        }
      )
    }
  }

  // Normalize path by stripping trailing slash
  const cleanPath = path.endsWith('/') && path.length > 1 ? path.slice(0, -1) : path
  
  // 4. Find Endpoint config
  const endpoint = await db.endpoint.findFirst({
    where: {
      projectId,
      url: {
        in: [cleanPath, `/api/v1${cleanPath}`],
      },
      method,
    },
  })

  if (endpoint && !endpoint.enabled) {
    const latency = Date.now() - startTime
    await db.requestLog.create({
      data: {
        projectId,
        apiKeyId: apiKey.id,
        endpointId: endpoint.id,
        method,
        statusCode: 403,
        responseTime: latency,
        ipAddress,
        country,
        userAgent,
        errorDetails: 'Endpoint is disabled by administrator',
      },
    }).catch(() => {})

    return NextResponse.json(
      { error: 'Forbidden. Endpoint is disabled.' },
      { status: 403 }
    )
  }

  // 5. Proxy or Simulate Request
  let responseStatusCode = 200
  let responseBodyText = ''
  let responseHeaders: Record<string, string> = { 'Content-Type': 'application/json' }
  let targetLatency = 0

  const projectBaseUrl = apiKey.project.baseUrl

  if (projectBaseUrl) {
    // REAL PROXY
    try {
      // Parse search params
      const searchParams = request.nextUrl.search
      const targetUrl = `${projectBaseUrl.replace(/\/$/, '')}${path}${searchParams}`

      // Forward headers (excluding API keys and host)
      const headersToSend = new Headers()
      request.headers.forEach((value, key) => {
        if (!['host', 'x-api-key', 'authorization'].includes(key.toLowerCase())) {
          headersToSend.set(key, value)
        }
      })

      const requestBody = ['GET', 'HEAD'].includes(method) ? undefined : await request.text()
      const timeoutMs = endpoint?.timeout || 10000

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

      const backendResponse = await fetch(targetUrl, {
        method,
        headers: headersToSend,
        body: requestBody,
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      responseStatusCode = backendResponse.status
      responseBodyText = await backendResponse.text()
      targetLatency = Date.now() - startTime

      backendResponse.headers.forEach((value, key) => {
        if (!['content-encoding', 'content-length'].includes(key.toLowerCase())) {
          responseHeaders[key] = value
        }
      })
    } catch (error: any) {
      targetLatency = Date.now() - startTime
      responseStatusCode = error.name === 'AbortError' ? 504 : 502
      responseBodyText = JSON.stringify({
        error: responseStatusCode === 504 ? 'Gateway Timeout' : 'Bad Gateway',
        message: error.message || 'Error proxying to backend endpoint',
      })

      // Log error details
      await db.requestLog.create({
        data: {
          projectId,
          apiKeyId: apiKey.id,
          endpointId: endpoint?.id,
          method,
          statusCode: responseStatusCode,
          responseTime: targetLatency,
          ipAddress,
          country,
          userAgent,
          errorDetails: `Proxy Error: ${error.message}`,
        },
      }).catch(() => {})

      // Trigger Alert for API down/error
      triggerAlert(projectId, endpoint?.id || null, 'API_DOWN', 1, `API Gateway failed to connect: ${error.message}`).catch((e) => {})

      return new NextResponse(responseBodyText, {
        status: responseStatusCode,
        headers: { 'Content-Type': 'application/json' },
      })
    }
  } else {
    // SIMULATED ENDPOINT MOCK (For quick local testing and playground)
    // Add a small artificial delay to simulate realistic response times (40ms to 120ms)
    targetLatency = Math.floor(Math.random() * 80) + 40
    await new Promise((resolve) => setTimeout(resolve, targetLatency))

    if (endpoint) {
      responseStatusCode = endpoint.expectedStatus
      responseBodyText = JSON.stringify({
        success: true,
        message: `Simulated mock response for ${method} ${path}`,
        endpointName: endpoint.name,
        expectedStatus: endpoint.expectedStatus,
        tags: endpoint.tags,
        timestamp: new Date().toISOString(),
      })
    } else {
      // Dynamic response if endpoint is not registered but key is valid
      responseStatusCode = 200
      responseBodyText = JSON.stringify({
        success: true,
        message: `Simulated gateway response for ${method} ${path}. Register this endpoint in the panel to customize.`,
        timestamp: new Date().toISOString(),
      })
    }
  }

  // 6. Log Request
  await db.requestLog.create({
    data: {
      projectId,
      apiKeyId: apiKey.id,
      endpointId: endpoint?.id || null,
      method,
      statusCode: responseStatusCode,
      responseTime: targetLatency,
      ipAddress,
      country,
      userAgent,
      errorDetails: responseStatusCode >= 400 ? 'Client/Server Error Response' : null,
    },
  }).catch((e: any) => console.error('Log request failed:', e))

  // 7. Check if we need to trigger alerts on error rate or latency
  if (responseStatusCode >= 500) {
    triggerAlert(projectId, endpoint?.id || null, 'API_DOWN', 1, `HTTP ${responseStatusCode} returned on ${method} ${path}`).catch((e: any) => {})
  }
  if (targetLatency > (endpoint?.timeout || 3000)) {
    triggerAlert(projectId, endpoint?.id || null, 'HIGH_LATENCY', targetLatency, `Latency of ${targetLatency}ms exceeded threshold`).catch((e: any) => {})
  }

  // 8. Return response
  return new NextResponse(responseBodyText, {
    status: responseStatusCode,
    headers: responseHeaders,
  })
}

// Background Alerting Service
async function triggerAlert(
  projectId: string,
  endpointId: string | null,
  triggerType: 'API_DOWN' | 'HIGH_LATENCY' | 'HIGH_ERROR_RATE' | 'RATE_LIMIT_EXCEEDED',
  value: number,
  message: string
) {
  try {
    // Find active alerts for this project
    const alerts = await db.alert.findMany({
      where: {
        projectId,
        triggerType,
        isActive: true,
        OR: [
          { endpointId: null },
          { endpointId },
        ],
      },
    })

    for (const alert of alerts) {
      // Create notification log
      await db.notificationLog.create({
        data: {
          alertId: alert.id,
          sentTo: alert.recipient,
          status: 'SUCCESS', // Mock alert dispatch success
          message: `[ALERT TRIGGERED] ${triggerType} on Project: ${projectId}. Message: ${message}`,
        },
      })
      console.log(`[ALERT DISPATCHED] sent to ${alert.recipient} (${alert.notificationMethod}) - ${message}`)
    }
  } catch (error) {
    console.error('Failed to trigger alert background task:', error)
  }
}

// Next.js 16 Async route parameter matching!
export async function GET(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params
  return handleApiGateway(request, path)
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params
  return handleApiGateway(request, path)
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params
  return handleApiGateway(request, path)
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params
  return handleApiGateway(request, path)
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params
  return handleApiGateway(request, path)
}

export async function OPTIONS(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params
  return handleApiGateway(request, path)
}

export async function HEAD(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params
  return handleApiGateway(request, path)
}
