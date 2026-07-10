'use client'

import React, { useEffect, useState } from 'react'
import DashboardShell from '@/components/dashboard-shell'
import { useProject } from '@/lib/project-context'
import { useAuth } from '@/lib/auth-context'
import {
  Terminal,
  Plus,
  Edit2,
  Trash2,
  Play,
  ToggleLeft,
  ToggleRight,
  Tag,
  Clock,
  Activity,
  CheckCircle,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Hash,
} from 'lucide-react'

interface Monitor {
  id: string
  intervalSecond: number
  isActive: boolean
  lastCheckedAt: string | null
  lastStatusCode: number | null
  lastLatency: number | null
  uptimePercent: number
}

interface Endpoint {
  id: string
  name: string
  url: string
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS' | 'HEAD'
  description: string | null
  expectedStatus: number
  timeout: number
  enabled: boolean
  tags: string[]
  createdAt: string
  monitors: Monitor[]
}

export default function EndpointsPage() {
  const { user } = useAuth()
  const { activeProject } = useProject()

  // State
  const [endpoints, setEndpoints] = useState<Endpoint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Creation modal state
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [method, setMethod] = useState<'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'>('GET')
  const [description, setDescription] = useState('')
  const [expectedStatus, setExpectedStatus] = useState('200')
  const [timeout, setTimeoutVal] = useState('10000')
  const [tagsInput, setTagsInput] = useState('')
  const [enabled, setEnabled] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  // Testing endpoint state
  const [testingId, setTestingId] = useState<string | null>(null)

  const fetchEndpoints = async () => {
    if (!activeProject) {
      setEndpoints([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/endpoints?projectId=${activeProject.id}`)
      if (res.ok) {
        const data = await res.json()
        setEndpoints(data.endpoints || [])
      } else {
        setError('Failed to fetch endpoints')
      }
    } catch (e) {
      setError('An error occurred while loading endpoints')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchEndpoints()
  }, [activeProject])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeProject) return
    setError(null)
    setSuccess(null)
    setSubmitting(true)

    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0)

    const payload = {
      projectId: activeProject.id,
      name,
      url,
      method,
      description: description || null,
      expectedStatus: parseInt(expectedStatus) || 200,
      timeout: parseInt(timeout) || 10000,
      enabled,
      tags,
    }

    try {
      const res = await fetch('/api/endpoints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setSuccess(`Endpoint "${method} ${url}" created successfully`)
        setCreateModalOpen(false)
        // Reset form
        setName('')
        setUrl('')
        setMethod('GET')
        setDescription('')
        setExpectedStatus('200')
        setTimeoutVal('10000')
        setTagsInput('')
        setEnabled(true)
        fetchEndpoints()
      } else {
        setError(data.error || 'Failed to create endpoint')
      }
    } catch (err) {
      setError('A network error occurred')
    } finally {
      setSubmitting(false)
    }
  }

  const handleToggleEnabled = async (id: string, currentEnabled: boolean) => {
    setError(null)
    setSuccess(null)

    try {
      const res = await fetch(`/api/endpoints?id=${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !currentEnabled }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setEndpoints((prev) =>
          prev.map((e) => (e.id === id ? { ...e, enabled: !currentEnabled } : e))
        )
        setSuccess('Endpoint status updated')
      } else {
        setError(data.error || 'Failed to toggle endpoint status')
      }
    } catch (err) {
      setError('Network error occurred')
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete the endpoint "${name}"?`)) return
    setError(null)
    setSuccess(null)

    try {
      const res = await fetch(`/api/endpoints?id=${id}`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setSuccess('Endpoint deleted successfully')
        fetchEndpoints()
      } else {
        setError(data.error || 'Failed to delete endpoint')
      }
    } catch (err) {
      setError('Network error occurred')
    }
  }

  // Trigger simulated ping test for the monitor
  const handleTestPing = async (endpointId: string) => {
    setTestingId(endpointId)
    setError(null)
    setSuccess(null)

    try {
      const res = await fetch(`/api/monitors/test?endpointId=${endpointId}`, {
        method: 'POST',
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setSuccess(`Ping check completed for endpoint. Latency: ${data.latency}ms. Status: ${data.statusCode}`)
        fetchEndpoints()
      } else {
        setError(data.error || 'Failed to run ping test')
      }
    } catch (err) {
      setError('A network error occurred during test')
    } finally {
      setTestingId(null)
    }
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
      <div className="space-y-8 max-w-6xl">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-3xl font-extrabold tracking-tight">API Endpoints</h2>
            <p className="text-muted-foreground text-sm mt-1">
              Register targets to monitor their uptime, DNS resolution, and SSL status.
            </p>
          </div>
          <button
            onClick={() => setCreateModalOpen(true)}
            disabled={!activeProject}
            className="px-4 py-2.5 bg-primary hover:bg-primary/95 text-primary-foreground font-semibold rounded-xl transition-all shadow-md flex items-center space-x-1.5 self-start cursor-pointer disabled:opacity-55"
          >
            <Plus className="h-5 w-5" />
            <span>Add Endpoint</span>
          </button>
        </div>

        {/* Global Feedback */}
        {error && (
          <div className="p-4 bg-destructive/15 border border-destructive/20 text-destructive rounded-2xl flex items-center space-x-2 text-sm">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="p-4 bg-emerald-500/15 border border-emerald-500/20 text-emerald-400 rounded-2xl flex items-center space-x-2 text-sm">
            <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
            <span>{success}</span>
          </div>
        )}

        {/* main display */}
        {!activeProject ? (
          <div className="glass rounded-3xl p-12 text-center border border-white/5">
            <Terminal className="h-12 w-12 text-muted-foreground/60 mx-auto mb-4" />
            <h3 className="text-lg font-bold">No active project</h3>
            <p className="text-muted-foreground text-sm mt-2">
              Create a project to start registering API endpoints.
            </p>
          </div>
        ) : loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[1, 2].map((i) => (
              <div key={i} className="glass rounded-3xl p-6 border border-white/5 space-y-4 animate-pulse">
                <div className="h-5 bg-secondary/80 rounded w-1/4" />
                <div className="h-4 bg-secondary/60 rounded w-3/4" />
                <div className="h-12 bg-secondary/50 rounded w-full" />
              </div>
            ))}
          </div>
        ) : endpoints.length === 0 ? (
          <div className="glass rounded-3xl p-12 text-center border border-white/5 shadow-xl">
            <Terminal className="h-12 w-12 text-muted-foreground/60 mx-auto mb-4" />
            <h3 className="text-lg font-bold">No endpoints registered</h3>
            <p className="text-muted-foreground text-sm mt-2 mb-6">
              Create your first API route pattern to test routing and enable uptime monitoring pings.
            </p>
            <button
              onClick={() => setCreateModalOpen(true)}
              className="px-6 py-3 bg-primary hover:bg-primary/95 text-primary-foreground font-semibold rounded-2xl transition-all shadow-md cursor-pointer inline-flex items-center space-x-1.5"
            >
              <Plus className="h-5 w-5" />
              <span>Register First Route</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {endpoints.map((ep) => {
              const monitor = ep.monitors[0]
              const hasChecked = monitor && monitor.lastCheckedAt

              return (
                <div
                  key={ep.id}
                  className={`glass rounded-3xl border border-white/5 p-6 shadow-xl flex flex-col justify-between hover:border-primary/20 transition-all ${
                    !ep.enabled ? 'opacity-70' : ''
                  }`}
                >
                  <div className="space-y-4">
                    {/* Title and Method Row */}
                    <div className="flex items-center justify-between gap-4">
                      <div className="truncate">
                        <h4 className="font-bold text-lg text-foreground truncate">{ep.name}</h4>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">{ep.description || 'No description provided'}</p>
                      </div>

                      {/* Enabled Toggle */}
                      <button
                        onClick={() => handleToggleEnabled(ep.id, ep.enabled)}
                        className="text-muted-foreground hover:text-foreground transition-all cursor-pointer outline-none"
                        title={ep.enabled ? 'Disable Endpoint' : 'Enable Endpoint'}
                      >
                        {ep.enabled ? (
                          <ToggleRight className="h-8 w-8 text-primary" />
                        ) : (
                          <ToggleLeft className="h-8 w-8 text-muted-foreground/60" />
                        )}
                      </button>
                    </div>

                    {/* Method Badge & Path URL */}
                    <div className="flex items-center space-x-2.5">
                      <span
                        className={`px-2 py-0.5 rounded-lg text-xs font-extrabold uppercase border ${getMethodColor(
                          ep.method
                        )}`}
                      >
                        {ep.method}
                      </span>
                      <span className="font-mono text-sm text-foreground bg-secondary/40 px-2 py-1 rounded-lg border border-border/80 truncate max-w-xs">
                        {ep.url}
                      </span>
                    </div>

                    {/* Tags */}
                    {ep.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {ep.tags.map((tag) => (
                          <span
                            key={tag}
                            className="px-2 py-0.5 bg-secondary text-muted-foreground rounded-md text-[10px] font-semibold flex items-center space-x-1"
                          >
                            <Tag className="h-2.5 w-2.5 text-muted-foreground/60" />
                            <span>{tag}</span>
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Monitor Live Status Panel */}
                    <div className="bg-secondary/25 border border-border/60 rounded-2xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center space-x-1">
                          <Activity className="h-3.5 w-3.5 text-primary" />
                          <span>Monitor Status</span>
                        </div>
                        {monitor && (
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-extrabold border uppercase tracking-wider ${
                              !monitor.isActive
                                ? 'bg-secondary text-muted-foreground'
                                : monitor.lastStatusCode === ep.expectedStatus
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                : monitor.lastStatusCode
                                ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                                : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                            }`}
                          >
                            {!monitor.isActive ? 'Inactive' : monitor.lastStatusCode === ep.expectedStatus ? 'Healthy' : 'Error'}
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="bg-secondary/45 border border-border/40 p-2 rounded-xl">
                          <div className="text-[10px] text-muted-foreground uppercase font-bold">Uptime</div>
                          <div className="text-sm font-extrabold text-foreground mt-0.5">
                            {monitor ? `${monitor.uptimePercent.toFixed(1)}%` : '100%'}
                          </div>
                        </div>
                        <div className="bg-secondary/45 border border-border/40 p-2 rounded-xl">
                          <div className="text-[10px] text-muted-foreground uppercase font-bold">Latency</div>
                          <div className="text-sm font-extrabold text-foreground mt-0.5">
                            {hasChecked ? `${monitor.lastLatency}ms` : '—'}
                          </div>
                        </div>
                        <div className="bg-secondary/45 border border-border/40 p-2 rounded-xl">
                          <div className="text-[10px] text-muted-foreground uppercase font-bold">Status</div>
                          <div className="text-sm font-extrabold text-foreground mt-0.5">
                            {hasChecked ? monitor.lastStatusCode : '—'}
                          </div>
                        </div>
                      </div>

                      {hasChecked && (
                        <div className="text-[10px] text-muted-foreground flex items-center justify-end">
                          <Clock className="h-3 w-3 mr-1 text-muted-foreground/60" />
                          <span>Checked {new Date(monitor.lastCheckedAt!).toLocaleTimeString()}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions row */}
                  <div className="border-t border-border/40 pt-4 mt-6 flex items-center justify-between gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center">
                      <Clock className="h-3.5 w-3.5 mr-1" />
                      Timeout: {ep.timeout}ms
                    </span>

                    <div className="flex items-center space-x-2.5">
                      <button
                        onClick={() => handleTestPing(ep.id)}
                        disabled={testingId === ep.id || !ep.enabled}
                        className="p-2 hover:bg-secondary border border-border/80 rounded-xl transition-all cursor-pointer flex items-center space-x-1.5 disabled:opacity-55"
                        title="Simulate check ping now"
                      >
                        {testingId === ep.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Play className="h-3.5 w-3.5 text-primary" />
                        )}
                        <span className="hidden sm:inline">Test Ping</span>
                      </button>
                      <button
                        onClick={() => handleDelete(ep.id, ep.name)}
                        className="p-2 text-destructive hover:bg-destructive/10 border border-transparent rounded-xl transition-all cursor-pointer"
                        title="Delete Endpoint"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Creation Modal */}
        {createModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-card border border-border rounded-3xl w-full max-w-lg p-6 shadow-2xl relative overflow-hidden max-h-[90vh] overflow-y-auto">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary to-indigo-500" />
              <h3 className="text-lg font-bold mb-4">Register New Endpoint</h3>

              <form onSubmit={handleCreate} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      Endpoint Name
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="E.g. Fetch Users List"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-secondary/40 border border-border/80 rounded-xl text-foreground text-sm placeholder:text-muted-foreground/45 outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/60 transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      HTTP Method
                    </label>
                    <select
                      value={method}
                      onChange={(e) => setMethod(e.target.value as any)}
                      className="w-full px-3 py-2.5 bg-secondary/40 border border-border/80 rounded-xl text-foreground text-sm outline-none focus:border-primary/60 transition-all cursor-pointer"
                    >
                      <option value="GET">GET</option>
                      <option value="POST">POST</option>
                      <option value="PUT">PUT</option>
                      <option value="DELETE">DELETE</option>
                      <option value="PATCH">PATCH</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      Path Pattern
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="E.g. /users"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      className="w-full px-3.5 py-2 bg-secondary/40 border border-border/80 rounded-xl text-foreground text-sm placeholder:text-muted-foreground/30 outline-none focus:border-primary/60 transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      Expected HTTP Status
                    </label>
                    <input
                      type="number"
                      required
                      placeholder="E.g. 200"
                      value={expectedStatus}
                      onChange={(e) => setExpectedStatus(e.target.value)}
                      className="w-full px-3.5 py-2 bg-secondary/40 border border-border/80 rounded-xl text-foreground text-sm placeholder:text-muted-foreground/30 outline-none focus:border-primary/60 transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      Timeout (ms)
                    </label>
                    <input
                      type="number"
                      required
                      placeholder="E.g. 10000"
                      value={timeout}
                      onChange={(e) => setTimeoutVal(e.target.value)}
                      className="w-full px-3.5 py-2 bg-secondary/40 border border-border/80 rounded-xl text-foreground text-sm placeholder:text-muted-foreground/30 outline-none focus:border-primary/60 transition-all"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      Tags (Comma-separated)
                    </label>
                    <input
                      type="text"
                      placeholder="E.g. v1, auth, core"
                      value={tagsInput}
                      onChange={(e) => setTagsInput(e.target.value)}
                      className="w-full px-3.5 py-2 bg-secondary/40 border border-border/80 rounded-xl text-foreground text-sm placeholder:text-muted-foreground/30 outline-none focus:border-primary/60 transition-all"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      Description
                    </label>
                    <textarea
                      placeholder="Optional details about request/response..."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-secondary/40 border border-border/80 rounded-xl text-foreground text-sm placeholder:text-muted-foreground/40 outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/60 transition-all h-20 resize-none"
                    />
                  </div>
                </div>

                <div className="flex space-x-3 pt-4 border-t border-border/50">
                  <button
                    type="button"
                    onClick={() => setCreateModalOpen(false)}
                    className="w-1/2 py-2.5 border border-border hover:bg-secondary/80 text-foreground font-semibold rounded-xl transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || !name || !url}
                    className="w-1/2 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-xl transition-all flex items-center justify-center disabled:opacity-60 cursor-pointer"
                  >
                    {submitting ? (
                      <Loader2 className="h-4.5 w-4.5 animate-spin" />
                    ) : (
                      'Register Endpoint'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </DashboardShell>
  )
}
