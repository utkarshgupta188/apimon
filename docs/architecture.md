# System Architecture

This document describes the codebase structure, component relations, data flow, and runtime boundaries of the APIMon platform.

---

## 🏗️ Folder Structure

The application is structured inside a modern Next.js `src/` directory layout:

*   `src/app/`: Next.js App Router routes, API handlers, and UI pages.
    *   `src/app/api/auth/`: Credentials signup, login, logout, and session status handlers.
    *   `src/app/api/projects/`: Projects listing, creation, and settings update.
    *   `src/app/api/api-keys/`: Secure key generation, regeneration, and RBAC controls.
    *   `src/app/api/v1/[...path]/`: API Gateway dynamic dynamic-catch route for rate limiting and proxying.
    *   `src/app/api/ai/analyze/`: Gemini API integration for generating performance reports.
    *   `src/app/dashboard/`: UI pages for overview metrics, analytics, logs, keys, and settings.
*   `src/components/`: Reusable React components (Dashboard Shell, Command Palette).
*   `src/lib/`: Reusable utilities and context wrappers (DB connection, Auth Context, Rate Limiting engine).
*   `prisma/`: Prisma 7 Database schema configurations.

---

## 🔄 Core Data Flow

APIMon acts as an intelligent API Gateway in front of user backends. The diagram below details the route validation and rate limiting sequence when a request hits the gateway:

```mermaid
sequenceDiagram
    autonumber
    actor Client as Client App
    participant GW as API Gateway (/api/v1/*)
    participant DB as Postgres Database
    participant RD as Upstash Redis (or Memory Store)
    participant BE as Target Backend Service

    Client->>GW: GET /api/v1/users (Headers: x-api-key: apim_live_...)
    GW->>GW: Extract key & compute SHA-256 Hash
    GW->>DB: Find active API Key by Hash
    alt Key not found or inactive
        DB-->>GW: Null
        GW-->>Client: HTTP 401 Unauthorized
    else Key is valid
        DB-->>GW: Key Config + Rate Limit rules
        GW->>RD: Increment counter & evaluate window
        alt Rate limit exceeded
            RD-->>GW: Block (Retry-After = X seconds)
            GW->>DB: Log blocked request (Status: 429)
            GW-->>Client: HTTP 429 Too Many Requests (Retry-After header)
        else Rate limit allowed
            RD-->>GW: Pass (Remaining = Y)
            GW->>DB: Update lastUsedAt timestamp (background)
            alt Project has Base URL configured
                GW->>BE: Forward GET request to target URL
                BE-->>GW: Response Payload (Latency = Z ms)
                GW->>DB: Log request metrics (Status: 200, Latency: Z)
                GW-->>Client: Return Backend Response (HTTP 200)
            else No Base URL configured
                GW->>GW: Simulate Mock Success Response (200 OK)
                GW->>DB: Log simulated request (Status: 200, Latency: 45ms)
                GW-->>Client: Return Mock Response (HTTP 200)
            end
        end
    end
```

---

## 🔒 Security Design

1.  **API Key Hashing**: Plain-text keys are generated once on the client and are never stored in the database. Instead, a fast and secure cryptographic hash (SHA-256) is computed and stored. Gateway requests compute the SHA-256 hash of the header token and match it against the DB index in $O(1)$ time.
2.  **Session Authentication**: Built with secure HTTP-only cookies signed by the server (`apimon_session`) containing database-backed session tokens.
3.  **RBAC Rules (Role-Based Access Control)**:
    *   `OWNER`: Full project access, billing controls, and deletion privileges.
    *   `ADMIN`: Can invite team members, configure endpoints, and generate API keys.
    *   `MEMBER`: Can view request logs, check analytics dashboards, and read key configurations.
4.  **Database Protection**: SQL injection protection is enforced natively via Prisma's typed parameterization. Input sanitization is done with strict Zod validation schemas.
