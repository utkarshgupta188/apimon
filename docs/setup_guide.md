# Setup & Installation Guide

Follow these steps to configure your local development environment and run the APIMon platform.

---

## 📋 Prerequisites

Ensure you have the following installed:
*   **Node.js**: Version 20.9.0 or later (Node 24 recommended).
*   **npm**: Version 10 or later (npm 11 recommended).
*   **Git**: For version control.
*   **PostgreSQL**: A running instance (local installation or hosted Neon PostgreSQL database).

---

## ⚙️ Step-by-Step Installation

### 1. Clone Project
```bash
git clone <repository-url>
cd apimon
```

### 2. Install Package Dependencies
```bash
npm install
```
This installs the required packages, including Next.js 16, Prisma 7, Recharts, Upstash Redis, Zod, and Google Gen AI SDK.

### 3. Environment Configuration
Create a `.env` file in your project root. You can copy the template:
```bash
cp .env.example .env
```

Open `.env` and fill in the required variables:

```ini
# PostgreSQL database connection URL (Neon or Local)
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/apimon?schema=public"

# Long secure random string for session signature
SESSION_SECRET="change-this-to-a-very-long-and-secure-random-string-at-least-32-characters"

# Upstash Redis details (Optional for dev fallback)
UPSTASH_REDIS_REST_URL="https://your-upstash-redis-url.upstash.io"
UPSTASH_REDIS_REST_TOKEN="your-upstash-token"

# Gemini API Key (Get from Google AI Studio)
GEMINI_API_KEY="AIzaSy..."

# Public app URL
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

> [!NOTE]
> If `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are left blank, the platform automatically falls back to an in-memory rate limit store. This allows immediate development without setting up Upstash.

---

## 🗄️ Database Setup (Prisma 7)

Prisma 7 uses the `prisma.config.ts` file to configure connection URLs. Make sure you have completed the following:

### 1. Compile the Prisma Client
Generate the type definitions based on `schema.prisma`:
```bash
npx prisma generate
```

### 2. Apply Database Schema
Push the schema structure directly to your database:
```bash
npx prisma db push
```

---

## 🚀 Starting the Platform

Run the local development server:
```bash
npm run dev
```

The application will start on [http://localhost:3000](http://localhost:3000).

### Initial Account Registration
1.  Navigate to [http://localhost:3000/signup](http://localhost:3000/signup).
2.  Register a new account.
3.  On signup, the system automatically creates:
    *   A default project: `"My First API Project"`.
    *   A default team with you as the **Owner**.
    *   Mock logs and metrics so the dashboard visualizes chart data instantly!
