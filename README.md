# APIMon - API Monitoring & Rate Limiting SaaS Platform

APIMon is a production-ready, full-stack SaaS platform built with Next.js (App Router), TypeScript, Prisma, PostgreSQL, and Upstash Redis. It enables developers to secure their backend APIs with rate limiters, monitor endpoint uptime and latencies, inspect detailed request logs, configure Discord/Slack alert triggers, and query intelligent reliability insights powered by Gemini.

---

## 🚀 Key Features

*   **Intelligent API Gateway / Proxy (`/api/v1/*`)**: Intercepts client traffic, performs key authorization, checks rate limits, forwards requests to target base URLs, measures response latency, and returns payloads.
*   **Intelligent Rate Limiter**: Per API Key limiting configurations supporting **Sliding Window**, **Fixed Window**, and **Token Bucket** algorithms. backed by Upstash Redis with local memory fallbacks.
*   **Endpoint Uptime Monitors**: Continuously track target route availability, status codes, and latencies. Supported by manual and automated ping check triggers.
*   **Request Logs & CSV Export**: Search, filter, and paginate through request histories. Inspect request payloads, IP addresses, geo-locations, and user agents, and export results to CSV.
*   **Alert Configuration & Webhooks**: Configure triggers on API Downtime, High Latency, or Error Rates, and deliver dispatch logs to Slack/Discord Webhooks or Email.
*   **AI Reliability Inspector**: Powered by Gemini. Analyzes project logs to diagnose slow endpoints, error trends, security anomalies, and suggest optimal rate limits.
*   **Interactive Command Palette (⌘K / Ctrl+K)**: Instant page jumps, project toggles, theme switching, and diagnostics activations.
*   **Premium Dark Design & Responsive Layout**: Responsive dashboard layout featuring sleek dark borders, glassmorphic cards, and interactive Recharts graphs.

---

## 🛠️ Tech Stack

*   **Framework**: Next.js 16 (App Router, React 19)
*   **Language**: TypeScript (Strict Mode)
*   **Styling**: Tailwind CSS v4, Lucide Icons, Glassmorphism utilities
*   **Database**: Neon PostgreSQL, Prisma ORM 7
*   **Rate Limiter / Cache**: Upstash Redis (or local in-memory fallback)
*   **Charts & Visualizations**: Recharts
*   **AI Engine**: Google Gen AI SDK (`@google/genai` with Gemini 2.5 Flash)
*   **Validation**: Zod schema validators

---

## 📂 Documentation

Full documentation is available in the [`docs/`](/docs) folder:

1.  [**System Architecture & Flow Diagrams**](/docs/architecture.md): Overview of components, routing middleware boundaries, and proxy gateway sequence.
2.  [**Setup & Local Installation**](/docs/setup_guide.md): Steps to configure environment variables, PostgreSQL, Prisma client generation, and starting the server.
3.  [**API Gateway Documentation**](/docs/api_documentation.md): API Key header formats, endpoint parameters, and HTTP responses (including Rate Limit headers and 429 Too Many Requests).
4.  [**Deployment Guide**](/docs/deployment_guide.md): Instructions for hosting the Next.js app on Vercel, deploying PostgreSQL on Neon, and Redis on Upstash.

---

## 🚦 Quick Setup

### 1. Clone & Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env` and fill in credentials:
```bash
cp .env.example .env
```

### 3. Generate Prisma Client
Ensure database connection is set, then generate the client:
```bash
npx prisma generate
```

### 4. Run database migrations / setup
Apply the schema directly to your PostgreSQL database:
```bash
npx prisma db push
```

### 5. Start Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view the platform.

---

## 🧪 Testing

### Running Tests
To run unit and integration tests:
```bash
npm run test
```

### Production Build Validation
Ensure there are no lint or compilation errors:
```bash
npm run build
```
