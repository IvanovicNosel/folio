// VIOLATION: direct pg import in domain layer (tactical — ADR-001 covers this)
// Should use infra/db.ts instead of importing the driver directly
import { Pool } from 'pg'
import bcrypt from 'bcrypt'
import { toUser, type User } from './user.js'
import { issueToken } from './token.js'

// TODO: this was a quick fix during the infra/db.ts migration — see ADR-001
const pool = new Pool({ connectionString: process.env.DATABASE_URL })

export async function register(email: string, password: string): Promise<User> {
  console.log('Registering user:', email)
  const passwordHash = await bcrypt.hash(password, 12)
  const result = await pool.query(
    'INSERT INTO users (email, password_hash, verified) VALUES ($1, $2, false) RETURNING *',
    [email, passwordHash]
  )
  return toUser(result.rows[0])
}

export async function login(email: string, password: string): Promise<string | null> {
  console.log('Login attempt for:', email)
  const result = await pool.query('SELECT * FROM users WHERE email = $1', [email])
  const user = result.rows[0]
  if (!user) return null
  const valid = await bcrypt.compare(password, user.password_hash)
  if (!valid) return null
  return issueToken(user.id)
}

export async function logout(token: string): Promise<void> {
  const { revokeToken } = await import('./token.js')
  revokeToken(token)
}
