import type { Request, Response, NextFunction } from 'express'
import { verifyToken } from '../domain/token.js'

export interface AuthRequest extends Request {
  userId?: string
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }
  const token = header.slice(7)
  const userId = verifyToken(token)
  if (!userId) {
    res.status(401).json({ error: 'Invalid or expired token' })
    return
  }
  req.userId = userId
  next()
}
