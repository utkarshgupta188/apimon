'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { useTheme } from '@/lib/theme-context'
import { useProject, Project } from '@/lib/project-context'
import {
  Activity,
  LayoutDashboard,
  Terminal,
  Key,
  Database,
  LineChart,
  Bell,
  Users,
  Settings,
  LogOut,
  Sun,
  Moon,
  Menu,
  X,
  Plus,
  ChevronDown,
  Sparkles,
  Command,
} from 'lucide-react'

interface DashboardShellProps {
  children: React.ReactNode
}

export default function DashboardShell({ children }: DashboardShellProps) {
  const pathname = usePathname()
  const { user, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const { projects, activeProject, setActiveProjectId, createProject, loading: projectsLoading } = useProject()
  
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [projectDropdownOpen, setProjectDropdownOpen] = useState(false)
  const [newProjectModalOpen, setNewProjectModalOpen] = useState(false)
  
  // New Project Form State
  const [newProjName, setNewProjName] = useState('')
  const [newProjDesc, setNewProjDesc] = useState('')
  const [newProjEnv, setNewProjEnv] = useState<'PRODUCTION' | 'STAGING' | 'DEVELOPMENT'>('DEVELOPMENT')
  const [newProjUrl, setNewProjUrl] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const navigation = [
    { name: 'Overview', href: '/dashboard', icon: LayoutDashboard },
    { name: 'API Endpoints', href: '/dashboard/endpoints', icon: Terminal },
    { name: 'API Key Management', href: '/dashboard/api-keys', icon: Key },
    { name: 'Request Logs', href: '/dashboard/logs', icon: Database },
    { name: 'Analytics', href: '/dashboard/analytics', icon: LineChart },
    { name: 'Alerts', href: '/dashboard/alerts', icon: Bell },
    { name: 'Team Management', href: '/dashboard/team', icon: Users },
    { name: 'Settings', href: '/dashboard/settings', icon: Settings },
  ]

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreateError(null)
    setCreating(true)

    try {
      const result = await createProject(newProjName, newProjDesc, newProjEnv, newProjUrl)
      if (result.success) {
        setNewProjName('')
        setNewProjDesc('')
        setNewProjEnv('DEVELOPMENT')
        setNewProjUrl('')
        setNewProjectModalOpen(false)
      } else {
        setCreateError(result.error || 'Failed to create project')
      }
    } catch (err) {
      setCreateError('An unexpected error occurred')
    } finally {
      setCreating(false)
    }
  }

  const currentNavName = navigation.find((item) => {
    if (item.href === '/dashboard') {
      return pathname === '/dashboard'
    }
    return pathname.startsWith(item.href)
  })?.name || 'Dashboard'

  return (
    <div className="min-h-screen flex bg-background text-foreground transition-colors duration-200">
      {/* 1. Desktop Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 border-r border-border/60 bg-card/30 backdrop-blur-md z-30">
        {/* Brand logo */}
        <div className="flex h-16 items-center px-6 border-b border-border/60 justify-between">
          <Link href="/dashboard" className="flex items-center space-x-2.5">
            <Activity className="h-6 w-6 text-primary animate-pulse" />
            <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent">
              APIMon
            </span>
          </Link>
          <div className="flex items-center space-x-1">
            {/* AI Assistant shortcut indicator */}
            <span className="p-1 bg-primary/10 border border-primary/20 rounded-md text-[10px] text-primary font-semibold flex items-center space-x-0.5">
              <Sparkles className="h-2.5 w-2.5" />
              <span>AI</span>
            </span>
          </div>
        </div>

        {/* Project Selector */}
        <div className="px-4 py-4 border-b border-border/40 relative">
          <button
            onClick={() => setProjectDropdownOpen(!projectDropdownOpen)}
            className="w-full flex items-center justify-between px-3 py-2 bg-secondary/50 border border-border/60 hover:bg-secondary/80 rounded-xl text-sm font-medium transition-all outline-none cursor-pointer"
          >
            <span className="truncate">
              {projectsLoading ? 'Loading projects...' : activeProject?.name || 'Select Project'}
            </span>
            <ChevronDown className="h-4 w-4 ml-2 text-muted-foreground" />
          </button>

          {projectDropdownOpen && (
            <div className="absolute left-4 right-4 mt-2 bg-card border border-border rounded-xl shadow-2xl p-1.5 z-45 max-h-60 overflow-y-auto">
              <div className="text-[10px] font-semibold text-muted-foreground px-2.5 py-1.5 uppercase tracking-wider">
                Projects
              </div>
              {projects.map((proj) => (
                <button
                  key={proj.id}
                  onClick={() => {
                    setActiveProjectId(proj.id)
                    setProjectDropdownOpen(false)
                  }}
                  className={`w-full text-left px-2.5 py-2 text-sm rounded-lg flex items-center justify-between cursor-pointer ${
                    activeProject?.id === proj.id
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'hover:bg-secondary/80 text-foreground'
                  }`}
                >
                  <span className="truncate">{proj.name}</span>
                  <span className="text-[10px] uppercase font-bold text-muted-foreground/60 px-1.5 py-0.5 bg-secondary rounded">
                    {proj.environment.substring(0, 3)}
                  </span>
                </button>
              ))}
              <div className="border-t border-border/50 my-1" />
              <button
                onClick={() => {
                  setNewProjectModalOpen(true)
                  setProjectDropdownOpen(false)
                }}
                className="w-full text-left px-2.5 py-2 text-sm text-primary hover:bg-primary/5 rounded-lg flex items-center space-x-1.5 font-medium cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                <span>Create Project</span>
              </button>
            </div>
          )}
        </div>

        {/* Navigation list */}
        <nav className="flex-1 px-4 py-4 space-y-1.5 overflow-y-auto">
          {navigation.map((item) => {
            const isActive =
              item.href === '/dashboard'
                ? pathname === '/dashboard'
                : pathname.startsWith(item.href)
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center px-3.5 py-2.5 text-sm font-medium rounded-xl transition-all ${
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
                    : 'text-muted-foreground hover:bg-secondary/40 hover:text-foreground'
                }`}
              >
                <item.icon className="h-5 w-5 mr-3 flex-shrink-0" />
                <span>{item.name}</span>
              </Link>
            )
          })}
        </nav>

        {/* User profile footer */}
        <div className="p-4 border-t border-border/60 flex items-center justify-between bg-card/10">
          <div className="flex items-center space-x-3 truncate">
            <div className="h-9 w-9 bg-primary/15 rounded-full flex items-center justify-center font-bold text-primary text-sm uppercase">
              {user?.name?.substring(0, 2) || user?.email.substring(0, 2) || 'US'}
            </div>
            <div className="truncate">
              <div className="text-sm font-semibold truncate text-foreground">{user?.name}</div>
              <div className="text-xs text-muted-foreground truncate">{user?.email}</div>
            </div>
          </div>
          <button
            onClick={logout}
            className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-all cursor-pointer"
            title="Log Out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </aside>

      {/* 2. Mobile Nav & Layout */}
      <div className="flex-1 lg:pl-64 flex flex-col min-h-screen">
        {/* Top Navbar */}
        <header className="sticky top-0 h-16 border-b border-border/60 bg-background/70 backdrop-blur-md flex items-center justify-between px-4 sm:px-6 lg:px-8 z-25">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-secondary/80 outline-none cursor-pointer"
            >
              <Menu className="h-6 w-6" />
            </button>
            <h1 className="text-lg font-bold text-foreground">
              {currentNavName}
            </h1>
          </div>

          <div className="flex items-center space-x-3">
            {/* Command Palette Indicator */}
            <button
              onClick={() => {
                const event = new KeyboardEvent('keydown', {
                  key: 'k',
                  metaKey: true,
                  bubbles: true,
                })
                document.dispatchEvent(event)
              }}
              className="hidden md:flex items-center space-x-2 px-3 py-1.5 bg-secondary/50 border border-border/60 rounded-xl text-xs text-muted-foreground hover:border-primary/40 hover:text-foreground transition-all outline-none cursor-pointer"
            >
              <Command className="h-3.5 w-3.5" />
              <span>Search / Ask AI</span>
              <kbd className="px-1.5 py-0.5 bg-card border border-border rounded text-[10px]">⌘K</kbd>
            </button>

            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary/50 border border-border/60 rounded-xl transition-all outline-none cursor-pointer"
            >
              {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            </button>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          {children}
        </main>
      </div>

      {/* 3. Mobile Sidebar overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          {/* Overlay backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          />

          {/* Slideout content */}
          <div className="relative flex flex-col w-full max-w-xs bg-card border-r border-border text-foreground pt-5 pb-4">
            <div className="absolute top-0 right-0 -mr-12 pt-2">
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="ml-1 flex items-center justify-center h-10 w-10 rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white cursor-pointer"
              >
                <X className="h-6 w-6 text-white" />
              </button>
            </div>

            {/* Brand logo */}
            <div className="flex items-center px-4 mb-6">
              <Activity className="h-6 w-6 text-primary mr-2" />
              <span className="font-extrabold text-lg tracking-tight">APIMon</span>
            </div>

            {/* Active Project Info in Mobile */}
            <div className="px-4 mb-4">
              <div className="bg-secondary/50 border border-border rounded-xl p-3 text-sm font-semibold">
                <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-1">Active Project</div>
                <div className="truncate">{activeProject?.name || 'No Active Project'}</div>
              </div>
            </div>

            {/* Navigation links */}
            <nav className="flex-1 px-2 space-y-1 overflow-y-auto">
              {navigation.map((item) => {
                const isActive =
                  item.href === '/dashboard'
                    ? pathname === '/dashboard'
                    : pathname.startsWith(item.href)
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center px-3 py-2.5 text-sm font-medium rounded-xl transition-all ${
                      isActive
                        ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
                        : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground'
                    }`}
                  >
                    <item.icon className="h-5 w-5 mr-3 flex-shrink-0" />
                    <span>{item.name}</span>
                  </Link>
                )
              })}
            </nav>

            {/* User footer mobile */}
            <div className="p-4 border-t border-border flex items-center justify-between">
              <div className="flex items-center space-x-3 truncate">
                <div className="h-9 w-9 bg-primary/15 rounded-full flex items-center justify-center font-bold text-primary text-sm uppercase">
                  {user?.name?.substring(0, 2) || user?.email.substring(0, 2) || 'US'}
                </div>
                <div className="truncate">
                  <div className="text-sm font-semibold truncate text-foreground">{user?.name}</div>
                  <div className="text-xs text-muted-foreground truncate">{user?.email}</div>
                </div>
              </div>
              <button
                onClick={logout}
                className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-all cursor-pointer"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. New Project Modal */}
      {newProjectModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-3xl w-full max-w-md p-6 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary to-indigo-500" />
            <h3 className="text-lg font-bold mb-4">Create New Project</h3>

            <form onSubmit={handleCreateProject} className="space-y-4">
              {createError && (
                <div className="p-3 bg-destructive/15 border border-destructive/20 text-destructive text-sm rounded-xl">
                  {createError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Project Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="E.g. API Gateway"
                  value={newProjName}
                  onChange={(e) => setNewProjName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-secondary/40 border border-border/80 rounded-xl text-foreground text-sm placeholder:text-muted-foreground/40 outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/60 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Description
                </label>
                <textarea
                  placeholder="Optional project details..."
                  value={newProjDesc}
                  onChange={(e) => setNewProjDesc(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-secondary/40 border border-border/80 rounded-xl text-foreground text-sm placeholder:text-muted-foreground/40 outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/60 transition-all h-20 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    Environment
                  </label>
                  <select
                    value={newProjEnv}
                    onChange={(e) => setNewProjEnv(e.target.value as any)}
                    className="w-full px-3 py-2.5 bg-secondary/40 border border-border/80 rounded-xl text-foreground text-sm outline-none focus:border-primary/60 transition-all cursor-pointer"
                  >
                    <option value="DEVELOPMENT">Development</option>
                    <option value="STAGING">Staging</option>
                    <option value="PRODUCTION">Production</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    Base URL (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="https://api.my-app.com"
                    value={newProjUrl}
                    onChange={(e) => setNewProjUrl(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-secondary/40 border border-border/80 rounded-xl text-foreground text-sm placeholder:text-muted-foreground/40 outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/60 transition-all"
                  />
                </div>
              </div>

              <div className="flex space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setNewProjectModalOpen(false)}
                  className="w-1/2 py-2.5 border border-border hover:bg-secondary/80 text-foreground font-semibold rounded-xl transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="w-1/2 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-xl transition-all flex items-center justify-center disabled:opacity-60 cursor-pointer"
                >
                  {creating ? (
                    <div className="h-4.5 w-4.5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                  ) : (
                    'Create Project'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
