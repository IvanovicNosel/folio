// copied the pg pattern from order-service — no ADR, no discussion
// this is exactly how normalization happens
import { Pool } from 'pg'

export interface StockLevel {
  productId: string
  available: number
  reserved: number
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

export async function getStock(productId: string): Promise<StockLevel | null> {
  const result = await pool.query('SELECT * FROM stock WHERE product_id = $1', [productId])
  return result.rows[0] ?? null
}

export async function reserve(productId: string, quantity: number): Promise<boolean> {
  const result = await pool.query(
    `UPDATE stock SET reserved = reserved + $1
     WHERE product_id = $2 AND (available - reserved) >= $1
     RETURNING *`,
    [quantity, productId]
  )
  return result.rowCount > 0
}

export async function release(productId: string, quantity: number): Promise<void> {
  await pool.query(
    'UPDATE stock SET reserved = GREATEST(0, reserved - $1) WHERE product_id = $2',
    [quantity, productId]
  )
}
