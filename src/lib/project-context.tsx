'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { useAuth } from './auth-context'

export interface Project {
  id: string
  name: string
  description: string | null
  environment: 'PRODUCTION' | 'STAGING' | 'DEVELOPMENT'
  baseUrl: string | null
  ownerId: string
  createdAt: string
  updatedAt: string
}

interface ProjectContextType {
  projects: Project[]
  activeProject: Project | null
  loading: boolean
  activeProjectId: string | null
  setActiveProjectId: (id: string) => void
  createProject: (name: string, description?: string, environment?: string, baseUrl?: string) => Promise<{ success: boolean; project?: Project; error?: string }>
  updateProject: (id: string, data: Partial<Omit<Project, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>>) => Promise<{ success: boolean; project?: Project; error?: string }>
  deleteProject: (id: string) => Promise<{ success: boolean; error?: string }>
  refreshProjects: () => Promise<void>
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined)

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [projects, setProjects] = useState<Project[]>([])
  const [activeProjectId, setActiveProjectIdState] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const refreshProjects = async () => {
    if (!user) {
      setProjects([])
      setActiveProjectIdState(null)
      setLoading(false)
      return
    }

    try {
      const res = await fetch('/api/projects')
      if (res.ok) {
        const data = await res.json()
        setProjects(data.projects || [])
        
        // Restore active project from local storage or choose first
        const savedId = localStorage.getItem('apimon_active_project_id')
        const exists = data.projects?.some((p: Project) => p.id === savedId)
        
        if (savedId && exists) {
          setActiveProjectIdState(savedId)
        } else if (data.projects && data.projects.length > 0) {
          setActiveProjectIdState(data.projects[0].id)
          localStorage.setItem('apimon_active_project_id', data.projects[0].id)
        } else {
          setActiveProjectIdState(null)
        }
      }
    } catch (e) {
      console.error('Failed to load projects:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refreshProjects()
  }, [user])

  const setActiveProjectId = (id: string) => {
    setActiveProjectIdState(id)
    localStorage.setItem('apimon_active_project_id', id)
  }

  const createProject = async (name: string, description?: string, environment?: string, baseUrl?: string) => {
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, environment, baseUrl }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        const newProject = data.project
        setProjects(prev => [...prev, newProject])
        setActiveProjectId(newProject.id)
        return { success: true, project: newProject }
      } else {
        return { success: false, error: data.error || 'Failed to create project' }
      }
    } catch (e) {
      return { success: false, error: 'Network error occurred' }
    }
  }

  const updateProject = async (id: string, updatedFields: Partial<Omit<Project, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>>) => {
    try {
      const res = await fetch(`/api/projects?id=${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedFields),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setProjects(prev => prev.map(p => p.id === id ? data.project : p))
        return { success: true, project: data.project }
      } else {
        return { success: false, error: data.error || 'Failed to update project' }
      }
    } catch (e) {
      return { success: false, error: 'Network error occurred' }
    }
  }

  const deleteProject = async (id: string) => {
    try {
      const res = await fetch(`/api/projects?id=${id}`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (res.ok && data.success) {
        const remaining = projects.filter(p => p.id !== id)
        setProjects(remaining)
        if (activeProjectId === id) {
          if (remaining.length > 0) {
            setActiveProjectId(remaining[0].id)
          } else {
            setActiveProjectIdState(null)
            localStorage.removeItem('apimon_active_project_id')
          }
        }
        return { success: true }
      } else {
        return { success: false, error: data.error || 'Failed to delete project' }
      }
    } catch (e) {
      return { success: false, error: 'Network error occurred' }
    }
  }

  const activeProject = projects.find(p => p.id === activeProjectId) || null

  return (
    <ProjectContext.Provider
      value={{
        projects,
        activeProject,
        loading,
        activeProjectId,
        setActiveProjectId,
        createProject,
        updateProject,
        deleteProject,
        refreshProjects,
      }}
    >
      {children}
    </ProjectContext.Provider>
  )
}

export function useProject() {
  const context = useContext(ProjectContext)
  if (context === undefined) {
    throw new Error('useProject must be used within a ProjectProvider')
  }
  return context
}
