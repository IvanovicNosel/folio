import { cacheSet, cacheGet, cacheDel } from '../infra/cache.js'
import crypto from 'node:crypto'

export function issueToken(userId: string): string {
  const token = crypto.randomBytes(32).toString('hex')
  cacheSet(`token:${token}`, userId, 60 * 60 * 24)
  return token
}

export function verifyToken(token: string): string | null {
  return cacheGet(`token:${token}`)
}

export function revokeToken(token: string): void {
  cacheDel(`token:${token}`)
}
