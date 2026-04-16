const store = new Map<string, { value: string; expiresAt: number }>()

export function cacheSet(key: string, value: string, ttlSeconds: number): void {
  store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 })
}

export function cacheGet(key: string): string | null {
  const entry = store.get(key)
  if (!entry) return null
  if (Date.now() > entry.expiresAt) { store.delete(key); return null }
  return entry.value
}

export function cacheDel(key: string): void {
  store.delete(key)
}
