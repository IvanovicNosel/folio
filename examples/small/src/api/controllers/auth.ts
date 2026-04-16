import type { Request, Response } from 'express'
// VIOLATION: api layer importing directly from infra — bypasses domain entirely
// No ADR covers this. This is a genuine strategic violation.
import { getPool } from '../../infra/db.js'
import { register, login } from '../../domain/auth-service.js'
import type { AuthRequest } from '../middleware.js'

export async function registerHandler(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body
  if (!email || !password) {
    res.status(400).json({ error: 'email and password required' })
    return
  }
  try {
    const user = await register(email, password)
    res.status(201).json({ id: user.id, email: user.email })
  } catch (err: unknown) {
    if ((err as { code?: string }).code === '23505') {
      res.status(409).json({ error: 'Email already registered' })
      return
    }
    throw err
  }
}

export async function loginHandler(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body
  const token = await login(email, password)
  if (!token) {
    res.status(401).json({ error: 'Invalid credentials' })
    return
  }
  res.json({ token })
}

export async function meHandler(req: AuthRequest, res: Response): Promise<void> {
  // Reaching directly into infra to avoid going through the domain service
  // This is the real violation: the controller owns a query that belongs in the domain
  const pool = getPool()
  const result = await pool.query('SELECT id, email, verified FROM users WHERE id = $1', [req.userId])
  if (!result.rows[0]) { res.status(404).json({ error: 'User not found' }); return }
  res.json(result.rows[0])
}
