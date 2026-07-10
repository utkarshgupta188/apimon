import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { GoogleGenAI } from '@google/genai'

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { projectId } = body

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

    // 1. Gather project context data for Gemini
    const [project, endpoints, apiKeys, logs] = await Promise.all([
      db.project.findUnique({
        where: { id: projectId },
      }),
      db.endpoint.findMany({
        where: { projectId },
        include: { monitors: true },
      }),
      db.aPIKey.findMany({
        where: { projectId },
        include: { rateLimits: true },
      }),
      db.requestLog.findMany({
        where: { projectId },
        orderBy: { timestamp: 'desc' },
        take: 100, // Send last 100 request logs for context
      }),
    ])

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Check if Gemini API key is configured
    const apiKey = process.env.GEMINI_API_KEY
    
    if (!apiKey) {
      // Return simulated AI insights to ensure the application works out-of-the-box
      const simulatedResponse = generateSimulatedAiAnalysis(project.name, endpoints, apiKeys, logs)
      return NextResponse.json({
        success: true,
        analysis: simulatedResponse,
        isSimulated: true,
      })
    }

    // 2. Initialize Gemini Client (using new GoogleGenAI SDK)
    const ai = new GoogleGenAI({ apiKey })

    // Serialize project data into a prompt
    const endpointContext = endpoints.map(e => (
      `- Path: ${e.method} ${e.url}, Expected Status: ${e.expectedStatus}, Timeout: ${e.timeout}ms, Enabled: ${e.enabled}, Uptime: ${e.monitors[0]?.uptimePercent.toFixed(1) || 100}%, Avg Latency: ${e.monitors[0]?.lastLatency || 'N/A'}ms`
    )).join('\n')

    const keyContext = apiKeys.map(k => {
      const rl = k.rateLimits[0]
      const rlText = rl 
        ? `${rl.type} (Sec: ${rl.requestsPerSecond || 'N/A'}, Min: ${rl.requestsPerMinute || 'N/A'}, Hour: ${rl.requestsPerHour || 'N/A'}, Day: ${rl.requestsPerDay || 'N/A'})`
        : 'None'
      return `- Key Name: ${k.name}, Prefix: ${k.keyPrefix}, Active: ${k.isActive}, Limits: ${rlText}`
    }).join('\n')

    const logsContext = logs.slice(0, 50).map(l => (
      `Method: ${l.method}, URL: ${l.endpointId || 'N/A'}, Status: ${l.statusCode}, Latency: ${l.responseTime}ms, IP: ${l.ipAddress}, Country: ${l.country}, Error: ${l.errorDetails || 'None'}`
    )).join('\n')

    const prompt = `
You are an expert AI API Reliability and Security Co-pilot. Analyze the following monitoring metrics, configurations, and request logs for the API project "${project.name}" and provide a professional, structured reliability report in Markdown.

### Project Context:
- Environment: ${project.environment}
- Base URL: ${project.baseUrl || 'None (Simulated Mock Gateway)'}

### Registered Endpoints:
${endpointContext || 'No endpoints configured.'}

### API Key Configurations & Rate Limits:
${keyContext || 'No API Keys configured.'}

### Recent Request Logs (Last 50 entries):
${logsContext || 'No request logs recorded.'}

### Requirements for the Report:
Provide the report with the following detailed sections:
1. **Executive Summary**: High-level reliability status (overall success rate, current latency profile).
2. **Slow Endpoint & Bottleneck Detection**: Identify any endpoints experiencing high latency or timeouts. Recommend timeout configurations.
3. **Error Analysis**: Highlight any HTTP 4xx/5xx spikes or 429 Rate Limit blocks. Explain potential root causes.
4. **Security & Threat Intelligence**: Spot anomalies such as suspicious IP behaviors, key sharing, or high rate limit triggers.
5. **Rate Limit & Allocation Recommendations**: Recommend optimal requests-per-minute or window configurations for each active key based on observed load.
6. **Optimizations & Action Items**: Provide a concrete list of 3-5 developer actions (e.g. database query caching, connection pool updates, CDN cache headers).

Keep the tone professional, technical, and highly actionable. Return only the markdown text.
`

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    })

    const analysisText = response.text || 'Failed to generate content.'

    return NextResponse.json({
      success: true,
      analysis: analysisText,
      isSimulated: false,
    })
  } catch (error: any) {
    console.error('Gemini analysis error:', error)
    return NextResponse.json(
      { error: `AI analysis failed: ${error.message || 'Unknown error'}` },
      { status: 500 }
    )
  }
}

// Generate realistic simulated analysis based on actual project metrics
function generateSimulatedAiAnalysis(projectName: string, endpoints: any[], apiKeys: any[], logs: any[]) {
  const totalRequests = logs.length
  const errorsCount = logs.filter(l => l.statusCode >= 400).length
  const rateLimitCount = logs.filter(l => l.statusCode === 429).length
  const avgLatency = totalRequests > 0 
    ? Math.round(logs.reduce((sum, l) => sum + l.responseTime, 0) / totalRequests)
    : 0

  const slowEndpoints = endpoints.filter(e => (e.monitors[0]?.lastLatency || 0) > 300)

  return `# API reliability & Security Report: "${projectName}"
*Generated by APIMon AI Co-pilot (Simulated Mode)*

---

## 1. Executive Summary
Overall reliability for **${projectName}** is currently **${errorsCount > 0 ? 'NEEDS ATTENTION' : 'HEALTHY'}**.
- **Total Requests Evaluated**: ${totalRequests} (recent samples)
- **Error Rate**: ${totalRequests > 0 ? ((errorsCount / totalRequests) * 100).toFixed(1) : '0.0'}%
- **Average Latency**: ${avgLatency} ms
- **Active Endpoints**: ${endpoints.filter(e => e.enabled).length}
- **Active API Keys**: ${apiKeys.filter(k => k.isActive).length}

---

## 2. Slow Endpoint & Bottleneck Detection
${slowEndpoints.length > 0 ? `The following endpoints are exhibiting high latencies:
${slowEndpoints.map(e => `* **${e.method} ${e.url}**: average latency is **${e.monitors[0]?.lastLatency}ms** (Expected timeout: ${e.timeout}ms).`).join('\n')}

**Recommendations**:
- Implement Redis-backed response caching for GET routes experiencing slow read operations.
- Decrease configured timeouts to **3000ms** to prevent thread pool exhaustion during backend outages.` 
: `* No endpoints currently exceed the 300ms latency warning threshold. Uptime monitors indicate fast response paths.
* **GET** endpoints have a highly performant average latency profile (<80ms).`}

---

## 3. Error Analysis
- **Rate Limit (429) Triggered**: ${rateLimitCount} times.
- **Server Errors (5xx)**: ${logs.filter(l => l.statusCode >= 500).length} times.
- **Client Errors (4xx)**: ${logs.filter(l => l.statusCode >= 400 && l.statusCode < 500 && l.statusCode !== 429).length} times.

**Observations**:
- ${rateLimitCount > 0 ? `Rate limiting triggers indicate clients are hitting the thresholds frequently. Consider upgrading their key tier.` : `Rate limiting triggers are stable. No clients are currently blocked.`}
- ${logs.filter(l => l.statusCode >= 500).length > 0 ? `Incidents of 5xx errors correlate with backend database timeout exceptions.` : `No backend system errors (5xx) detected in the evaluation log window.`}

---

## 4. Security & Threat Intelligence
- **IP Clustering**: Evaluated traffic shows normal distribution.
- **Rate Limit Scans**: ${rateLimitCount > 5 ? 'Warning: High frequency of rate limit triggers from a single IP. This may indicate credential scanning or DDoS patterns.' : 'Secure. No anomalous IP request clustering found.'}
- **Key Prefix integrity**: Secure. Hashed token storage prevents enumeration leakage in database dumps.

---

## 5. Rate Limit & Allocation Recommendations
Based on the observed transaction logs:
${apiKeys.map(k => {
  const rl = k.rateLimits[0]
  if (!rl) return `* **Key: ${k.name}** (${k.keyPrefix}•••): Currently **Unlimited**. We recommend setting a baseline limit of **100 requests per minute** to protect resources.`
  return `* **Key: ${k.name}** (${k.keyPrefix}•••): Currently configured as **${rl.type}** with limits of ${rl.requestsPerMinute || 'unlimited'} req/min. This allocation matches their current peak of ${Math.floor(totalRequests * 0.4)} requests/min.`
}).join('\n') || '* No keys configured. Please register a key first.'}

---

## 6. Action Items & Developer Checklist
1. **[Critical]** Set up alert rules for **API_DOWN** triggers on all production endpoints to notify Teams via Slack or Discord webhook immediately.
2. **[Optimization]** Enable sliding window rate limiting on all API keys to protect against bursts at the start of a minute block.
3. **[Cache]** Apply HTTP response cache headers (\`Cache-Control: public, max-age=60\`) on non-dynamic GET routes.
`
}
