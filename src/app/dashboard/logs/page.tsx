'use client'

import React, { useEffect, useState } from 'react'
import DashboardShell from '@/components/dashboard-shell'
import { useProject } from '@/lib/project-context'
import {
  Database,
  Search,
  Download,
  Filter,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Info,
  AlertTriangle,
  Clock,
  Globe,
  Tag,
  Loader2,
  XCircle,
} from 'lucide-react'

interface LogEntry {
  id: string
  timestamp: string
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS' | 'HEAD'
  statusCode: number
  responseTime: number
  ipAddress: string | null
  country: string | null
  userAgent: string | null
  errorDetails: string | null
  apiKey: {
    id: string
    name: string
    keyPrefix: string
  } | null
  endpoint: {
    id: string
    name: string
    url: string
  } | null
}

export default function LogsPage() {
  const { activeProject } = useProject()

  // Data states
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Filter lists (for dropdowns)
  const [apiKeys, setApiKeys] = useState<{ id: string; name: string }[]>([])
  const [endpoints, setEndpoints] = useState<{ id: string; name: string; url: string }[]>([])

  // Active filters state
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [status, setStatus] = useState('')
  const [method, setMethod] = useState('')
  const [apiKeyId, setApiKeyId] = useState('')
  const [endpointId, setEndpointId] = useState('')
  
  // Pagination
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalLogs, setTotalLogs] = useState(0)
  const limit = 20

  // Selected Log for detail modal
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null)

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 400)
    return () => clearTimeout(timer)
  }, [search])

  // Load filter options
  useEffect(() => {
    if (!activeProject) return

    // Fetch project API Keys
    fetch(`/api/api-keys?projectId=${activeProject.id}`)
      .then((res) => res.json())
      .then((data) => setApiKeys(data.apiKeys || []))
      .catch((e) => console.error(e))

    // Fetch project Endpoints
    fetch(`/api/endpoints?projectId=${activeProject.id}`)
      .then((res) => res.json())
      .then((data) => setEndpoints(data.endpoints || []))
      .catch((e) => console.error(e))
  }, [activeProject])

  // Fetch logs
  const fetchLogs = async () => {
    if (!activeProject) {
      setLogs([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)

    let url = `/api/logs?projectId=${activeProject.id}&page=${page}&limit=${limit}`
    if (debouncedSearch) url += `&search=${encodeURIComponent(debouncedSearch)}`
    if (status) url += `&status=${status}`
    if (method) url += `&method=${method}`
    if (apiKeyId) url += `&apiKeyId=${apiKeyId}`
    if (endpointId) url += `&endpointId=${endpointId}`

    try {
      const res = await fetch(url)
      if (res.ok) {
        const data = await res.json()
        setLogs(data.logs || [])
        setTotalLogs(data.pagination.total || 0)
        setTotalPages(data.pagination.pages || 1)
      } else {
        setError('Failed to fetch request logs')
      }
    } catch (e) {
      setError('An error occurred while loading logs')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLogs()
  }, [activeProject, page, debouncedSearch, status, method, apiKeyId, endpointId])

  const handleClearFilters = () => {
    setSearch('')
    setStatus('')
    setMethod('')
    setApiKeyId('')
    setEndpointId('')
    setPage(1)
  }

  // Generate CSV export URL with all current filters
  const getExportUrl = () => {
    if (!activeProject) return '#'
    let url = `/api/logs?projectId=${activeProject.id}&export=csv`
    if (debouncedSearch) url += `&search=${encodeURIComponent(debouncedSearch)}`
    if (status) url += `&status=${status}`
    if (method) url += `&method=${method}`
    if (apiKeyId) url += `&apiKeyId=${apiKeyId}`
    if (endpointId) url += `&endpointId=${endpointId}`
    return url
  }

  const getStatusColor = (code: number) => {
    if (code >= 200 && code < 300) return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
    if (code >= 300 && code < 400) return 'text-blue-400 bg-blue-500/10 border-blue-500/20'
    if (code === 429) return 'text-purple-400 bg-purple-500/10 border-purple-500/20 font-bold'
    if (code >= 400 && code < 500) return 'text-amber-400 bg-amber-500/10 border-amber-500/20'
    return 'text-rose-400 bg-rose-500/10 border-rose-500/20 font-semibold'
  }

  const getLatencyColor = (ms: number) => {
    if (ms < 150) return 'text-emerald-400 font-medium'
    if (ms < 500) return 'text-amber-400 font-medium'
    return 'text-rose-400 font-bold'
  }

  return (
    <DashboardShell>
      <div className="space-y-8 max-w-7xl">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-3xl font-extrabold tracking-tight">Request Logs</h2>
            <p className="text-muted-foreground text-sm mt-1">
              Inspect and query every HTTP request hitting your API gateway in real-time.
            </p>
          </div>
          <a
            href={getExportUrl()}
            download
            className={`px-4 py-2.5 bg-secondary/80 hover:bg-secondary border border-border text-foreground font-semibold rounded-xl transition-all shadow-sm flex items-center space-x-1.5 self-start cursor-pointer ${
              !activeProject || logs.length === 0 ? 'opacity-55 pointer-events-none' : ''
            }`}
          >
            <Download className="h-4 w-4" />
            <span>Export CSV</span>
          </a>
        </div>

        {/* Filter bar */}
        <div className="glass rounded-3xl border border-white/5 p-6 shadow-xl space-y-4">
          <div className="flex items-center space-x-2 text-sm font-semibold text-muted-foreground">
            <Filter className="h-4 w-4 text-primary" />
            <span>Filter Requests</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
            {/* Search Input */}
            <div className="md:col-span-2 relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <Search className="h-4 w-4 text-muted-foreground" />
              </span>
              <input
                type="text"
                placeholder="Search IP, Endpoint, Key name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-secondary/40 border border-border/80 rounded-xl text-foreground text-sm placeholder:text-muted-foreground/40 outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/60 transition-all"
              />
            </div>

            {/* Method filter */}
            <select
              value={method}
              onChange={(e) => {
                setMethod(e.target.value)
                setPage(1)
              }}
              className="px-3 py-2 bg-secondary/40 border border-border/80 rounded-xl text-foreground text-sm outline-none focus:border-primary/60 transition-all cursor-pointer"
            >
              <option value="">All Methods</option>
              <option value="GET">GET</option>
              <option value="POST">POST</option>
              <option value="PUT">PUT</option>
              <option value="DELETE">DELETE</option>
              <option value="PATCH">PATCH</option>
            </select>

            {/* Status filter */}
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value)
                setPage(1)
              }}
              className="px-3 py-2 bg-secondary/40 border border-border/80 rounded-xl text-foreground text-sm outline-none focus:border-primary/60 transition-all cursor-pointer"
            >
              <option value="">All Statuses</option>
              <option value="200">200 OK</option>
              <option value="201">201 Created</option>
              <option value="400">400 Bad Request</option>
              <option value="401">401 Unauthorized</option>
              <option value="403">403 Forbidden</option>
              <option value="429">429 Rate Limited</option>
              <option value="500">500 Server Error</option>
            </select>

            {/* API Key filter */}
            <select
              value={apiKeyId}
              onChange={(e) => {
                setApiKeyId(e.target.value)
                setPage(1)
              }}
              className="px-3 py-2 bg-secondary/40 border border-border/80 rounded-xl text-foreground text-sm outline-none focus:border-primary/60 transition-all cursor-pointer"
            >
              <option value="">All API Keys</option>
              {apiKeys.map((key) => (
                <option key={key.id} value={key.id}>
                  {key.name}
                </option>
              ))}
            </select>

            {/* Endpoint filter */}
            <select
              value={endpointId}
              onChange={(e) => {
                setEndpointId(e.target.value)
                setPage(1)
              }}
              className="px-3 py-2 bg-secondary/40 border border-border/80 rounded-xl text-foreground text-sm outline-none focus:border-primary/60 transition-all cursor-pointer"
            >
              <option value="">All Endpoints</option>
              {endpoints.map((ep) => (
                <option key={ep.id} value={ep.id}>
                  {ep.method} {ep.url}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-between items-center pt-2 text-xs text-muted-foreground">
            <div>
              Showing {logs.length} of <span className="font-semibold text-foreground">{totalLogs}</span> entries
            </div>

            {(search || status || method || apiKeyId || endpointId) && (
              <button
                onClick={handleClearFilters}
                className="text-primary hover:text-primary/80 font-semibold transition-all cursor-pointer outline-none"
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>

        {/* Logs Table */}
        {!activeProject ? (
          <div className="glass rounded-3xl p-12 text-center border border-white/5">
            <Database className="h-12 w-12 text-muted-foreground/60 mx-auto mb-4" />
            <h3 className="text-lg font-bold">No active project</h3>
            <p className="text-muted-foreground text-sm mt-2">
              Select a project to view request logs.
            </p>
          </div>
        ) : loading ? (
          <div className="glass rounded-3xl border border-white/5 overflow-hidden p-6 text-center">
            <Loader2 className="h-8 w-8 text-primary animate-spin mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">Fetching request logs...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="glass rounded-3xl border border-white/5 p-12 text-center">
            <Database className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
            <h3 className="text-lg font-bold">No logs matching filters</h3>
            <p className="text-muted-foreground text-sm mt-2">
              Make requests to `/api/v1/*` carrying your project API key to generate logs.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="glass rounded-[24px] border border-white/5 overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-secondary/40 border-b border-border/60 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      <th className="py-3.5 px-4">Timestamp</th>
                      <th className="py-3.5 px-4">Endpoint</th>
                      <th className="py-3.5 px-4">API Key</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4 text-right">Latency</th>
                      <th className="py-3.5 px-4">IP / Geo</th>
                      <th className="py-3.5 px-4"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {logs.map((log) => {
                      const date = new Date(log.timestamp)
                      const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                      const dateStr = date.toLocaleDateString([], { month: 'short', day: '2-digit' })

                      return (
                        <tr
                          key={log.id}
                          className="hover:bg-secondary/15 transition-all cursor-pointer group"
                          onClick={() => setSelectedLog(log)}
                        >
                          <td className="py-3.5 px-4 whitespace-nowrap text-xs">
                            <div className="font-medium text-foreground">{dateStr}</div>
                            <div className="text-muted-foreground mt-0.5">{timeStr}</div>
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <div className="flex items-center space-x-2">
                              <span className="px-1.5 py-0.5 bg-secondary text-muted-foreground border border-border/80 rounded font-mono text-[10px] font-extrabold uppercase">
                                {log.method}
                              </span>
                              <span className="font-mono text-xs text-foreground max-w-[180px] truncate">
                                {log.endpoint?.url || (log.errorDetails?.includes('Rate') ? 'Rate Limited' : 'Unknown Route')}
                              </span>
                            </div>
                            <div className="text-[10px] text-muted-foreground mt-0.5 truncate max-w-[200px]">
                              {log.endpoint?.name || 'Gateway Intercept'}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap text-xs">
                            <div className="font-medium text-foreground">{log.apiKey?.name || 'N/A'}</div>
                            <div className="text-muted-foreground font-mono mt-0.5">{log.apiKey?.keyPrefix ? `${log.apiKey.keyPrefix}•••` : '—'}</div>
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <span
                              className={`px-2 py-0.5 rounded text-xs font-semibold border ${getStatusColor(
                                log.statusCode
                              )}`}
                            >
                              {log.statusCode}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap text-right font-mono text-xs">
                            <span className={getLatencyColor(log.responseTime)}>
                              {log.responseTime === 0 ? '—' : `${log.responseTime}ms`}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap text-xs">
                            <div className="text-foreground font-medium">{log.ipAddress || '127.0.0.1'}</div>
                            <div className="text-muted-foreground text-[10px] uppercase font-bold flex items-center space-x-1 mt-0.5">
                              <Globe className="h-3 w-3 text-muted-foreground/60" />
                              <span>{log.country || 'US'}</span>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <span className="text-[11px] text-primary group-hover:underline opacity-0 group-hover:opacity-100 transition-all font-semibold pr-2">
                              Inspect
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-4">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="px-3.5 py-2 border border-border bg-card hover:bg-secondary rounded-xl text-sm transition-all disabled:opacity-45 cursor-pointer flex items-center space-x-1"
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span>Prev</span>
                </button>

                <div className="text-xs text-muted-foreground">
                  Page <span className="font-semibold text-foreground">{page}</span> of{' '}
                  <span className="font-semibold text-foreground">{totalPages}</span>
                </div>

                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="px-3.5 py-2 border border-border bg-card hover:bg-secondary rounded-xl text-sm transition-all disabled:opacity-45 cursor-pointer flex items-center space-x-1"
                >
                  <span>Next</span>
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Detailed Log Modal Inspector */}
        {selectedLog && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-card border border-border rounded-3xl w-full max-w-2xl p-6 shadow-2xl relative overflow-hidden max-h-[85vh] overflow-y-auto">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary to-indigo-500" />
              
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-lg font-bold">Request Transaction Inspector</h3>
                  <p className="text-xs text-muted-foreground font-mono mt-0.5">{selectedLog.id}</p>
                </div>
                <button
                  onClick={() => setSelectedLog(null)}
                  className="p-1.5 hover:bg-secondary border border-border rounded-lg text-muted-foreground hover:text-foreground transition-all cursor-pointer outline-none"
                >
                  <XCircle className="h-5 w-5" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                {/* Meta details */}
                <div className="space-y-4">
                  <div className="bg-secondary/35 border border-border/50 rounded-2xl p-4 space-y-3">
                    <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">General info</div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Timestamp</span>
                      <span className="font-medium">{new Date(selectedLog.timestamp).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Method</span>
                      <span className="px-1.5 py-0.5 bg-secondary border border-border rounded font-mono text-[10px] font-bold">
                        {selectedLog.method}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Status Code</span>
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold border ${getStatusColor(selectedLog.statusCode)}`}>
                        {selectedLog.statusCode}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Response Time</span>
                      <span className={`font-mono ${getLatencyColor(selectedLog.responseTime)}`}>
                        {selectedLog.responseTime} ms
                      </span>
                    </div>
                  </div>

                  <div className="bg-secondary/35 border border-border/50 rounded-2xl p-4 space-y-3">
                    <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Routing</div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Matched Endpoint</span>
                      <span className="font-medium text-right max-w-[180px] truncate">
                        {selectedLog.endpoint?.name || 'N/A (Intercepted)'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Registered Path</span>
                      <span className="font-mono text-xs">{selectedLog.endpoint?.url || '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">API Access Key</span>
                      <span className="font-medium">{selectedLog.apiKey?.name || 'N/A'}</span>
                    </div>
                  </div>
                </div>

                {/* Client / User Agent details */}
                <div className="space-y-4">
                  <div className="bg-secondary/35 border border-border/50 rounded-2xl p-4 space-y-3">
                    <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Client Context</div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">IP Address</span>
                      <span className="font-mono font-medium">{selectedLog.ipAddress || '127.0.0.1'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Origin Region</span>
                      <span className="font-semibold uppercase text-xs flex items-center space-x-1">
                        <Globe className="h-3.5 w-3.5 text-muted-foreground/60 mr-1" />
                        <span>{selectedLog.country || 'US'}</span>
                      </span>
                    </div>
                    <div className="pt-2 border-t border-border/40">
                      <span className="text-muted-foreground block mb-1">User Agent string</span>
                      <span className="text-xs text-foreground bg-card border border-border/60 p-2 rounded-lg font-mono block break-words max-h-24 overflow-y-auto">
                        {selectedLog.userAgent || 'Unknown'}
                      </span>
                    </div>
                  </div>

                  {/* Errors display */}
                  {selectedLog.errorDetails && (
                    <div className="p-4 bg-destructive/10 border border-destructive/20 text-destructive rounded-2xl space-y-1">
                      <div className="text-xs font-bold uppercase tracking-wider flex items-center space-x-1">
                        <AlertTriangle className="h-4 w-4" />
                        <span>Error Logged</span>
                      </div>
                      <p className="text-xs font-medium font-mono leading-relaxed break-words">{selectedLog.errorDetails}</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-border flex justify-end">
                <button
                  onClick={() => setSelectedLog(null)}
                  className="px-5 py-2 bg-secondary border border-border hover:bg-secondary/80 text-foreground font-semibold rounded-xl text-sm transition-all cursor-pointer"
                >
                  Close Inspector
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardShell>
  )
}
