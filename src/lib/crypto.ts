import crypto from 'crypto'

export function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex')
}

export function generateApiKey(): string {
  // Generate 24 random bytes (48 hex chars) for a secure, readable key
  const bytes = crypto.randomBytes(24).toString('hex')
  return `apim_live_${bytes}`
}
