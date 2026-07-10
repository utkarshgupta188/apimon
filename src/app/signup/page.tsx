'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import { Activity, Shield, Zap, Lock, Mail, User } from 'lucide-react'

export default function SignupPage() {
  const { signup, loading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    try {
      const result = await signup(email, password, name)
      if (!result.success) {
        setError(result.error || 'Failed to sign up')
      }
    } catch (err) {
      setError('An unexpected error occurred')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/40 via-background to-background p-4">
      {/* Background design elements */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl -z-10 pointer-events-none animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl -z-10 pointer-events-none" />

      <div className="w-full max-w-md">
        {/* Logo Header */}
        <div className="flex flex-col items-center mb-8">
          <div className="p-3 bg-primary/15 border border-primary/20 rounded-2xl mb-4">
            <Activity className="h-10 w-10 text-primary" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
            APIMon
          </h1>
          <p className="text-muted-foreground mt-2 text-center text-sm">
            API Monitoring & Intelligent Rate Limiting Platform
          </p>
        </div>

        {/* Card */}
        <div className="glass rounded-3xl p-8 border border-white/5 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-purple-500 to-indigo-500" />
          
          <h2 className="text-2xl font-bold mb-6 text-foreground">
            Create an Account
          </h2>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="p-4 bg-destructive/15 border border-destructive/20 text-destructive text-sm rounded-xl">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                Full Name
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <User className="h-5 w-5 text-muted-foreground/60" />
                </span>
                <input
                  type="text"
                  required
                  placeholder="John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-secondary/40 border border-border/80 focus:border-primary/60 focus:ring-1 focus:ring-primary/60 rounded-xl text-foreground text-sm placeholder:text-muted-foreground/50 transition-all outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                Email Address
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <Mail className="h-5 w-5 text-muted-foreground/60" />
                </span>
                <input
                  type="email"
                  required
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-secondary/40 border border-border/80 focus:border-primary/60 focus:ring-1 focus:ring-primary/60 rounded-xl text-foreground text-sm placeholder:text-muted-foreground/50 transition-all outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                Password
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <Lock className="h-5 w-5 text-muted-foreground/60" />
                </span>
                <input
                  type="password"
                  required
                  placeholder="Min. 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-secondary/40 border border-border/80 focus:border-primary/60 focus:ring-1 focus:ring-primary/60 rounded-xl text-foreground text-sm placeholder:text-muted-foreground/50 transition-all outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting || loading}
              className="w-full py-3 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-xl transition-all shadow-lg hover:shadow-primary/20 flex items-center justify-center space-x-2 disabled:opacity-55 cursor-pointer"
            >
              {submitting ? (
                <div className="h-5 w-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Zap className="h-5 w-5" />
                  <span>Start Monitoring Free</span>
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-white/5 text-center text-sm">
            <span className="text-muted-foreground">Already have an account?</span>{' '}
            <Link
              href="/login"
              className="text-primary hover:text-primary/80 font-medium transition-all"
            >
              Log In
            </Link>
          </div>
        </div>

        {/* Footnotes */}
        <div className="mt-8 flex justify-center space-x-6 text-xs text-muted-foreground/60">
          <span className="flex items-center space-x-1">
            <Shield className="h-3 w-3" />
            <span>Secure RBAC</span>
          </span>
          <span className="flex items-center space-x-1">
            <Zap className="h-3 w-3" />
            <span>Upstash Redis Rate Limits</span>
          </span>
        </div>
      </div>
    </div>
  )
}
