'use client'

import React, { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useTheme } from '@/lib/theme-context'
import { useProject } from '@/lib/project-context'
import { useAuth } from '@/lib/auth-context'
import {
  Search,
  LayoutDashboard,
  Terminal,
  Key,
  Database,
  LineChart,
  Bell,
  Users,
  Settings,
  Sparkles,
  Moon,
  Sun,
  Plus,
} from 'lucide-react'

export default function CommandPalette() {
  const router = useRouter()
  const { toggleTheme, theme } = useTheme()
  const { setActiveProjectId, projects } = useProject()
  const { logout } = useAuth()
  
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Navigation pages commands
  const pages = [
    { name: 'Go to Overview', href: '/dashboard', icon: LayoutDashboard, category: 'Navigation' },
    { name: 'Go to API Endpoints', href: '/dashboard/endpoints', icon: Terminal, category: 'Navigation' },
    { name: 'Go to API Key Management', href: '/dashboard/api-keys', icon: Key, category: 'Navigation' },
    { name: 'Go to Request Logs', href: '/dashboard/logs', icon: Database, category: 'Navigation' },
    { name: 'Go to Analytics & Charts', href: '/dashboard/analytics', icon: LineChart, category: 'Navigation' },
    { name: 'Go to Alerts Panel', href: '/dashboard/alerts', icon: Bell, category: 'Navigation' },
    { name: 'Go to Team Management', href: '/dashboard/team', icon: Users, category: 'Navigation' },
    { name: 'Go to Project Settings', href: '/dashboard/settings', icon: Settings, category: 'Navigation' },
  ]

  // Action commands
  const actions = [
    { name: 'Ask AI Reliability Co-pilot', action: () => router.push('/dashboard/analytics?tab=ai'), icon: Sparkles, category: 'AI Tools' },
    { name: 'Toggle Color Theme (Dark/Light)', action: () => toggleTheme(), icon: theme === 'light' ? Moon : Sun, category: 'Preferences' },
    { name: 'Log Out of Session', action: () => logout(), icon: Settings, category: 'Account' },
  ]

  // Project switch commands
  const projectCommands = projects.map(p => ({
    name: `Switch Project to "${p.name}"`,
    action: () => setActiveProjectId(p.id),
    icon: Terminal,
    category: 'Projects'
  }))

  const allItems = [...pages, ...actions, ...projectCommands]

  const filteredItems = allItems.filter(item =>
    item.name.toLowerCase().includes(search.toLowerCase()) ||
    item.category.toLowerCase().includes(search.toLowerCase())
  )

  // Listen to Cmd+K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((o) => !o)
        setSearch('')
        setSelectedIndex(0)
      }
      if (e.key === 'Escape') {
        setOpen(false)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Auto-focus input when palette opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50)
      setSelectedIndex(0)
    }
  }, [open, search])

  // Handle arrow key selection
  useEffect(() => {
    const handleNavigation = (e: KeyboardEvent) => {
      if (!open) return
      
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex(prev => (prev + 1) % Math.max(1, filteredItems.length))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex(prev => (prev - 1 + filteredItems.length) % Math.max(1, filteredItems.length))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        if (filteredItems[selectedIndex]) {
          triggerItem(filteredItems[selectedIndex])
        }
      }
    }
    document.addEventListener('keydown', handleNavigation)
    return () => document.removeEventListener('keydown', handleNavigation)
  }, [open, filteredItems, selectedIndex])

  const triggerItem = (item: any) => {
    if (item.href) {
      router.push(item.href)
    } else if (item.action) {
      item.action()
    }
    setOpen(false)
  }

  // Handle click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  if (!open) return null

  // Group items by category for cleaner UI
  const categories: Record<string, typeof filteredItems> = {}
  filteredItems.forEach(item => {
    if (!categories[item.category]) {
      categories[item.category] = []
    }
    categories[item.category].push(item)
  })

  // Flattened items count to map indexes
  let flatIndex = 0

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-start justify-center pt-24 p-4 animate-fade-in">
      <div
        ref={containerRef}
        className="bg-card border border-border/80 w-full max-w-xl rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[500px]"
      >
        {/* Search header */}
        <div className="flex items-center px-4 border-b border-border/60">
          <Search className="h-4 w-4 text-muted-foreground mr-3" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Type a command, page name, or project to search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full py-4 bg-transparent border-none text-foreground text-sm placeholder:text-muted-foreground/50 outline-none"
          />
          <kbd className="px-2 py-0.5 bg-secondary border border-border text-[9px] text-muted-foreground rounded-md font-semibold">
            ESC
          </kbd>
        </div>

        {/* Command list */}
        <div className="flex-1 overflow-y-auto p-2 space-y-4">
          {filteredItems.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No results found matching your search.
            </div>
          ) : (
            Object.entries(categories).map(([cat, items]) => (
              <div key={cat} className="space-y-1">
                <div className="px-3 py-1.5 text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                  {cat}
                </div>
                {items.map(item => {
                  const currentFlatIndex = flatIndex++
                  const isSelected = selectedIndex === currentFlatIndex

                  return (
                    <button
                      key={item.name}
                      onClick={() => triggerItem(item)}
                      onMouseEnter={() => setSelectedIndex(currentFlatIndex)}
                      className={`w-full text-left px-3 py-2 text-sm rounded-xl flex items-center justify-between cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-primary text-primary-foreground font-semibold shadow-md shadow-primary/10'
                          : 'hover:bg-secondary/60 text-foreground'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <item.icon className={`h-4.5 w-4.5 ${isSelected ? 'text-primary-foreground' : 'text-muted-foreground'}`} />
                        <span>{item.name}</span>
                      </div>
                      {isSelected && (
                        <span className="text-[10px] bg-primary-foreground/15 text-primary-foreground px-1.5 py-0.5 rounded font-mono font-bold uppercase">
                          ENTER
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            ))
          )}
        </div>
        
        {/* Footer shortcuts */}
        <div className="bg-secondary/40 border-t border-border/60 px-4 py-2.5 flex justify-between items-center text-[10px] text-muted-foreground">
          <div className="flex space-x-3.5">
            <span>↑↓ to navigate</span>
            <span>↵ to select</span>
          </div>
          <div>APIMon Palette</div>
        </div>
      </div>
    </div>
  )
}
