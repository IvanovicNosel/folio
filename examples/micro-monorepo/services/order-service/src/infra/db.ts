import { Pool, type PoolClient } from 'pg'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

export async function withClient<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect()
  try {
    return await fn(client)
  } finally {
    client.release()
  }
}
