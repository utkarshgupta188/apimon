'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import DashboardShell from '@/components/dashboard-shell'
import { useProject } from '@/lib/project-context'
import { useAuth } from '@/lib/auth-context'
import {
  Settings,
  Trash2,
  Globe,
  Lock,
  CreditCard,
  Bell,
  CheckCircle,
  AlertCircle,
  Loader2,
  Link,
  Layers,
} from 'lucide-react'

export default function SettingsPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { activeProject, updateProject, deleteProject } = useProject()

  // Form State
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [environment, setEnvironment] = useState<'PRODUCTION' | 'STAGING' | 'DEVELOPMENT'>('DEVELOPMENT')
  const [baseUrl, setBaseUrl] = useState('')
  
  // States
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteInput, setDeleteInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    if (activeProject) {
      setName(activeProject.name)
      setDescription(activeProject.description || '')
      setEnvironment(activeProject.environment)
      setBaseUrl(activeProject.baseUrl || '')
    }
  }, [activeProject])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeProject) return
    setError(null)
    setSuccess(null)
    setSaving(true)

    try {
      const result = await updateProject(activeProject.id, {
        name,
        description,
        environment,
        baseUrl: baseUrl || null,
      })

      if (result.success) {
        setSuccess('Project settings updated successfully')
      } else {
        setError(result.error || 'Failed to update project settings')
      }
    } catch (err) {
      setError('An unexpected error occurred')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeProject) return
    if (deleteInput !== activeProject.name) {
      setError('Please type the project name to confirm deletion')
      return
    }

    setError(null)
    setSuccess(null)
    setDeleting(true)

    try {
      const result = await deleteProject(activeProject.id)
      if (result.success) {
        setSuccess('Project deleted successfully')
        setDeleteInput('')
        router.push('/dashboard')
      } else {
        setError(result.error || 'Failed to delete project')
      }
    } catch (err) {
      setError('An unexpected error occurred')
    } finally {
      setDeleting(false)
    }
  }

  const isOwner = activeProject?.ownerId === user?.id

  return (
    <DashboardShell>
      <div className="space-y-8 max-w-4xl">
        {/* Header */}
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight">Project Settings</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Manage your API gateway environments, configure webhooks, view billing, or delete your project.
          </p>
        </div>

        {/* Status Indicators */}
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
            <Settings className="h-12 w-12 text-muted-foreground/60 mx-auto mb-4" />
            <h3 className="text-lg font-bold">No active project</h3>
            <p className="text-muted-foreground text-sm mt-2">
              Please select or create a project to configure settings.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {/* 1. General Settings Form */}
            <div className="glass rounded-3xl border border-white/5 p-6 sm:p-8 relative overflow-hidden shadow-xl">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary to-indigo-500" />
              <h3 className="text-lg font-bold mb-6 flex items-center space-x-2">
                <Settings className="h-5 w-5 text-primary" />
                <span>General Configurations</span>
              </h3>

              <form onSubmit={handleSave} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      Project Name
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="E.g. Production Gateway"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-secondary/40 border border-border/80 rounded-xl text-foreground text-sm placeholder:text-muted-foreground/45 outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/60 transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      Environment
                    </label>
                    <select
                      value={environment}
                      onChange={(e) => setEnvironment(e.target.value as any)}
                      className="w-full px-3 py-2.5 bg-secondary/40 border border-border/80 rounded-xl text-foreground text-sm outline-none focus:border-primary/60 transition-all cursor-pointer"
                    >
                      <option value="DEVELOPMENT">Development</option>
                      <option value="STAGING">Staging</option>
                      <option value="PRODUCTION">Production</option>
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      Target Base URL
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                        <Globe className="h-4 w-4 text-muted-foreground/60" />
                      </span>
                      <input
                        type="url"
                        placeholder="https://api.your-company.com"
                        value={baseUrl}
                        onChange={(e) => setBaseUrl(e.target.value)}
                        className="w-full pl-10 pr-3 py-2.5 bg-secondary/40 border border-border/80 rounded-xl text-foreground text-sm placeholder:text-muted-foreground/40 outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/60 transition-all"
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1.5">
                      The gateway forwards calls from `/api/v1/*` to this base URL path.
                    </p>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      Project Description
                    </label>
                    <textarea
                      placeholder="Enter project details or purpose..."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-secondary/40 border border-border/80 rounded-xl text-foreground text-sm placeholder:text-muted-foreground/40 outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/60 transition-all h-24 resize-none"
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={saving || !name}
                    className="px-6 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-xl transition-all shadow-md flex items-center space-x-1.5 disabled:opacity-55 cursor-pointer"
                  >
                    {saving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      'Save Changes'
                    )}
                  </button>
                </div>
              </form>
            </div>

            {/* 2. Billing & Webhooks Placeholders */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Billing Placeholder */}
              <div className="glass rounded-3xl border border-white/5 p-6 shadow-xl relative">
                <h3 className="text-lg font-bold mb-2 flex items-center space-x-2">
                  <CreditCard className="h-5 w-5 text-primary" />
                  <span>Billing & Subscription</span>
                </h3>
                <p className="text-muted-foreground text-xs mb-6">
                  Manage your plan, payment methods, and invoices.
                </p>

                <div className="bg-secondary/30 border border-border/50 rounded-2xl p-4 space-y-3.5 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Current Plan</span>
                    <span className="px-2 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded-md font-semibold text-xs">
                      Developer (Free)
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Monthly Limits</span>
                    <span className="font-medium">10,000 requests</span>
                  </div>
                  <div className="flex justify-between items-center text-xs pt-2 border-t border-border/50">
                    <span className="text-muted-foreground">Billing Period resets in</span>
                    <span className="font-semibold">22 days</span>
                  </div>
                </div>
                
                <button
                  disabled
                  className="mt-6 w-full py-2.5 bg-secondary/80 border border-border text-muted-foreground font-semibold rounded-xl text-sm transition-all"
                >
                  Upgrade Plan (Coming Soon)
                </button>
              </div>

              {/* Webhooks Placeholder */}
              <div className="glass rounded-3xl border border-white/5 p-6 shadow-xl relative">
                <h3 className="text-lg font-bold mb-2 flex items-center space-x-2">
                  <Bell className="h-5 w-5 text-primary" />
                  <span>Outgoing Webhooks</span>
                </h3>
                <p className="text-muted-foreground text-xs mb-6">
                  Send real-time alerts or event notifications to your server.
                </p>

                <div className="bg-secondary/30 border border-border/50 rounded-2xl p-4 flex items-center justify-between text-sm">
                  <div className="flex items-center space-x-3">
                    <Layers className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <div className="font-medium text-xs">Event Streaming</div>
                      <div className="text-[10px] text-muted-foreground">Post requests, key changes, outages</div>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">0 Configured</span>
                </div>

                <button
                  disabled
                  className="mt-6 w-full py-2.5 bg-secondary/80 border border-border text-muted-foreground font-semibold rounded-xl text-sm transition-all"
                >
                  Add Webhook URL
                </button>
              </div>
            </div>

            {/* 3. Danger Zone (Delete Project) */}
            {isOwner && (
              <div className="border border-destructive/20 bg-destructive/5 rounded-3xl p-6 sm:p-8">
                <h3 className="text-lg font-bold text-destructive mb-2 flex items-center space-x-2">
                  <Trash2 className="h-5 w-5" />
                  <span>Danger Zone</span>
                </h3>
                <p className="text-muted-foreground text-xs mb-6">
                  Deleting a project permanently deletes all endpoints, rate limits, API keys, and request history logs. This action cannot be undone.
                </p>

                <form onSubmit={handleDelete} className="space-y-4 max-w-md">
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      To confirm, type <span className="font-bold text-foreground">"{activeProject.name}"</span> below
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Type project name"
                      value={deleteInput}
                      onChange={(e) => setDeleteInput(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-destructive/10 border border-destructive/20 rounded-xl text-foreground text-sm placeholder:text-muted-foreground/30 outline-none focus:border-destructive focus:ring-1 focus:ring-destructive transition-all"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={deleting || deleteInput !== activeProject.name}
                    className="px-6 py-2.5 bg-destructive hover:bg-destructive/90 text-destructive-foreground font-semibold rounded-xl transition-all shadow-md flex items-center space-x-1.5 disabled:opacity-55 cursor-pointer"
                  >
                    {deleting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Trash2 className="h-4.5 w-4.5" />
                        <span>Delete Project</span>
                      </>
                    )}
                  </button>
                </form>
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardShell>
  )
}
