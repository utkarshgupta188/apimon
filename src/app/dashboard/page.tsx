'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import DashboardShell from '@/components/dashboard-shell'
import { useProject } from '@/lib/project-context'
import {
  Activity,
  Terminal,
  Key,
  Database,
  TrendingUp,
  Clock,
  ShieldCheck,
  AlertTriangle,
  Zap,
  ArrowUpRight,
  TrendingDown,
  Sparkles,
  Loader2,
} from 'lucide-react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'

interface DashboardStats {
  totalProjects: number
  activeApis: number
  totalRequests: number
  requestsToday: number
  successRate: number
  errorRate: number
  avgResponseTime: number
  activeApiKeys: number
  uptimePercent: number
  rateLimitedRequests: number
}

interface AnalyticsChartData {
  date: string
  requests: number
  errors: number
  avgLatency: number
}

export default function DashboardOverview() {
  const { activeProject, loading: projectsLoading } = useProject()
  
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [chartData, setChartData] = useState<AnalyticsChartData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = async () => {
    if (!activeProject) {
      setStats(null)
      setChartData([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)

    try {
      const [statsRes, analyticsRes] = await Promise.all([
        fetch(`/api/dashboard/stats?projectId=${activeProject.id}`),
        fetch(`/api/dashboard/analytics?projectId=${activeProject.id}`),
      ])

      if (statsRes.ok && analyticsRes.ok) {
        const statsData = await statsRes.json()
        const analyticsData = await analyticsRes.json()
        
        setStats(statsData.stats)
        setChartData(analyticsData.requestsOverTime || [])
      } else {
        setError('Failed to fetch dashboard metrics')
      }
    } catch (e) {
      setError('An error occurred while loading dashboard metrics')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [activeProject])

  if (projectsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
      </div>
    )
  }

  return (
    <DashboardShell>
      <div className="space-y-8 max-w-7xl">
        {/* Top welcome row */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-3xl font-extrabold tracking-tight">Dashboard</h2>
            <p className="text-muted-foreground text-sm mt-1">
              Active project:{' '}
              <span className="font-semibold text-foreground">
                {activeProject?.name || 'No Project Selected'}
              </span>{' '}
              ({activeProject?.environment.toLowerCase()})
            </p>
          </div>
          
          <Link
            href="/dashboard/analytics"
            className="px-4 py-2.5 bg-secondary/80 hover:bg-secondary border border-border text-foreground font-semibold rounded-xl text-sm transition-all shadow-sm flex items-center space-x-1.5 self-start cursor-pointer"
          >
            <span>Detailed Analytics</span>
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>

        {/* 1. Core metric cards grid */}
        {!activeProject ? (
          <div className="glass rounded-3xl p-12 text-center border border-white/5 shadow-xl">
            <Activity className="h-12 w-12 text-muted-foreground/60 mx-auto mb-4" />
            <h3 className="text-lg font-bold">Welcome to APIMon</h3>
            <p className="text-muted-foreground text-sm mt-2 max-w-md mx-auto mb-6">
              Create your first project from the sidebar to manage API keys, configure rate limiting, and track server-side metrics.
            </p>
          </div>
        ) : loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="glass rounded-3xl p-6 border border-white/5 space-y-4 animate-pulse">
                <div className="h-4 bg-secondary/80 rounded w-1/3" />
                <div className="h-8 bg-secondary/60 rounded w-2/3" />
              </div>
            ))}
          </div>
        ) : !stats ? (
          <div className="glass rounded-3xl p-12 text-center border border-white/5 shadow-xl">
            <AlertTriangle className="h-12 w-12 text-destructive/60 mx-auto mb-4" />
            <h3 className="text-lg font-bold">Failed to load statistics</h3>
            <p className="text-muted-foreground text-sm mt-2">
              There was a database problem fetching stats.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Card 1: Uptime */}
              <div className="glass rounded-3xl p-6 border border-white/5 shadow-md flex items-center justify-between relative overflow-hidden group hover:border-primary/20 transition-all">
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Uptime Monitor</span>
                  <div className="text-2xl font-extrabold text-foreground mt-1">
                    {stats.uptimePercent.toFixed(2)}%
                  </div>
                  <p className="text-[10px] text-emerald-400 font-semibold flex items-center">
                    <ShieldCheck className="h-3 w-3 mr-0.5" />
                    <span>All services running</span>
                  </p>
                </div>
                <div className="p-3 bg-emerald-500/10 rounded-2xl text-emerald-400 group-hover:scale-110 transition-transform">
                  <Activity className="h-6 w-6 animate-pulse" />
                </div>
              </div>

              {/* Card 2: Total Requests */}
              <div className="glass rounded-3xl p-6 border border-white/5 shadow-md flex items-center justify-between relative overflow-hidden group hover:border-primary/20 transition-all">
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total / Today</span>
                  <div className="text-2xl font-extrabold text-foreground mt-1">
                    {stats.totalRequests.toLocaleString()}{' '}
                    <span className="text-sm font-normal text-muted-foreground">
                      / {stats.requestsToday} today
                    </span>
                  </div>
                  <p className="text-[10px] text-primary font-semibold flex items-center">
                    <TrendingUp className="h-3 w-3 mr-0.5" />
                    <span>Active Gateway traffic</span>
                  </p>
                </div>
                <div className="p-3 bg-primary/10 rounded-2xl text-primary group-hover:scale-110 transition-transform">
                  <Database className="h-6 w-6" />
                </div>
              </div>

              {/* Card 3: Success Rate */}
              <div className="glass rounded-3xl p-6 border border-white/5 shadow-md flex items-center justify-between relative overflow-hidden group hover:border-primary/20 transition-all">
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Success / Errors</span>
                  <div className="text-2xl font-extrabold text-foreground mt-1">
                    {stats.successRate.toFixed(1)}%{' '}
                    <span className="text-sm font-normal text-muted-foreground">
                      / {stats.errorRate.toFixed(1)}% err
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground flex items-center">
                    <span>Healthy API Gateway responses</span>
                  </p>
                </div>
                <div className="p-3 bg-blue-500/10 rounded-2xl text-blue-400 group-hover:scale-110 transition-transform">
                  <ShieldCheck className="h-6 w-6" />
                </div>
              </div>

              {/* Card 4: Avg Latency */}
              <div className="glass rounded-3xl p-6 border border-white/5 shadow-md flex items-center justify-between relative overflow-hidden group hover:border-primary/20 transition-all">
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Avg Latency</span>
                  <div className="text-2xl font-extrabold text-foreground mt-1">
                    {Math.round(stats.avgResponseTime)} ms
                  </div>
                  <p className="text-[10px] text-amber-400 font-semibold flex items-center">
                    <Clock className="h-3 w-3 mr-0.5" />
                    <span>Real-time response</span>
                  </p>
                </div>
                <div className="p-3 bg-amber-500/10 rounded-2xl text-amber-400 group-hover:scale-110 transition-transform">
                  <Clock className="h-6 w-6" />
                </div>
              </div>
            </div>

            {/* Micro details metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-secondary/20 p-5 rounded-3xl border border-white/5">
              <div className="text-center p-2 border-r border-border/50">
                <div className="text-xs text-muted-foreground uppercase font-bold">Active APIs</div>
                <div className="text-xl font-extrabold mt-0.5">{stats.activeApis}</div>
              </div>
              <div className="text-center p-2 sm:border-r border-border/50">
                <div className="text-xs text-muted-foreground uppercase font-bold">API Keys</div>
                <div className="text-xl font-extrabold mt-0.5">{stats.activeApiKeys}</div>
              </div>
              <div className="text-center p-2 border-r border-border/50">
                <div className="text-xs text-muted-foreground uppercase font-bold">Rate Limits Blocked</div>
                <div className="text-xl font-extrabold text-purple-400 mt-0.5">{stats.rateLimitedRequests}</div>
              </div>
              <div className="text-center p-2">
                <div className="text-xs text-muted-foreground uppercase font-bold">Status</div>
                <div className="text-xs font-bold text-emerald-400 bg-emerald-400/10 w-fit mx-auto px-2 py-0.5 rounded-full mt-1.5 flex items-center space-x-1">
                  <div className="h-1.5 w-1.5 bg-emerald-400 rounded-full animate-ping" />
                  <span>ONLINE</span>
                </div>
              </div>
            </div>

            {/* 2. Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Chart 1: Traffic Volume Area */}
              <div className="glass rounded-[32px] border border-white/5 p-6 shadow-xl space-y-4">
                <div>
                  <h3 className="text-lg font-bold text-foreground">Requests over time</h3>
                  <p className="text-xs text-muted-foreground">Volume of successful vs errored API calls (last 7 days).</p>
                </div>
                <div className="h-80 w-full pt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ left: -10, right: 10, top: 10, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorRequests" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="colorErrors" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--destructive))" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="hsl(var(--destructive))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="date" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                      <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'rgba(15, 23, 42, 0.9)',
                          borderColor: 'rgba(255, 255, 255, 0.08)',
                          borderRadius: '12px',
                          color: '#fff',
                        }}
                      />
                      <Area
                        type="monotone"
                        name="Requests"
                        dataKey="requests"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#colorRequests)"
                      />
                      <Area
                        type="monotone"
                        name="Errors"
                        dataKey="errors"
                        stroke="hsl(var(--destructive))"
                        strokeWidth={1.5}
                        fillOpacity={1}
                        fill="url(#colorErrors)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Chart 2: Latency Line */}
              <div className="glass rounded-[32px] border border-white/5 p-6 shadow-xl space-y-4">
                <div>
                  <h3 className="text-lg font-bold text-foreground">Response Latency Graph</h3>
                  <p className="text-xs text-muted-foreground">Rolling average response times in milliseconds (last 7 days).</p>
                </div>
                <div className="h-80 w-full pt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ left: -10, right: 10, top: 10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="date" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                      <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} unit="ms" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'rgba(15, 23, 42, 0.9)',
                          borderColor: 'rgba(255, 255, 255, 0.08)',
                          borderRadius: '12px',
                          color: '#fff',
                        }}
                      />
                      <Line
                        type="monotone"
                        name="Latency"
                        dataKey="avgLatency"
                        stroke="#f59e0b"
                        strokeWidth={2}
                        dot={{ fill: '#f59e0b', strokeWidth: 1 }}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardShell>
  )
}
