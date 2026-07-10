# API Gateway Documentation

This document explains how to call endpoints through the APIMon API Gateway and inspect rate limiting status headers.

---

## 🚦 Endpoint Routing Scheme

All client traffic is proxied through the catch-all gateway path:
`http://localhost:3000/api/v1/[...path]`

When a request hits this URL, the gateway:
1.  Verifies the credentials and matches the path.
2.  Applies rate limits.
3.  Proxies the request to your project's configured **Base URL** (or returns a simulated mock response if no Base URL is configured).

### Example
If your project Base URL is `https://api.myapp.com`, then calling:
```http
GET http://localhost:3000/api/v1/users?limit=10
```
will proxy the request to:
```http
GET https://api.myapp.com/users?limit=10
```

---

## 🔑 Authentication

Clients must authenticate their requests by providing their API Key in one of two ways:

### 1. HTTP Header (Recommended)
```http
x-api-key: apim_live_83ba...
```

### 2. Authorization Bearer Token
```http
Authorization: Bearer apim_live_83ba...
```

---

## ⏳ Rate Limiting Response Headers

Every successful or rate-limited response processed by the gateway returns standard HTTP headers indicating limit allocations:

| Header Name | Type | Description |
| :--- | :--- | :--- |
| `X-RateLimit-Limit` | Integer | The maximum number of requests allowed in the current time window. |
| `X-RateLimit-Remaining` | Integer | The number of requests remaining in the current time window. |
| `X-RateLimit-Reset` | Timestamp | Unix epoch timestamp (in milliseconds) when the rate limit window resets. |

---

## ❌ Error Codes & Responses

### 1. 401 Unauthorized
Returned when the API key is missing, invalid, expired, or deactivated.
```json
{
  "error": "Unauthorized. API Key is invalid or deactivated."
}
```

### 2. 403 Forbidden
Returned when the target path matches a registered endpoint that has been disabled in the dashboard.
```json
{
  "error": "Forbidden. Endpoint is disabled."
}
```

### 3. 429 Too Many Requests
Returned when the client exceeds the configured rate limit.
```json
{
  "error": "Too Many Requests",
  "message": "API rate limit exceeded. Retry in 14 seconds."
}
```

#### Headers Returned
```http
HTTP/1.1 429 Too Many Requests
Content-Type: application/json
Retry-After: 14
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1779262100000
```
**`Retry-After`**: Seconds the client must wait before retrying the call.
