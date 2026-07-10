import Link from 'next/link'
import { Activity, Shield, Zap, BarChart2, Bell, Cpu, ArrowRight } from 'lucide-react'

export default function Home() {
  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-background to-background text-foreground overflow-hidden">
      {/* Navbar */}
      <header className="border-b border-white/5 py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Activity className="h-6 w-6 text-primary animate-pulse" />
            <span className="text-xl font-bold tracking-tight">APIMon</span>
          </div>
          <nav className="flex items-center space-x-4">
            <Link href="/login" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-all">
              Log In
            </Link>
            <Link href="/signup" className="text-sm font-semibold px-4 py-2 bg-primary hover:bg-primary/95 text-primary-foreground rounded-xl transition-all shadow-md hover:shadow-primary/10">
              Sign Up
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <main className="relative pt-20 pb-24 sm:pt-28">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl -z-10 pointer-events-none" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          
          <div className="inline-flex items-center space-x-2 px-3 py-1 bg-primary/10 border border-primary/20 rounded-full text-xs font-semibold text-primary mb-6 animate-fade-in">
            <Zap className="h-3.5 w-3.5" />
            <span>Next-Gen API Gateway & Analytics</span>
          </div>

          <h1 className="text-5xl sm:text-6xl md:text-7xl font-extrabold tracking-tight max-w-4xl mx-auto leading-none bg-gradient-to-b from-white to-slate-400 bg-clip-text text-transparent">
            API Monitoring & Rate Limiting Platform
          </h1>
          
          <p className="mt-6 text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto">
            Take full control of your APIs. Secure with token-bucket, sliding, or fixed-window rate limiting. Monitor uptime, measure response times, and get AI performance analysis.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/signup"
              className="w-full sm:w-auto px-8 py-4 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-2xl transition-all shadow-lg hover:shadow-primary/20 flex items-center justify-center space-x-2 group cursor-pointer"
            >
              <span>Get Started Free</span>
              <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              href="/login"
              className="w-full sm:w-auto px-8 py-4 bg-secondary/60 hover:bg-secondary/80 border border-border text-foreground font-semibold rounded-2xl transition-all flex items-center justify-center cursor-pointer"
            >
              Live Demo
            </Link>
          </div>
        </div>

        {/* Feature Grid */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-32">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="glass rounded-3xl p-8 border border-white/5 shadow-xl hover:border-primary/20 transition-all group">
              <div className="p-3 bg-primary/10 w-fit rounded-2xl mb-6 text-primary group-hover:scale-110 transition-transform">
                <Zap className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold mb-3">Intelligent Rate Limiter</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Configure request thresholds per API Key. Supports Token Bucket, Sliding Window, and Fixed Window algorithms backed by Redis.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="glass rounded-3xl p-8 border border-white/5 shadow-xl hover:border-primary/20 transition-all group">
              <div className="p-3 bg-purple-500/10 w-fit rounded-2xl mb-6 text-purple-400 group-hover:scale-110 transition-transform">
                <BarChart2 className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold mb-3">Real-time Analytics</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Track status code distribution, average latency, geographic traffic distribution, and top API endpoints using beautiful interactive charts.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="glass rounded-3xl p-8 border border-white/5 shadow-xl hover:border-primary/20 transition-all group">
              <div className="p-3 bg-emerald-500/10 w-fit rounded-2xl mb-6 text-emerald-400 group-hover:scale-110 transition-transform">
                <Cpu className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold mb-3">AI Monitoring Copilot</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Powered by Gemini. Analyzes request logs to automatically detect slow endpoints, security anomalies, and suggest optimal rate limits.
              </p>
            </div>
          </div>
        </section>

        {/* Security / Alerts section */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-24">
          <div className="glass rounded-[32px] p-8 sm:p-12 border border-white/5 flex flex-col lg:flex-row items-center justify-between gap-12 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-80 h-80 bg-primary/10 rounded-full blur-3xl -z-10" />
            <div className="max-w-xl">
              <span className="flex items-center space-x-2 text-primary font-semibold text-sm mb-4">
                <Bell className="h-4 w-4 animate-bounce" />
                <span>Instant Alerts</span>
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
                Get notified before your users notice.
              </h2>
              <p className="mt-4 text-muted-foreground leading-relaxed">
                Set up triggers for API downtime, high latency, or elevated error rates. Deliver notifications instantly to Slack webhooks, Discord channels, or Email.
              </p>
              <div className="mt-6 flex flex-wrap gap-4 text-xs font-semibold text-muted-foreground">
                <span className="px-3 py-1.5 bg-secondary/80 rounded-lg flex items-center space-x-1">
                  <Shield className="h-3.5 w-3.5" />
                  <span>Role-Based Access (RBAC)</span>
                </span>
                <span className="px-3 py-1.5 bg-secondary/80 rounded-lg flex items-center space-x-1">
                  <Cpu className="h-3.5 w-3.5" />
                  <span>Interactive API Playground</span>
                </span>
              </div>
            </div>

            <div className="w-full lg:w-96 flex flex-col space-y-4">
              <div className="bg-secondary/40 border border-border/60 rounded-2xl p-4 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="h-3 w-3 bg-emerald-500 rounded-full animate-ping" />
                  <div>
                    <div className="font-semibold text-sm">Uptime Monitor</div>
                    <div className="text-xs text-muted-foreground">99.98% Monthly average</div>
                  </div>
                </div>
                <div className="text-xs text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded font-semibold">Active</div>
              </div>
              
              <div className="bg-secondary/40 border border-border/60 rounded-2xl p-4 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-indigo-500/10 rounded-xl text-primary">
                    <Zap className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="font-semibold text-sm">Rate Limiter Middleware</div>
                    <div className="text-xs text-muted-foreground">3 strategies supported</div>
                  </div>
                </div>
                <div className="text-xs text-primary bg-primary/10 px-2 py-1 rounded font-semibold">Sliding Window</div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 py-8 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div>&copy; {new Date().getFullYear()} APIMon. All rights reserved.</div>
          <div className="flex space-x-6">
            <a href="#" className="hover:text-foreground">Terms</a>
            <a href="#" className="hover:text-foreground">Privacy</a>
            <a href="#" className="hover:text-foreground">Docs</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
