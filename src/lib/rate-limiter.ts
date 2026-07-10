import { Redis } from '@upstash/redis'
import { Ratelimit } from '@upstash/ratelimit'

// In-memory store for fallback rate limiting
type MemoryBucket = {
  count: number;
  resetTime: number;
}

type TokenBucketStore = {
  tokens: number;
  lastRefilled: number;
}

const fixedWindowStore = new Map<string, MemoryBucket>()
const slidingWindowStore = new Map<string, number[]>()
const tokenBucketStore = new Map<string, TokenBucketStore>()

// Periodic cleanup of memory stores to prevent leaks
if (typeof globalThis !== 'undefined') {
  const intervalId = 'apimon_ratelimit_cleanup'
  const g = globalThis as any
  if (!g[intervalId]) {
    g[intervalId] = setInterval(() => {
      const now = Date.now()
      // Cleanup fixed window
      for (const [key, bucket] of fixedWindowStore.entries()) {
        if (bucket.resetTime < now) {
          fixedWindowStore.delete(key)
        }
      }
      // Cleanup sliding window
      for (const [key, timestamps] of slidingWindowStore.entries()) {
        const activeTimestamps = timestamps.filter(t => t > now - 24 * 60 * 60 * 1000)
        if (activeTimestamps.length === 0) {
          slidingWindowStore.delete(key)
        } else {
          slidingWindowStore.set(key, activeTimestamps)
        }
      }
      // Cleanup token bucket
      for (const [key, bucket] of tokenBucketStore.entries()) {
        if (now - bucket.lastRefilled > 24 * 60 * 60 * 1000) {
          tokenBucketStore.delete(key)
        }
      }
    }, 60000) // cleanup every minute
  }
}

// Check if Upstash Redis is configured
const isRedisConfigured =
  process.env.UPSTASH_REDIS_REST_URL &&
  process.env.UPSTASH_REDIS_REST_TOKEN

let redisClient: Redis | null = null
if (isRedisConfigured) {
  try {
    redisClient = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  } catch (error) {
    console.error('Failed to initialize Upstash Redis client:', error)
  }
}

export type RateLimitStrategy = 'FIXED_WINDOW' | 'SLIDING_WINDOW' | 'TOKEN_BUCKET'

export interface RateLimitConfig {
  requestsPerSecond?: number | null
  requestsPerMinute?: number | null
  requestsPerHour?: number | null
  requestsPerDay?: number | null
  type: RateLimitStrategy
}

export interface RateLimitResult {
  success: boolean
  limit: number
  remaining: number
  reset: number // timestamp in ms when limit resets or refuels
  retryAfter: number // seconds to wait before retrying (0 if success is true)
}

// Local in-memory implementations of the rate limiting algorithms
function checkMemoryRateLimit(
  key: string,
  config: RateLimitConfig,
  limit: number,
  windowSeconds: number
): RateLimitResult {
  const now = Date.now()
  const windowMs = windowSeconds * 1000

  // 1. FIXED WINDOW
  if (config.type === 'FIXED_WINDOW') {
    const bucketKey = `${key}:fixed:${windowSeconds}`
    let bucket = fixedWindowStore.get(bucketKey)

    if (!bucket || bucket.resetTime <= now) {
      bucket = {
        count: 0,
        resetTime: now + windowMs,
      }
    }

    if (bucket.count >= limit) {
      const retryAfter = Math.max(1, Math.ceil((bucket.resetTime - now) / 1000))
      return {
        success: false,
        limit,
        remaining: 0,
        reset: bucket.resetTime,
        retryAfter,
      }
    }

    bucket.count += 1
    fixedWindowStore.set(bucketKey, bucket)

    return {
      success: true,
      limit,
      remaining: limit - bucket.count,
      reset: bucket.resetTime,
      retryAfter: 0,
    }
  }

  // 2. SLIDING WINDOW
  if (config.type === 'SLIDING_WINDOW') {
    const bucketKey = `${key}:sliding:${windowSeconds}`
    let timestamps = slidingWindowStore.get(bucketKey) || []

    // Remove timestamps outside current window
    const cutoff = now - windowMs
    timestamps = timestamps.filter(t => t > cutoff)

    if (timestamps.length >= limit) {
      const oldestInWindow = timestamps[0]
      const resetTime = oldestInWindow + windowMs
      const retryAfter = Math.max(1, Math.ceil((resetTime - now) / 1000))
      return {
        success: false,
        limit,
        remaining: 0,
        reset: resetTime,
        retryAfter,
      }
    }

    timestamps.push(now)
    slidingWindowStore.set(bucketKey, timestamps)

    const nextReset = timestamps[0] + windowMs

    return {
      success: true,
      limit,
      remaining: limit - timestamps.length,
      reset: nextReset,
      retryAfter: 0,
    }
  }

  // 3. TOKEN BUCKET
  // In Token Bucket, limit is the bucket capacity.
  // Refill rate is limit / windowSeconds per second.
  const refillRatePerSecond = limit / windowSeconds
  const bucketKey = `${key}:token`
  let bucket = tokenBucketStore.get(bucketKey)

  if (!bucket) {
    bucket = {
      tokens: limit,
      lastRefilled: now,
    }
  } else {
    // Calculate refilled tokens
    const elapsedSeconds = (now - bucket.lastRefilled) / 1000
    const tokensToAdd = elapsedSeconds * refillRatePerSecond
    bucket.tokens = Math.min(limit, bucket.tokens + tokensToAdd)
    bucket.lastRefilled = now
  }

  if (bucket.tokens < 1) {
    const tokensNeeded = 1 - bucket.tokens
    const secondsToRefill = tokensNeeded / refillRatePerSecond
    const resetTime = now + secondsToRefill * 1000
    const retryAfter = Math.max(1, Math.ceil(secondsToRefill))
    tokenBucketStore.set(bucketKey, bucket)
    
    return {
      success: false,
      limit,
      remaining: 0,
      reset: resetTime,
      retryAfter,
    }
  }

  bucket.tokens -= 1
  tokenBucketStore.set(bucketKey, bucket)

  const secondsToFull = (limit - bucket.tokens) / refillRatePerSecond

  return {
    success: true,
    limit,
    remaining: Math.floor(bucket.tokens),
    reset: now + secondsToFull * 1000,
    retryAfter: 0,
  }
}

// Redis (Upstash) implementation
async function checkRedisRateLimit(
  key: string,
  config: RateLimitConfig,
  limit: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  if (!redisClient) {
    return checkMemoryRateLimit(key, config, limit, windowSeconds)
  }

  try {
    const identifier = `${key}:${config.type}`
    let ratelimit: Ratelimit

    if (config.type === 'SLIDING_WINDOW') {
      ratelimit = new Ratelimit({
        redis: redisClient,
        limiter: Ratelimit.slidingWindow(limit, `${windowSeconds} s`),
        analytics: true,
      })
    } else if (config.type === 'TOKEN_BUCKET') {
      // Token bucket: max tokens = limit, refill rate = limit tokens per windowSeconds
      ratelimit = new Ratelimit({
        redis: redisClient,
        limiter: Ratelimit.tokenBucket(limit, `${windowSeconds} s`, limit),
        analytics: true,
      })
    } else {
      // Default: FIXED_WINDOW
      ratelimit = new Ratelimit({
        redis: redisClient,
        limiter: Ratelimit.fixedWindow(limit, `${windowSeconds} s`),
        analytics: true,
      })
    }

    const { success, limit: returnedLimit, remaining, reset } = await ratelimit.limit(identifier)
    const now = Date.now()
    const retryAfter = success ? 0 : Math.max(1, Math.ceil((reset - now) / 1000))

    return {
      success,
      limit: returnedLimit,
      remaining,
      reset,
      retryAfter,
    }
  } catch (error) {
    console.error('Upstash Redis error, falling back to memory rate limiting:', error)
    return checkMemoryRateLimit(key, config, limit, windowSeconds)
  }
}

// Master rate limit checker
export async function checkRateLimit(
  apiKeyId: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  // Determine smallest window defined
  let limit = 60
  let windowSeconds = 60 // 1 minute default

  if (config.requestsPerSecond) {
    limit = config.requestsPerSecond
    windowSeconds = 1
  } else if (config.requestsPerMinute) {
    limit = config.requestsPerMinute
    windowSeconds = 60
  } else if (config.requestsPerHour) {
    limit = config.requestsPerHour
    windowSeconds = 3600
  } else if (config.requestsPerDay) {
    limit = config.requestsPerDay
    windowSeconds = 86400
  }

  const key = `apimon:ratelimit:${apiKeyId}`

  if (redisClient) {
    return checkRedisRateLimit(key, config, limit, windowSeconds)
  } else {
    return checkMemoryRateLimit(key, config, limit, windowSeconds)
  }
}
