'use client'

import React, { useEffect, useState } from 'react'
import DashboardShell from '@/components/dashboard-shell'
import { useProject } from '@/lib/project-context'
import {
  LineChart as RechartsLineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import {
  TrendingUp,
  Clock,
  Terminal,
  Key,
  Globe,
  Loader2,
  AlertCircle,
  HelpCircle,
  Activity,
  Layers,
  Sparkles,
  RefreshCw,
  Copy,
  Check,
  Info,
} from 'lucide-react'

interface TopEndpoint {
  id: string | null
  name: string
  url: string
  method: string
  requests: number
  avgLatency: number
}

interface TopApiKey {
  id: string | null
  name: string
  prefix: string
  requests: number
}

interface StatusDistributionItem {
  name: string
  value: number
}

interface GeoData {
  country: string
  requests: number
}

interface AnalyticsData {
  requestsOverTime: { date: string; requests: number; errors: number; avgLatency: number }[]
  statusDistribution: StatusDistributionItem[]
  topEndpoints: TopEndpoint[]
  topApiKeys: TopApiKey[]
  geoData: GeoData[]
  isMock: boolean
}

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ef4444', '#64748b']

// Simple custom markdown renderer
function renderMarkdown(markdown: string) {
  if (!markdown) return null

  return markdown.split('\n').map((line, idx) => {
    let cleanLine = line.trim()
    
    // Bold parsing: **text** -> <strong>text</strong>
    const boldRegex = /\*\*(.*?)\*\*/g
    const hasBold = boldRegex.test(cleanLine)
    
    // Inline code parsing: `code` -> <code>code</code>
    const codeRegex = /`(.*?)`/g

    const formatText = (text: string) => {
      // Very simple formatter for bold and inline code
      let formatted: React.ReactNode = text
      
      // We can split and replace bold/code tags
      if (text.includes('**') || text.includes('`')) {
        const parts = text.split(/(\*\*.*?\*\*|`.*?`)/)
        return parts.map((part, pIdx) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={pIdx} className="font-extrabold text-foreground">{part.slice(2, -2)}</strong>
          }
          if (part.startsWith('`') && part.endsWith('`')) {
            return <code key={pIdx} className="bg-secondary px-1.5 py-0.5 rounded font-mono text-xs text-primary">{part.slice(1, -1)}</code>
          }
          return part
        })
      }
      return formatted
    }

    if (cleanLine.startsWith('### ')) {
      return (
        <h4 key={idx} className="text-sm font-bold text-foreground uppercase tracking-wider mt-5 mb-2.5">
          {formatText(cleanLine.replace('### ', ''))}
        </h4>
      )
    }
    if (cleanLine.startsWith('## ')) {
      return (
        <h3 key={idx} className="text-base font-extrabold text-foreground border-b border-border/40 pb-1 mt-7 mb-3.5">
          {formatText(cleanLine.replace('## ', ''))}
        </h3>
      )
    }
    if (cleanLine.startsWith('# ')) {
      return (
        <h2 key={idx} className="text-xl font-black text-foreground mt-8 mb-4">
          {formatText(cleanLine.replace('# ', ''))}
        </h2>
      )
    }
    if (cleanLine.startsWith('* ') || cleanLine.startsWith('- ')) {
      return (
        <li key={idx} className="text-sm text-muted-foreground ml-6 list-disc mb-1.5">
          {formatText(cleanLine.substring(2))}
        </li>
      )
    }
    if (cleanLine === '---') {
      return <hr key={idx} className="border-border/60 my-5" />
    }
    if (!cleanLine) {
      return <div key={idx} className="h-2" />
    }
    return (
      <p key={idx} className="text-sm text-muted-foreground leading-relaxed mb-2.5">
        {formatText(cleanLine)}
      </p>
    )
  })
}

export default function AnalyticsPage() {
  const { activeProject } = useProject()
  
  const [activeTab, setActiveTab] = useState<'metrics' | 'ai'>('metrics')
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // AI states
  const [aiReport, setAiReport] = useState<string | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [copiedReport, setCopiedReport] = useState(false)
  const [isSimulatedAI, setIsSimulatedAI] = useState(false)

  const fetchAnalytics = async () => {
    if (!activeProject) {
      setData(null)
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/dashboard/analytics?projectId=${activeProject.id}`)
      if (res.ok) {
        const result = await res.json()
        setData(result)
      } else {
        setError('Failed to fetch analytics datasets')
      }
    } catch (e) {
      setError('An error occurred while loading analytics data')
    } finally {
      setLoading(false)
    }
  }

  const fetchAiAnalysis = async (forceRefetch = false) => {
    if (!activeProject || (aiReport && !forceRefetch)) return
    
    setAiLoading(true)
    setAiError(null)
    
    try {
      const res = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: activeProject.id }),
      })
      const result = await res.json()
      if (res.ok && result.success) {
        setAiReport(result.analysis)
        setIsSimulatedAI(result.isSimulated || false)
      } else {
        setAiError(result.error || 'Failed to generate AI insights')
      }
    } catch (e) {
      setAiError('A network error occurred while generating AI analysis')
    } finally {
      setAiLoading(false)
    }
  }

  useEffect(() => {
    fetchAnalytics()
    setAiReport(null) // Reset AI report on project switch
  }, [activeProject])

  useEffect(() => {
    if (activeTab === 'ai') {
      fetchAiAnalysis()
    }
  }, [activeTab])

  const handleCopyReport = () => {
    if (!aiReport) return
    navigator.clipboard.writeText(aiReport)
    setCopiedReport(true)
    setTimeout(() => setCopiedReport(false), 2000)
  }

  const getMethodColor = (m: string) => {
    if (m === 'GET') return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
    if (m === 'POST') return 'bg-blue-500/10 text-blue-400 border-blue-500/20'
    if (m === 'PUT') return 'bg-amber-500/10 text-amber-400 border-amber-500/20'
    if (m === 'DELETE') return 'bg-rose-500/10 text-rose-400 border-rose-500/20'
    return 'bg-secondary text-muted-foreground'
  }

  return (
    <DashboardShell>
      <div className="space-y-8 max-w-7xl">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-3xl font-extrabold tracking-tight">Analytics & AI Co-pilot</h2>
            <p className="text-muted-foreground text-sm mt-1">
              Explore traffic patterns, latency distributions, and AI-powered performance diagnostics.
            </p>
          </div>

          {/* Tabs switch */}
          <div className="flex bg-secondary/60 border border-border p-1 rounded-xl self-start">
            <button
              onClick={() => setActiveTab('metrics')}
              className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                activeTab === 'metrics'
                  ? 'bg-primary text-primary-foreground shadow'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Traffic Metrics
            </button>
            <button
              onClick={() => setActiveTab('ai')}
              className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center space-x-1 cursor-pointer ${
                activeTab === 'ai'
                  ? 'bg-primary text-primary-foreground shadow'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>AI Co-pilot Insights</span>
            </button>
          </div>
        </div>

        {/* Global Error */}
        {error && (
          <div className="p-4 bg-destructive/15 border border-destructive/20 text-destructive rounded-2xl flex items-center space-x-2 text-sm">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {!activeProject ? (
          <div className="glass rounded-3xl p-12 text-center border border-white/5">
            <TrendingUp className="h-12 w-12 text-muted-foreground/60 mx-auto mb-4" />
            <h3 className="text-lg font-bold">No active project</h3>
            <p className="text-muted-foreground text-sm mt-2">
              Select or create a project to view analytics.
            </p>
          </div>
        ) : loading ? (
          <div className="glass rounded-3xl p-12 text-center border border-white/5">
            <Loader2 className="h-8 w-8 text-primary animate-spin mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">Aggregating analytics data...</p>
          </div>
        ) : !data ? (
          <div className="glass rounded-3xl p-12 text-center border border-white/5">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h3 className="text-lg font-bold">No data found</h3>
            <p className="text-muted-foreground text-sm mt-2">
              An error occurred during data aggregation.
            </p>
          </div>
        ) : activeTab === 'metrics' ? (
          /* METRICS TAB */
          <div className="space-y-8">
            {data.isMock && (
              <div className="p-4 bg-primary/10 border border-primary/20 text-primary rounded-2xl flex items-center space-x-2 text-xs font-semibold animate-pulse">
                <Info className="h-4 w-4" />
                <span>Displaying simulated Demo data. Once clients call '/api/v1/*' carrying keys, live logs will render.</span>
              </div>
            )}

            {/* Charts section: Traffic & Uptime */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Traffic growth chart */}
              <div className="lg:col-span-2 glass rounded-[32px] border border-white/5 p-6 shadow-xl space-y-4">
                <div>
                  <h3 className="text-lg font-bold">Traffic Growth Volume</h3>
                  <p className="text-xs text-muted-foreground">Detailed daily request volume and errors count.</p>
                </div>
                <div className="h-80 w-full pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data.requestsOverTime} margin={{ left: -10, right: 10 }}>
                      <defs>
                        <linearGradient id="colorPrimary" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="date" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                      <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'rgba(15, 23, 42, 0.95)',
                          borderColor: 'rgba(255, 255, 255, 0.08)',
                          borderRadius: '12px',
                          color: '#fff',
                        }}
                      />
                      <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                      <Area type="monotone" name="Requests Volume" dataKey="requests" stroke="hsl(var(--primary))" strokeWidth={2.5} fill="url(#colorPrimary)" />
                      <Area type="monotone" name="Errors Triggered" dataKey="errors" stroke="hsl(var(--destructive))" strokeWidth={1.5} fill="none" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Status Code pie chart */}
              <div className="glass rounded-[32px] border border-white/5 p-6 shadow-xl flex flex-col justify-between space-y-4">
                <div>
                  <h3 className="text-lg font-bold">Status Code Distribution</h3>
                  <p className="text-xs text-muted-foreground">Proportion of responses returned by the gateway.</p>
                </div>
                <div className="h-60 w-full relative flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={data.statusDistribution}
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {data.statusDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'rgba(15, 23, 42, 0.95)',
                          borderColor: 'rgba(255, 255, 255, 0.08)',
                          borderRadius: '12px',
                          color: '#fff',
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                {/* Custom Legend */}
                <div className="grid grid-cols-3 gap-2 text-xs border-t border-border/40 pt-4">
                  {data.statusDistribution.map((item, idx) => (
                    <div key={item.name} className="flex items-center space-x-1.5 truncate">
                      <div className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                      <span className="text-muted-foreground truncate" title={item.name}>{item.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Performance charts section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Latency over time line chart */}
              <div className="lg:col-span-2 glass rounded-[32px] border border-white/5 p-6 shadow-xl space-y-4">
                <div>
                  <h3 className="text-lg font-bold">Latency Trends</h3>
                  <p className="text-xs text-muted-foreground">Historical average response speeds.</p>
                </div>
                <div className="h-80 w-full pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsLineChart data={data.requestsOverTime} margin={{ left: -10, right: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="date" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                      <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} unit="ms" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'rgba(15, 23, 42, 0.95)',
                          borderColor: 'rgba(255, 255, 255, 0.08)',
                          borderRadius: '12px',
                          color: '#fff',
                        }}
                      />
                      <Line type="monotone" name="Avg Latency (ms)" dataKey="avgLatency" stroke="#f59e0b" strokeWidth={2.5} dot={{ fill: '#f59e0b', strokeWidth: 1 }} />
                    </RechartsLineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Geographic Load Bar */}
              <div className="glass rounded-[32px] border border-white/5 p-6 shadow-xl space-y-4">
                <div>
                  <h3 className="text-lg font-bold">Geographic Traffic</h3>
                  <p className="text-xs text-muted-foreground">Requests origin distribution.</p>
                </div>
                <div className="h-80 w-full pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.geoData} layout="vertical" margin={{ left: 10, right: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(255,255,255,0.05)" />
                      <XAxis type="number" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                      <YAxis dataKey="country" type="category" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'rgba(15, 23, 42, 0.95)',
                          borderColor: 'rgba(255, 255, 255, 0.08)',
                          borderRadius: '12px',
                          color: '#fff',
                        }}
                      />
                      <Bar dataKey="requests" name="Requests count" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={12} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Tables section: Top Endpoints & Top Keys */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Top endpoints table */}
              <div className="glass rounded-[24px] border border-white/5 p-6 shadow-xl space-y-4">
                <div className="flex items-center space-x-2 text-sm font-semibold">
                  <Terminal className="h-5 w-5 text-primary" />
                  <span>Top API Endpoints by Volume</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-border/60 text-muted-foreground font-semibold uppercase tracking-wider py-2">
                        <th className="pb-2.5">Endpoint Path</th>
                        <th className="pb-2.5">Method</th>
                        <th className="pb-2.5 text-right">Volume</th>
                        <th className="pb-2.5 text-right">Avg Latency</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30">
                      {data.topEndpoints.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="py-4 text-center text-muted-foreground italic">
                            No endpoints accessed yet
                          </td>
                        </tr>
                      ) : (
                        data.topEndpoints.map((ep) => (
                          <tr key={ep.id || ep.url} className="hover:bg-secondary/10">
                            <td className="py-2.5 font-mono text-foreground font-medium truncate max-w-[180px]" title={ep.url}>
                              {ep.url}
                            </td>
                            <td className="py-2.5">
                              <span className={`px-1.5 py-0.5 rounded border text-[9px] font-bold ${getMethodColor(ep.method)}`}>
                                {ep.method}
                              </span>
                            </td>
                            <td className="py-2.5 text-right font-medium text-foreground">{ep.requests.toLocaleString()}</td>
                            <td className="py-2.5 text-right font-mono text-amber-400 font-semibold">{ep.avgLatency}ms</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Top Keys table */}
              <div className="glass rounded-[24px] border border-white/5 p-6 shadow-xl space-y-4">
                <div className="flex items-center space-x-2 text-sm font-semibold">
                  <Key className="h-5 w-5 text-primary" />
                  <span>Top API Keys by Volume</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-border/60 text-muted-foreground font-semibold uppercase tracking-wider py-2">
                        <th className="pb-2.5">API Key Name</th>
                        <th className="pb-2.5">Prefix Pattern</th>
                        <th className="pb-2.5 text-right">Volume</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30">
                      {data.topApiKeys.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="py-4 text-center text-muted-foreground italic">
                            No API Keys used yet
                          </td>
                        </tr>
                      ) : (
                        data.topApiKeys.map((key) => (
                          <tr key={key.id || key.prefix} className="hover:bg-secondary/10">
                            <td className="py-2.5 text-foreground font-medium truncate max-w-[180px]" title={key.name}>
                              {key.name}
                            </td>
                            <td className="py-2.5 font-mono text-muted-foreground">{key.prefix}•••</td>
                            <td className="py-2.5 text-right font-medium text-foreground">{key.requests.toLocaleString()}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* AI CO-PILOT TAB */
          <div className="space-y-6">
            {/* Header info */}
            <div className="bg-secondary/20 p-5 rounded-3xl border border-white/5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-primary/10 rounded-2xl text-primary animate-pulse">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-foreground">Intelligent Reliability Inspector</h3>
                  <p className="text-xs text-muted-foreground">Generates a detailed audit of your traffic logs and recommends rate limit configs.</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                {aiReport && (
                  <button
                    onClick={handleCopyReport}
                    className="px-3.5 py-2 bg-secondary/80 hover:bg-secondary border border-border text-foreground font-semibold rounded-xl text-xs transition-all flex items-center space-x-1 cursor-pointer"
                  >
                    {copiedReport ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-400" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        <span>Copy Report</span>
                      </>
                    )}
                  </button>
                )}
                
                <button
                  onClick={() => fetchAiAnalysis(true)}
                  disabled={aiLoading}
                  className="px-3.5 py-2 bg-primary hover:bg-primary/95 text-primary-foreground font-semibold rounded-xl text-xs transition-all flex items-center space-x-1.5 cursor-pointer disabled:opacity-55"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${aiLoading ? 'animate-spin' : ''}`} />
                  <span>Run Diagnostics</span>
                </button>
              </div>
            </div>

            {/* AI report display */}
            {aiLoading ? (
              <div className="glass rounded-[32px] border border-white/5 p-12 text-center shadow-xl space-y-4">
                <Loader2 className="h-10 w-10 text-primary animate-spin mx-auto" />
                <h4 className="text-base font-bold text-foreground">AI Co-pilot is analyzing metrics...</h4>
                <p className="text-muted-foreground text-xs max-w-sm mx-auto">
                  Running slow path detection, error spike analysis, and key security auditing on your request logs.
                </p>
                {/* Simulated progress indicator */}
                <div className="w-48 bg-secondary/60 h-1 rounded-full mx-auto overflow-hidden">
                  <div className="bg-primary h-full rounded-full animate-progress-bar w-1/3" />
                </div>
              </div>
            ) : aiError ? (
              <div className="glass rounded-[32px] border border-white/5 p-12 text-center shadow-xl">
                <AlertCircle className="h-10 w-10 text-destructive mx-auto mb-3" />
                <h4 className="text-base font-bold text-foreground">AI Diagnostics Failed</h4>
                <p className="text-muted-foreground text-xs mt-1 mb-6">{aiError}</p>
                <button
                  onClick={() => fetchAiAnalysis(true)}
                  className="px-4 py-2 bg-primary hover:bg-primary/95 text-primary-foreground font-semibold rounded-xl text-xs transition-all cursor-pointer"
                >
                  Retry Analysis
                </button>
              </div>
            ) : aiReport ? (
              <div className="glass rounded-[32px] border border-white/5 p-8 sm:p-10 shadow-2xl relative overflow-hidden prose max-w-none prose-invert">
                {/* Sparkle background accent */}
                <div className="absolute top-0 right-0 w-80 h-80 bg-primary/5 rounded-full blur-3xl -z-10" />
                
                {isSimulatedAI && (
                  <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-2xl flex items-center space-x-2 text-xs">
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    <span>
                      Demo Mode: To connect actual live Gemini analysis, please configure the <code className="bg-secondary/60 px-1 rounded text-[10px] text-amber-500">GEMINI_API_KEY</code> variable in your project <code className="bg-secondary/60 px-1 rounded text-[10px] text-amber-500">.env</code>.
                    </span>
                  </div>
                )}

                {/* Markdown body rendering */}
                <div className="space-y-1">
                  {renderMarkdown(aiReport)}
                </div>
              </div>
            ) : (
              <div className="glass rounded-[32px] border border-white/5 p-12 text-center shadow-xl">
                <Sparkles className="h-10 w-10 text-primary/70 animate-pulse mx-auto mb-3" />
                <h4 className="text-base font-bold text-foreground">No diagnostics report generated yet</h4>
                <p className="text-muted-foreground text-xs mt-1 mb-6">
                  Click the button below to analyze your project's performance metrics and security logs.
                </p>
                <button
                  onClick={() => fetchAiAnalysis()}
                  className="px-6 py-2.5 bg-primary hover:bg-primary/95 text-primary-foreground font-semibold rounded-xl text-xs transition-all shadow-md cursor-pointer inline-flex items-center space-x-1.5"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Analyze Project</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardShell>
  )
}
