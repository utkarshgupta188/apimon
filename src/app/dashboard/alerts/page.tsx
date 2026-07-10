'use client'

import React, { useEffect, useState } from 'react'
import DashboardShell from '@/components/dashboard-shell'
import { useProject } from '@/lib/project-context'
import { useAuth } from '@/lib/auth-context'
import {
  Bell,
  Plus,
  ToggleLeft,
  ToggleRight,
  Trash2,
  Mail,
  MessageSquare,
  AlertTriangle,
  Info,
  Clock,
  Terminal,
  CheckCircle,
  AlertCircle,
  Loader2,
  History,
} from 'lucide-react'

interface NotificationLog {
  id: string
  timestamp: string
  sentTo: string
  status: string
  message: string
}

interface AlertRule {
  id: string
  triggerType: 'API_DOWN' | 'HIGH_LATENCY' | 'HIGH_ERROR_RATE' | 'RATE_LIMIT_EXCEEDED'
  threshold: number
  durationSecond: number
  notificationMethod: 'EMAIL' | 'SLACK' | 'DISCORD'
  recipient: string
  isActive: boolean
  endpoint: {
    id: string
    name: string
    url: string
    method: string
  } | null
  notifications: NotificationLog[]
}

export default function AlertsPage() {
  const { user } = useAuth()
  const { activeProject } = useProject()

  // State
  const [alerts, setAlerts] = useState<AlertRule[]>([])
  const [endpoints, setEndpoints] = useState<{ id: string; name: string; url: string; method: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Creation modal state
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [endpointId, setEndpointId] = useState('')
  const [triggerType, setTriggerType] = useState<'API_DOWN' | 'HIGH_LATENCY' | 'HIGH_ERROR_RATE' | 'RATE_LIMIT_EXCEEDED'>('API_DOWN')
  const [threshold, setThreshold] = useState('1')
  const [durationSecond, setDurationSecond] = useState('60')
  const [notificationMethod, setNotificationMethod] = useState<'EMAIL' | 'SLACK' | 'DISCORD'>('EMAIL')
  const [recipient, setRecipient] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const fetchAlerts = async () => {
    if (!activeProject) {
      setAlerts([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/alerts?projectId=${activeProject.id}`)
      if (res.ok) {
        const data = await res.json()
        setAlerts(data.alerts || [])
      } else {
        setError('Failed to fetch alert configurations')
      }
    } catch (e) {
      setError('An error occurred while loading alerts')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAlerts()
  }, [activeProject])

  useEffect(() => {
    if (!activeProject) return
    fetch(`/api/endpoints?projectId=${activeProject.id}`)
      .then((res) => res.json())
      .then((data) => setEndpoints(data.endpoints || []))
      .catch((e) => console.error(e))
  }, [activeProject])

  // Automatically update default thresholds based on trigger selection
  useEffect(() => {
    if (triggerType === 'API_DOWN' || triggerType === 'RATE_LIMIT_EXCEEDED') {
      setThreshold('1') // count threshold
    } else if (triggerType === 'HIGH_LATENCY') {
      setThreshold('1000') // default latency 1000ms
    } else if (triggerType === 'HIGH_ERROR_RATE') {
      setThreshold('5') // default 5% error rate
    }
  }, [triggerType])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeProject) return
    setError(null)
    setSuccess(null)
    setSubmitting(true)

    const payload = {
      projectId: activeProject.id,
      endpointId: endpointId || null,
      triggerType,
      threshold: parseFloat(threshold) || 1,
      durationSecond: parseInt(durationSecond) || 60,
      notificationMethod,
      recipient,
      isActive: true,
    }

    try {
      const res = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setSuccess('Alert rule created successfully')
        setCreateModalOpen(false)
        // Reset form
        setEndpointId('')
        setTriggerType('API_DOWN')
        setThreshold('1')
        setDurationSecond('60')
        setNotificationMethod('EMAIL')
        setRecipient('')
        fetchAlerts()
      } else {
        setError(data.error || 'Failed to create alert rule')
      }
    } catch (err) {
      setError('A network error occurred')
    } finally {
      setSubmitting(false)
    }
  }

  const handleToggleActive = async (id: string, currentActive: boolean) => {
    setError(null)
    setSuccess(null)
    try {
      const res = await fetch(`/api/alerts?id=${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !currentActive }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setAlerts((prev) =>
          prev.map((a) => (a.id === id ? { ...a, isActive: !currentActive } : a))
        )
        setSuccess('Alert rule status toggled')
      } else {
        setError(data.error || 'Failed to toggle alert rule')
      }
    } catch (err) {
      setError('Network error occurred')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this alert rule?')) return
    setError(null)
    setSuccess(null)
    try {
      const res = await fetch(`/api/alerts?id=${id}`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setSuccess('Alert rule deleted')
        fetchAlerts()
      } else {
        setError(data.error || 'Failed to delete alert rule')
      }
    } catch (err) {
      setError('Network error occurred')
    }
  }

  const getTriggerLabel = (type: string, threshold: number) => {
    if (type === 'API_DOWN') return 'Endpoint Downtime / Outage'
    if (type === 'HIGH_LATENCY') return `High Latency (>${threshold}ms)`
    if (type === 'HIGH_ERROR_RATE') return `High Error Rate (>${threshold}%)`
    if (type === 'RATE_LIMIT_EXCEEDED') return 'Rate Limit Exceeded events'
    return type
  }

  const getChannelIcon = (method: string) => {
    if (method === 'EMAIL') return <Mail className="h-4 w-4 text-emerald-400" />
    if (method === 'SLACK') return <MessageSquare className="h-4 w-4 text-purple-400" />
    return <MessageSquare className="h-4 w-4 text-blue-400" />
  }

  // Compile all recent notification logs from alerts to show history panel
  const allNotifications = alerts
    .flatMap((a) =>
      a.notifications.map((n) => ({
        ...n,
        ruleName: getTriggerLabel(a.triggerType, a.threshold),
        method: a.notificationMethod,
      }))
    )
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 10)

  return (
    <DashboardShell>
      <div className="space-y-8 max-w-6xl">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-3xl font-extrabold tracking-tight">Alert Configurations</h2>
            <p className="text-muted-foreground text-sm mt-1">
              Configure alert rules triggered by outage metrics and deliver pings directly to Slack, Discord, or Email.
            </p>
          </div>
          <button
            onClick={() => setCreateModalOpen(true)}
            disabled={!activeProject}
            className="px-4 py-2.5 bg-primary hover:bg-primary/95 text-primary-foreground font-semibold rounded-xl transition-all shadow-md flex items-center space-x-1.5 self-start cursor-pointer disabled:opacity-55"
          >
            <Plus className="h-5 w-5" />
            <span>Create Rule</span>
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
            <CheckCircle className="h-5 w-5 flex-shrink-0" />
            <span>{success}</span>
          </div>
        )}

        {!activeProject ? (
          <div className="glass rounded-3xl p-12 text-center border border-white/5">
            <Bell className="h-12 w-12 text-muted-foreground/60 mx-auto mb-4" />
            <h3 className="text-lg font-bold">No active project</h3>
            <p className="text-muted-foreground text-sm mt-2">
              Select or create a project to configure alert rules.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* 1. Alert Rules List */}
            <div className="lg:col-span-2 space-y-6">
              <div className="glass rounded-3xl border border-white/5 p-6 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary to-indigo-500" />
                <h3 className="text-lg font-bold mb-4 flex items-center space-x-2">
                  <Bell className="h-5 w-5 text-primary" />
                  <span>Configured Rules ({alerts.length})</span>
                </h3>

                {loading ? (
                  <div className="p-8 text-center text-muted-foreground flex items-center justify-center space-x-2">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    <span>Loading alerts rules...</span>
                  </div>
                ) : alerts.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground text-sm">
                    No alert rules configured. Create one to receive automated outage notifications.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {alerts.map((rule) => (
                      <div
                        key={rule.id}
                        className={`border rounded-2xl p-5 hover:bg-secondary/15 transition-all flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 ${
                          rule.isActive ? 'border-border/60' : 'border-border/30 opacity-60'
                        }`}
                      >
                        <div className="space-y-2 truncate">
                          <div className="flex items-center space-x-2">
                            <span className="font-semibold text-foreground text-sm">
                              {getTriggerLabel(rule.triggerType, rule.threshold)}
                            </span>
                            <span className="text-[10px] text-muted-foreground font-mono bg-secondary px-1.5 py-0.5 rounded">
                              {rule.durationSecond}s delay
                            </span>
                          </div>

                          <div className="flex items-center space-x-2.5 text-xs text-muted-foreground">
                            <span className="flex items-center space-x-1 font-medium bg-secondary/50 border border-border/60 px-2 py-0.5 rounded">
                              <Terminal className="h-3.5 w-3.5 mr-0.5" />
                              <span>{rule.endpoint ? `${rule.endpoint.method} ${rule.endpoint.url}` : 'Global Rule'}</span>
                            </span>
                            
                            <span className="flex items-center space-x-1.5 font-semibold text-foreground">
                              {getChannelIcon(rule.notificationMethod)}
                              <span className="truncate max-w-[120px]" title={rule.recipient}>
                                {rule.recipient}
                              </span>
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center space-x-3.5 sm:self-center">
                          {/* Active Toggle */}
                          <button
                            onClick={() => handleToggleActive(rule.id, rule.isActive)}
                            className="text-muted-foreground hover:text-foreground transition-all cursor-pointer outline-none"
                            title={rule.isActive ? 'Deactivate rule' : 'Activate rule'}
                          >
                            {rule.isActive ? (
                              <ToggleRight className="h-8 w-8 text-primary" />
                            ) : (
                              <ToggleLeft className="h-8 w-8 text-muted-foreground/60" />
                            )}
                          </button>

                          {/* Delete Button */}
                          <button
                            onClick={() => handleDelete(rule.id)}
                            className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-all cursor-pointer"
                            title="Delete Rule"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* 2. Dispatched History Panel */}
            <div className="lg:col-span-1 space-y-6">
              <div className="glass rounded-3xl border border-white/5 p-6 shadow-xl relative overflow-hidden">
                <h3 className="text-lg font-bold mb-4 flex items-center space-x-2">
                  <History className="h-5 w-5 text-primary" />
                  <span>Recent Dispatches</span>
                </h3>

                {loading ? (
                  <div className="p-6 text-center text-muted-foreground text-xs">
                    Loading history...
                  </div>
                ) : allNotifications.length === 0 ? (
                  <div className="p-6 text-center text-muted-foreground text-xs italic">
                    No alert logs. Gateway outage incidents are logged here.
                  </div>
                ) : (
                  <div className="space-y-4 max-h-[400px] overflow-y-auto pr-1">
                    {allNotifications.map((notif) => (
                      <div
                        key={notif.id}
                        className="bg-secondary/20 border border-border/50 rounded-xl p-3 text-xs space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-muted-foreground flex items-center">
                            <Clock className="h-3 w-3 mr-0.5" />
                            {new Date(notif.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <span className="px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 rounded text-[9px] font-bold uppercase tracking-wider">
                            Sent ({notif.method})
                          </span>
                        </div>
                        
                        <p className="font-semibold text-foreground text-[11px] leading-tight truncate">
                          {notif.ruleName}
                        </p>

                        <div className="text-[10px] text-muted-foreground truncate bg-card p-1.5 rounded font-mono">
                          {notif.sentTo}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Create Rule Modal */}
        {createModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-card border border-border rounded-3xl w-full max-w-lg p-6 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary to-indigo-500" />
              <h3 className="text-lg font-bold mb-4">Configure Alert Rule</h3>

              <form onSubmit={handleCreate} className="space-y-4">
                {/* 1. Target Endpoint */}
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    Scope Target
                  </label>
                  <select
                    value={endpointId}
                    onChange={(e) => setEndpointId(e.target.value)}
                    className="w-full px-3 py-2.5 bg-secondary/40 border border-border/80 rounded-xl text-foreground text-sm outline-none focus:border-primary/60 transition-all cursor-pointer"
                  >
                    <option value="">Global Rule (All Endpoints)</option>
                    {endpoints.map((ep) => (
                      <option key={ep.id} value={ep.id}>
                        {ep.method} {ep.url} ({ep.name})
                      </option>
                    ))}
                  </select>
                </div>

                {/* 2. Trigger Type */}
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    Trigger Condition
                  </label>
                  <select
                    value={triggerType}
                    onChange={(e) => setTriggerType(e.target.value as any)}
                    className="w-full px-3 py-2.5 bg-secondary/40 border border-border/80 rounded-xl text-foreground text-sm outline-none focus:border-primary/60 transition-all cursor-pointer"
                  >
                    <option value="API_DOWN">API Downtime / Outage</option>
                    <option value="HIGH_LATENCY">High Latency Threshold</option>
                    <option value="HIGH_ERROR_RATE">High Error Rate (Status 4xx/5xx)</option>
                    <option value="RATE_LIMIT_EXCEEDED">Rate Limit Exceeded events</option>
                  </select>
                </div>

                {/* 3. Threshold and Duration */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      {triggerType === 'HIGH_LATENCY' ? 'Latency (ms) Threshold' : triggerType === 'HIGH_ERROR_RATE' ? 'Error Rate (%)' : 'Trigger Threshold'}
                    </label>
                    <input
                      type="number"
                      required
                      min="1"
                      placeholder={triggerType === 'HIGH_LATENCY' ? '1000' : '1'}
                      value={threshold}
                      disabled={triggerType === 'API_DOWN' || triggerType === 'RATE_LIMIT_EXCEEDED'}
                      onChange={(e) => setThreshold(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-secondary/40 border border-border/80 rounded-xl text-foreground text-sm outline-none focus:border-primary/60 transition-all disabled:opacity-55"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      Consecutive Duration (s)
                    </label>
                    <input
                      type="number"
                      required
                      min="1"
                      placeholder="60"
                      value={durationSecond}
                      onChange={(e) => setDurationSecond(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-secondary/40 border border-border/80 rounded-xl text-foreground text-sm outline-none focus:border-primary/60 transition-all"
                    />
                  </div>
                </div>

                {/* 4. Notification Channel */}
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    Notification Channel
                  </label>
                  <select
                    value={notificationMethod}
                    onChange={(e) => setNotificationMethod(e.target.value as any)}
                    className="w-full px-3 py-2.5 bg-secondary/40 border border-border/80 rounded-xl text-foreground text-sm outline-none focus:border-primary/60 transition-all cursor-pointer"
                  >
                    <option value="EMAIL">Email Dispatch</option>
                    <option value="SLACK">Slack Webhook</option>
                    <option value="DISCORD">Discord Webhook</option>
                  </select>
                </div>

                {/* 5. Destination URL / Email */}
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    {notificationMethod === 'EMAIL' ? 'Recipient Email Address' : 'Webhook URL'}
                  </label>
                  <input
                    type={notificationMethod === 'EMAIL' ? 'email' : 'url'}
                    required
                    placeholder={notificationMethod === 'EMAIL' ? 'ops@company.com' : 'https://hooks.slack.com/services/...'}
                    value={recipient}
                    onChange={(e) => setRecipient(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-secondary/40 border border-border/80 rounded-xl text-foreground text-sm placeholder:text-muted-foreground/35 outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/60 transition-all"
                  />
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
                    disabled={submitting || !recipient}
                    className="w-1/2 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-xl transition-all flex items-center justify-center disabled:opacity-60 cursor-pointer"
                  >
                    {submitting ? (
                      <Loader2 className="h-4.5 w-4.5 animate-spin" />
                    ) : (
                      'Save Rule'
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
