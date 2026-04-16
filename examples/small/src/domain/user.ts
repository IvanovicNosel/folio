export interface User {
  id: string
  email: string
  passwordHash: string
  createdAt: Date
  verified: boolean
}

export interface UserRecord {
  id: string
  email: string
  password_hash: string
  created_at: Date
  verified: boolean
}

export function toUser(row: UserRecord): User {
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    createdAt: row.created_at,
    verified: row.verified,
  }
}
