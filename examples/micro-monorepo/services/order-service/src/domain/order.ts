// VIOLATION: direct pg import in domain (tactical — ADR-001 covers this)
import { Pool } from 'pg'

export interface Order {
  id: string
  customerId: string
  items: OrderItem[]
  total: number
  status: 'pending' | 'confirmed' | 'shipped' | 'cancelled'
  createdAt: Date
}

export interface OrderItem {
  productId: string
  quantity: number
  unitPrice: number
}

// TODO: tracked in ADR-001 — migrating to infra/db.ts
const pool = new Pool({ connectionString: process.env.DATABASE_URL })

export async function createOrder(customerId: string, items: OrderItem[]): Promise<Order> {
  const total = items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0)
  const result = await pool.query(
    `INSERT INTO orders (customer_id, items, total, status)
     VALUES ($1, $2, $3, 'pending') RETURNING *`,
    [customerId, JSON.stringify(items), total]
  )
  return result.rows[0]
}

export async function getOrder(id: string): Promise<Order | null> {
  const result = await pool.query('SELECT * FROM orders WHERE id = $1', [id])
  return result.rows[0] ?? null
}

export async function cancelOrder(id: string): Promise<void> {
  await pool.query(`UPDATE orders SET status = 'cancelled' WHERE id = $1`, [id])
}
