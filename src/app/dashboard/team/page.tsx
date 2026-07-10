'use client'

import React, { useEffect, useState } from 'react'
import DashboardShell from '@/components/dashboard-shell'
import { useProject } from '@/lib/project-context'
import { useAuth } from '@/lib/auth-context'
import {
  Users,
  Plus,
  Shield,
  Trash2,
  Mail,
  UserPlus,
  Crown,
  User,
  Loader2,
  CheckCircle,
  AlertCircle,
} from 'lucide-react'

interface Member {
  id: string
  role: 'OWNER' | 'ADMIN' | 'MEMBER'
  user: {
    id: string
    name: string | null
    email: string
  }
}

export default function TeamPage() {
  const { user } = useAuth()
  const { activeProject } = useProject()
  
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'ADMIN' | 'MEMBER'>('MEMBER')
  const [inviteSubmitting, setInviteSubmitting] = useState(false)
  
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const fetchMembers = async () => {
    if (!activeProject) {
      setMembers([])
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/teams/members?projectId=${activeProject.id}`)
      if (res.ok) {
        const data = await res.json()
        setMembers(data.members || [])
      } else {
        setError('Failed to fetch team members')
      }
    } catch (e) {
      setError('An error occurred while loading team members')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMembers()
  }, [activeProject])

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeProject) return
    
    setError(null)
    setSuccess(null)
    setInviteSubmitting(true)

    try {
      const res = await fetch('/api/teams/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: activeProject.id,
          email: inviteEmail,
          role: inviteRole,
        }),
      })

      const data = await res.json()
      if (res.ok && data.success) {
        setInviteEmail('')
        setSuccess(`Successfully invited ${data.member.user.email} as ${inviteRole}`)
        fetchMembers()
      } else {
        setError(data.error || 'Failed to invite team member')
      }
    } catch (err) {
      setError('A network error occurred')
    } finally {
      setInviteSubmitting(false)
    }
  }

  const handleUpdateRole = async (memberId: string, role: 'OWNER' | 'ADMIN' | 'MEMBER') => {
    if (!activeProject) return
    setError(null)
    setSuccess(null)

    try {
      const res = await fetch('/api/teams/members', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: activeProject.id,
          memberId,
          role,
        }),
      })

      const data = await res.json()
      if (res.ok && data.success) {
        setSuccess(`Updated user role to ${role}`)
        fetchMembers()
      } else {
        setError(data.error || 'Failed to update member role')
      }
    } catch (err) {
      setError('Network error occurred')
    }
  }

  const handleRemoveMember = async (memberId: string) => {
    if (!activeProject) return
    if (!confirm('Are you sure you want to remove this member from the team?')) return
    setError(null)
    setSuccess(null)

    try {
      const res = await fetch(
        `/api/teams/members?projectId=${activeProject.id}&memberId=${memberId}`,
        {
          method: 'DELETE',
        }
      )

      const data = await res.json()
      if (res.ok && data.success) {
        setSuccess('Removed member from the team')
        fetchMembers()
      } else {
        setError(data.error || 'Failed to remove team member')
      }
    } catch (err) {
      setError('Network error occurred')
    }
  }

  // Check if current user is Owner or Admin
  const activeUserMember = members.find((m) => m.user.id === user?.id)
  const isOwner = activeProject?.ownerId === user?.id
  const hasEditPermission = isOwner || activeUserMember?.role === 'OWNER' || activeUserMember?.role === 'ADMIN'

  return (
    <DashboardShell>
      <div className="space-y-8 max-w-5xl">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-3xl font-extrabold tracking-tight">Team Management</h2>
            <p className="text-muted-foreground text-sm mt-1">
              Invite teammates to collaborate on API configuration, view logs, and configure alerts.
            </p>
          </div>
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
            <Users className="h-12 w-12 text-muted-foreground/60 mx-auto mb-4" />
            <h3 className="text-lg font-bold">No active project</h3>
            <p className="text-muted-foreground text-sm mt-2">
              Create a project to start managing team members.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* 1. Invite Box */}
            <div className="lg:col-span-1">
              <div className="glass rounded-3xl p-6 border border-white/5 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary to-indigo-500" />
                <h3 className="text-lg font-bold mb-1 flex items-center space-x-2">
                  <UserPlus className="h-5 w-5 text-primary" />
                  <span>Invite Member</span>
                </h3>
                <p className="text-muted-foreground text-xs mb-6">
                  Add team members with specific roles (Admin or Member).
                </p>

                <form onSubmit={handleInvite} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      Email Address
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                      </span>
                      <input
                        type="email"
                        required
                        disabled={!hasEditPermission}
                        placeholder="developer@company.com"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        className="w-full pl-10 pr-3 py-2.5 bg-secondary/40 border border-border/80 rounded-xl text-foreground text-sm placeholder:text-muted-foreground/40 outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/60 transition-all disabled:opacity-55"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      Role
                    </label>
                    <select
                      value={inviteRole}
                      disabled={!hasEditPermission}
                      onChange={(e) => setInviteRole(e.target.value as any)}
                      className="w-full px-3 py-2.5 bg-secondary/40 border border-border/80 rounded-xl text-foreground text-sm outline-none focus:border-primary/60 transition-all cursor-pointer disabled:opacity-55"
                    >
                      <option value="MEMBER">Member (Read & Write keys/logs)</option>
                      <option value="ADMIN">Admin (Configure webhooks, endpoints)</option>
                    </select>
                  </div>

                  <button
                    type="submit"
                    disabled={inviteSubmitting || !inviteEmail || !hasEditPermission}
                    className="w-full py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-xl transition-all shadow-md flex items-center justify-center space-x-1.5 disabled:opacity-55 cursor-pointer"
                  >
                    {inviteSubmitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Plus className="h-4 w-4" />
                        <span>Send Invite</span>
                      </>
                    )}
                  </button>

                  {!hasEditPermission && (
                    <p className="text-[10px] text-destructive font-medium text-center">
                      Only Project Admins/Owners can invite members.
                    </p>
                  )}
                </form>
              </div>
            </div>

            {/* 2. Team Member List */}
            <div className="lg:col-span-2 space-y-4">
              <div className="glass rounded-3xl border border-white/5 overflow-hidden">
                <div className="p-6 border-b border-border/60 flex items-center justify-between">
                  <h3 className="text-lg font-bold flex items-center space-x-2">
                    <Users className="h-5 w-5 text-primary" />
                    <span>Teammates ({members.length})</span>
                  </h3>
                </div>

                {loading ? (
                  <div className="p-12 text-center">
                    <Loader2 className="h-8 w-8 text-primary animate-spin mx-auto mb-2" />
                    <p className="text-muted-foreground text-sm">Loading teammates...</p>
                  </div>
                ) : members.length === 0 ? (
                  <div className="p-12 text-center text-muted-foreground">
                    No members found.
                  </div>
                ) : (
                  <div className="divide-y divide-border/60">
                    {members.map((member) => {
                      const isOwnerRole = member.role === 'OWNER'
                      const isCurrentUser = member.user.id === user?.id
                      const isMainOwner = member.user.id === activeProject.ownerId

                      return (
                        <div
                          key={member.id}
                          className="p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 hover:bg-secondary/15 transition-all"
                        >
                          <div className="flex items-center space-x-3.5">
                            <div className="h-10 w-10 bg-primary/10 rounded-full flex items-center justify-center font-bold text-primary text-sm uppercase">
                              {member.user.name?.substring(0, 2) || member.user.email.substring(0, 2)}
                            </div>
                            <div>
                              <div className="font-semibold text-sm flex items-center space-x-1.5">
                                <span>{member.user.name}</span>
                                {isCurrentUser && (
                                  <span className="px-1.5 py-0.5 bg-secondary text-muted-foreground rounded text-[10px] font-bold">
                                    You
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground">{member.user.email}</div>
                            </div>
                          </div>

                          <div className="flex items-center space-x-3.5 sm:self-center">
                            {/* Role Badge / Dropdown */}
                            {hasEditPermission && !isMainOwner && !isCurrentUser ? (
                              <select
                                value={member.role}
                                onChange={(e) =>
                                  handleUpdateRole(member.id, e.target.value as any)
                                }
                                className="px-2.5 py-1 bg-secondary/80 border border-border/80 rounded-lg text-xs font-semibold outline-none focus:border-primary/60 transition-all cursor-pointer"
                              >
                                <option value="MEMBER">Member</option>
                                <option value="ADMIN">Admin</option>
                              </select>
                            ) : (
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider flex items-center space-x-1 ${
                                  isOwnerRole
                                    ? 'bg-amber-400/10 text-amber-400 border border-amber-400/20'
                                    : member.role === 'ADMIN'
                                    ? 'bg-primary/10 text-primary border border-primary/20'
                                    : 'bg-secondary text-muted-foreground'
                                }`}
                              >
                                {isOwnerRole ? (
                                  <>
                                    <Crown className="h-3 w-3 mr-0.5" />
                                    <span>Owner</span>
                                  </>
                                ) : (
                                  <>
                                    <Shield className="h-3 w-3 mr-0.5" />
                                    <span>{member.role}</span>
                                  </>
                                )}
                              </span>
                            )}

                            {/* Remove Member Action */}
                            {hasEditPermission && !isMainOwner && (!isCurrentUser || isOwner) ? (
                              <button
                                onClick={() => handleRemoveMember(member.id)}
                                className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-all cursor-pointer"
                                title="Remove Member"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            ) : null}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardShell>
  )
}
