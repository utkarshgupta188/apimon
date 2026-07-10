# Deployment Guide

This guide explains how to deploy the APIMon platform to production using Vercel, Neon PostgreSQL, and Upstash Redis.

---

## 💾 1. Database Setup (Neon PostgreSQL)

1.  Sign up at [Neon.tech](https://neon.tech) and create a new project.
2.  Choose **PostgreSQL** as the database version.
3.  Copy the connection string (e.g., `postgresql://username:password@neon-host/neondb?sslmode=require`).
4.  This string will be your `DATABASE_URL` in production.

---

## ⚡ 2. Redis Setup (Upstash Redis)

1.  Sign up at [Upstash.com](https://upstash.com) and create a new serverless Redis database.
2.  Select your preferred region.
3.  Scroll down to the **REST API** section of your Upstash console and copy the credentials:
    *   `UPSTASH_REDIS_REST_URL`
    *   `UPSTASH_REDIS_REST_TOKEN`
4.  These details will ensure your sliding-window and token-bucket rate limits are synced across all serverless Vercel function instances.

---

## 🚀 3. Hosting Setup (Vercel)

### 1. Project Creation
1.  Import your APIMon GitHub repository into Vercel.
2.  Select **Next.js** as the framework preset (Vercel detects this automatically).

### 2. Environment Variables Configuration
In Vercel Project Settings, add the following environment variables:
*   `DATABASE_URL` (Your Neon connection string)
*   `SESSION_SECRET` (A secure random string of 32+ characters)
*   `UPSTASH_REDIS_REST_URL` (Your Upstash URL)
*   `UPSTASH_REDIS_REST_TOKEN` (Your Upstash Token)
*   `GEMINI_API_KEY` (Your Google AI Studio Gemini API Key)
*   `NEXT_PUBLIC_APP_URL` (Your production Vercel deployment URL, e.g. `https://apimon.vercel.app`)

### 3. Deploy
1.  Click **Deploy**.
2.  Vercel will build the Next.js App Router static pages, compile the Prisma Client, and launch the platform.
3.  Ensure you run database migration pushes inside your deployment pipeline or trigger a migration beforehand:
    ```bash
    npx prisma db push
    ```
