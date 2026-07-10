'use client'

import React, { useEffect, useState } from 'react'
import DashboardShell from '@/components/dashboard-shell'
import { useProject } from '@/lib/project-context'
import { useAuth } from '@/lib/auth-context'
import {
  Key,
  Plus,
  Copy,
  Check,
  ToggleLeft,
  ToggleRight,
  RefreshCw,
  Trash2,
  Calendar,
  AlertTriangle,
  Zap,
  Info,
  Loader2,
  CheckCircle,
  AlertCircle,
  Clock,
  ExternalLink,
} from 'lucide-react'

interface RateLimitConfig {
  id: string
  requestsPerSecond: number | null
  requestsPerMinute: number | null
  requestsPerHour: number | null
  requestsPerDay: number | null
  type: 'SLIDING_WINDOW' | 'FIXED_WINDOW' | 'TOKEN_BUCKET'
}

interface APIKey {
  id: string
  name: string
  keyPrefix: string
  isActive: boolean
  expiresAt: string | null
  lastUsedAt: string | null
  createdAt: string
  rateLimit: RateLimitConfig | null
  requestCount: number
}

export default function ApiKeysPage() {
  const { user } = useAuth()
  const { activeProject } = useProject()

  // API keys list
  const [keys, setKeys] = useState<APIKey[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Copy helpers
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [copiedRawKey, setCopiedRawKey] = useState(false)

  // Modal creation states
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [newKeyName, setNewKeyName] = useState('')
  const [newKeyExpiry, setNewKeyExpiry] = useState('')
  const [newKeyRlType, setNewKeyRlType] = useState<'SLIDING_WINDOW' | 'FIXED_WINDOW' | 'TOKEN_BUCKET'>('SLIDING_WINDOW')
  
  // Rate Limits input states
  const [limitSecond, setLimitSecond] = useState<string>('')
  const [limitMinute, setLimitMinute] = useState<string>('60') // default 60 req/min
  const [limitHour, setLimitHour] = useState<string>('')
  const [limitDay, setLimitDay] = useState<string>('')

  const [creating, setCreating] = useState(false)
  const [rawGeneratedKey, setRawGeneratedKey] = useState<string | null>(null)
  const [createdKeyName, setCreatedKeyName] = useState('')

  const fetchKeys = async () => {
    if (!activeProject) {
      setKeys([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/api-keys?projectId=${activeProject.id}`)
      if (res.ok) {
        const data = await res.json()
        setKeys(data.apiKeys || [])
      } else {
        setError('Failed to fetch API keys')
      }
    } catch (e) {
      setError('An error occurred while loading API keys')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchKeys()
  }, [activeProject])

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleCopyRawKey = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedRawKey(true)
    setTimeout(() => setCopiedRawKey(false), 2000)
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeProject) return
    setError(null)
    setSuccess(null)
    setCreating(true)

    const payload = {
      projectId: activeProject.id,
      name: newKeyName,
      expiresAt: newKeyExpiry || null,
      rateLimit: {
        type: newKeyRlType,
        requestsPerSecond: limitSecond ? parseInt(limitSecond) : null,
        requestsPerMinute: limitMinute ? parseInt(limitMinute) : null,
        requestsPerHour: limitHour ? parseInt(limitHour) : null,
        requestsPerDay: limitDay ? parseInt(limitDay) : null,
      },
    }

    try {
      const res = await fetch('/api/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setRawGeneratedKey(data.rawKey)
        setCreatedKeyName(data.apiKey.name)
        setCreateModalOpen(false)
        // Reset form
        setNewKeyName('')
        setNewKeyExpiry('')
        setLimitSecond('')
        setLimitMinute('60')
        setLimitHour('')
        setLimitDay('')
        fetchKeys()
      } else {
        setError(data.error || 'Failed to generate API Key')
      }
    } catch (err) {
      setError('A network error occurred')
    } finally {
      setCreating(false)
    }
  }

  const handleToggleActive = async (id: string) => {
    setError(null)
    setSuccess(null)
    try {
      const res = await fetch(`/api/api-keys?id=${id}&action=toggle`, {
        method: 'PUT',
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setKeys(prev =>
          prev.map(k => (k.id === id ? { ...k, isActive: data.isActive } : k))
        )
        setSuccess(`API Key status updated`)
      } else {
        setError(data.error || 'Failed to update key status')
      }
    } catch (err) {
      setError('Network error occurred')
    }
  }

  const handleRegenerate = async (id: string, name: string) => {
    if (
      !confirm(
        `Are you sure you want to regenerate the API key "${name}"? Existing client applications using this key will immediately fail authorization until updated!`
      )
    ) {
      return
    }

    setError(null)
    setSuccess(null)
    try {
      const res = await fetch(`/api/api-keys?id=${id}&action=regenerate`, {
        method: 'PUT',
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setRawGeneratedKey(data.rawKey)
        setCreatedKeyName(name)
        setSuccess(`API key regenerated successfully`)
        fetchKeys()
      } else {
        setError(data.error || 'Failed to regenerate key')
      }
    } catch (err) {
      setError('Network error occurred')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to revoke this API key? This action is permanent!')) return
    setError(null)
    setSuccess(null)

    try {
      const res = await fetch(`/api/api-keys?id=${id}`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setSuccess('API Key revoked successfully')
        fetchKeys()
      } else {
        setError(data.error || 'Failed to revoke key')
      }
    } catch (err) {
      setError('Network error occurred')
    }
  }

  const getStrategyLabel = (type: string) => {
    if (type === 'SLIDING_WINDOW') return 'Sliding Window'
    if (type === 'TOKEN_BUCKET') return 'Token Bucket'
    return 'Fixed Window'
  }

  return (
    <DashboardShell>
      <div className="space-y-8 max-w-6xl">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-3xl font-extrabold tracking-tight">API Key Management</h2>
            <p className="text-muted-foreground text-sm mt-1">
              Generate secure access tokens and configure rate limits per key.
            </p>
          </div>
          <button
            onClick={() => setCreateModalOpen(true)}
            disabled={!activeProject}
            className="px-4 py-2.5 bg-primary hover:bg-primary/95 text-primary-foreground font-semibold rounded-xl transition-all shadow-md hover:shadow-primary/10 flex items-center space-x-1.5 self-start cursor-pointer disabled:opacity-55"
          >
            <Plus className="h-5 w-5" />
            <span>Generate Key</span>
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

        {/* Raw Key Display Modal (Shown ONCE on creation) */}
        {rawGeneratedKey && (
          <div className="border-2 border-primary/30 bg-primary/5 rounded-3xl p-6 sm:p-8 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary to-indigo-500" />
            <h3 className="text-xl font-bold flex items-center space-x-2 text-primary">
              <CheckCircle className="h-6 w-6" />
              <span>New API Key Generated: "{createdKeyName}"</span>
            </h3>
            <p className="text-sm text-muted-foreground mt-2 mb-6">
              Copy this token. For security reasons, <span className="font-semibold text-foreground">we will not show it again</span>. If you lose it, you must regenerate it.
            </p>

            <div className="flex items-center space-x-2 bg-secondary/80 border border-border p-4 rounded-2xl font-mono text-sm break-all relative group select-all">
              <span className="flex-1 text-primary-foreground font-bold select-all pr-12">{rawGeneratedKey}</span>
              <button
                onClick={() => handleCopyRawKey(rawGeneratedKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-card hover:bg-secondary border border-border rounded-xl transition-all cursor-pointer"
                title="Copy to clipboard"
              >
                {copiedRawKey ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4 text-muted-foreground" />}
              </button>
            </div>

            <div className="flex items-center space-x-2 mt-4 text-xs text-amber-500 font-semibold">
              <AlertTriangle className="h-4 w-4" />
              <span>Save this token securely in your environment variables.</span>
            </div>

            <button
              onClick={() => setRawGeneratedKey(null)}
              className="mt-6 px-6 py-2 bg-primary hover:bg-primary/95 text-primary-foreground font-semibold rounded-xl text-sm transition-all cursor-pointer"
            >
              Done, I have saved it
            </button>
          </div>
        )}

        {/* Main List */}
        {!activeProject ? (
          <div className="glass rounded-3xl p-12 text-center border border-white/5">
            <Key className="h-12 w-12 text-muted-foreground/60 mx-auto mb-4" />
            <h3 className="text-lg font-bold">No active project</h3>
            <p className="text-muted-foreground text-sm mt-2">
              Create a project to start managing API keys.
            </p>
          </div>
        ) : loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[1, 2].map((i) => (
              <div key={i} className="glass rounded-3xl p-6 border border-white/5 space-y-4 animate-pulse">
                <div className="h-5 bg-secondary/80 rounded w-1/3" />
                <div className="h-4 bg-secondary/60 rounded w-2/3" />
                <div className="h-10 bg-secondary/50 rounded w-full" />
              </div>
            ))}
          </div>
        ) : keys.length === 0 ? (
          <div className="glass rounded-3xl p-12 text-center border border-white/5 shadow-xl">
            <Key className="h-12 w-12 text-muted-foreground/60 mx-auto mb-4" />
            <h3 className="text-lg font-bold">No API keys yet</h3>
            <p className="text-muted-foreground text-sm mt-2 mb-6">
              Generate your first API key to start rate limiting and tracking metrics.
            </p>
            <button
              onClick={() => setCreateModalOpen(true)}
              className="px-6 py-3 bg-primary hover:bg-primary/95 text-primary-foreground font-semibold rounded-2xl transition-all shadow-md cursor-pointer inline-flex items-center space-x-1.5"
            >
              <Plus className="h-5 w-5" />
              <span>Generate First Key</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {keys.map((key) => {
              const hasLimits = key.rateLimit && (
                key.rateLimit.requestsPerSecond ||
                key.rateLimit.requestsPerMinute ||
                key.rateLimit.requestsPerHour ||
                key.rateLimit.requestsPerDay
              )

              return (
                <div
                  key={key.id}
                  className={`glass rounded-3xl border border-white/5 p-6 shadow-xl flex flex-col justify-between hover:border-primary/20 transition-all ${
                    !key.isActive ? 'opacity-70' : ''
                  }`}
                >
                  <div>
                    {/* Top Row */}
                    <div className="flex items-center justify-between gap-4 mb-4">
                      <div>
                        <h4 className="font-bold text-lg text-foreground truncate">{key.name}</h4>
                        <p className="text-xs text-muted-foreground flex items-center mt-1">
                          <Calendar className="h-3 w-3 mr-1" />
                          Created {new Date(key.createdAt).toLocaleDateString()}
                        </p>
                      </div>

                      {/* Active Status toggle */}
                      <button
                        onClick={() => handleToggleActive(key.id)}
                        className="text-muted-foreground hover:text-foreground transition-all cursor-pointer outline-none"
                        title={key.isActive ? 'Deactivate Key' : 'Activate Key'}
                      >
                        {key.isActive ? (
                          <ToggleRight className="h-8 w-8 text-primary" />
                        ) : (
                          <ToggleLeft className="h-8 w-8 text-muted-foreground/60" />
                        )}
                      </button>
                    </div>

                    {/* Masked Key Display */}
                    <div className="bg-secondary/40 border border-border/80 px-3.5 py-2.5 rounded-xl font-mono text-xs flex items-center justify-between mb-4">
                      <span className="truncate text-foreground font-semibold">
                        {key.keyPrefix}••••••••••••••••
                      </span>
                      <button
                        onClick={() => handleCopy(`${key.keyPrefix}xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`, key.id)}
                        className="p-1 hover:bg-secondary border border-border/60 rounded-lg text-muted-foreground hover:text-foreground transition-all cursor-pointer"
                        title="Copy masked key prefix"
                      >
                        {copiedId === key.id ? (
                          <Check className="h-3.5 w-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>

                    {/* Rate Limiting details */}
                    <div className="border-t border-border/40 pt-4 mb-6 space-y-2">
                      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center space-x-1">
                        <Zap className="h-3.5 w-3.5 text-primary" />
                        <span>Rate Limiter ({key.rateLimit ? getStrategyLabel(key.rateLimit.type) : 'None'})</span>
                      </div>

                      <div className="flex flex-wrap gap-2 text-xs pt-1">
                        {key.rateLimit?.requestsPerSecond && (
                          <span className="px-2 py-1 bg-secondary rounded-lg font-medium text-foreground">
                            {key.rateLimit.requestsPerSecond} req/s
                          </span>
                        )}
                        {key.rateLimit?.requestsPerMinute && (
                          <span className="px-2 py-1 bg-secondary rounded-lg font-medium text-foreground">
                            {key.rateLimit.requestsPerMinute} req/m
                          </span>
                        )}
                        {key.rateLimit?.requestsPerHour && (
                          <span className="px-2 py-1 bg-secondary rounded-lg font-medium text-foreground">
                            {key.rateLimit.requestsPerHour} req/h
                          </span>
                        )}
                        {key.rateLimit?.requestsPerDay && (
                          <span className="px-2 py-1 bg-secondary rounded-lg font-medium text-foreground">
                            {key.rateLimit.requestsPerDay} req/d
                          </span>
                        )}
                        {!hasLimits && (
                          <span className="text-muted-foreground italic">Unlimited Requests</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Footer Row stats and actions */}
                  <div className="border-t border-border/40 pt-4 flex items-center justify-between text-xs text-muted-foreground gap-4">
                    <div className="space-y-1">
                      <div>
                        Total Requests: <span className="font-semibold text-foreground">{key.requestCount}</span>
                      </div>
                      <div className="flex items-center">
                        <Clock className="h-3 w-3 mr-1 text-muted-foreground/60" />
                        <span>
                          {key.lastUsedAt
                            ? `Last used ${new Date(key.lastUsedAt).toLocaleDateString()}`
                            : 'Never used'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2.5">
                      <button
                        onClick={() => handleRegenerate(key.id, key.name)}
                        className="p-2 hover:bg-secondary border border-border/80 rounded-xl transition-all cursor-pointer flex items-center space-x-1"
                        title="Regenerate Key Token"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Regen</span>
                      </button>
                      <button
                        onClick={() => handleDelete(key.id)}
                        className="p-2 text-destructive hover:bg-destructive/10 border border-transparent rounded-xl transition-all cursor-pointer"
                        title="Revoke (Delete) Key"
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

        {/* Generate Key Modal */}
        {createModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-card border border-border rounded-3xl w-full max-w-lg p-6 shadow-2xl relative overflow-hidden max-h-[90vh] overflow-y-auto">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary to-indigo-500" />
              <h3 className="text-lg font-bold mb-4">Generate API Access Token</h3>

              <form onSubmit={handleCreate} className="space-y-4">
                {/* 1. Name */}
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    Key Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="E.g. Customer Portal App"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-secondary/40 border border-border/80 rounded-xl text-foreground text-sm placeholder:text-muted-foreground/45 outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/60 transition-all"
                  />
                </div>

                {/* 2. Expiry */}
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    Expiration Date (Optional)
                  </label>
                  <input
                    type="date"
                    value={newKeyExpiry}
                    onChange={(e) => setNewKeyExpiry(e.target.value)}
                    className="w-full px-3 py-2.5 bg-secondary/40 border border-border/80 rounded-xl text-foreground text-sm outline-none focus:border-primary/60 transition-all cursor-pointer"
                  />
                </div>

                {/* 3. Rate Limit Strategy */}
                <div className="border-t border-border/50 pt-4">
                  <h4 className="text-sm font-semibold mb-3">Rate Limit Settings</h4>
                  
                  <div className="mb-4">
                    <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      Limiting Strategy
                    </label>
                    <select
                      value={newKeyRlType}
                      onChange={(e) => setNewKeyRlType(e.target.value as any)}
                      className="w-full px-3 py-2.5 bg-secondary/40 border border-border/80 rounded-xl text-foreground text-sm outline-none focus:border-primary/60 transition-all cursor-pointer"
                    >
                      <option value="SLIDING_WINDOW">Sliding Window (Recommended, Smooth)</option>
                      <option value="FIXED_WINDOW">Fixed Window (Simple window blocks)</option>
                      <option value="TOKEN_BUCKET">Token Bucket (Supports burst traffic)</option>
                    </select>
                  </div>

                  {/* Rate Limits Inputs */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                        Req per Second
                      </label>
                      <input
                        type="number"
                        min="1"
                        placeholder="Unlimited"
                        value={limitSecond}
                        onChange={(e) => setLimitSecond(e.target.value)}
                        className="w-full px-3 py-2 bg-secondary/40 border border-border/80 rounded-xl text-foreground text-sm placeholder:text-muted-foreground/30 outline-none focus:border-primary/60 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                        Req per Minute
                      </label>
                      <input
                        type="number"
                        min="1"
                        placeholder="Unlimited"
                        value={limitMinute}
                        onChange={(e) => setLimitMinute(e.target.value)}
                        className="w-full px-3 py-2 bg-secondary/40 border border-border/80 rounded-xl text-foreground text-sm placeholder:text-muted-foreground/30 outline-none focus:border-primary/60 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                        Req per Hour
                      </label>
                      <input
                        type="number"
                        min="1"
                        placeholder="Unlimited"
                        value={limitHour}
                        onChange={(e) => setLimitHour(e.target.value)}
                        className="w-full px-3 py-2 bg-secondary/40 border border-border/80 rounded-xl text-foreground text-sm placeholder:text-muted-foreground/30 outline-none focus:border-primary/60 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                        Req per Day
                      </label>
                      <input
                        type="number"
                        min="1"
                        placeholder="Unlimited"
                        value={limitDay}
                        onChange={(e) => setLimitDay(e.target.value)}
                        className="w-full px-3 py-2 bg-secondary/40 border border-border/80 rounded-xl text-foreground text-sm placeholder:text-muted-foreground/30 outline-none focus:border-primary/60 transition-all"
                      />
                    </div>
                  </div>

                  <p className="text-[10px] text-muted-foreground mt-3 flex items-center">
                    <Info className="h-3.5 w-3.5 mr-1 text-primary" />
                    <span>The smallest configured time window takes precedence. Leave empty for unlimited.</span>
                  </p>
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
                    disabled={creating || !newKeyName}
                    className="w-1/2 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-xl transition-all flex items-center justify-center disabled:opacity-60 cursor-pointer"
                  >
                    {creating ? (
                      <Loader2 className="h-4.5 w-4.5 animate-spin" />
                    ) : (
                      'Generate Key'
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
