import express from 'express'
import { Pool } from 'pg'

const app = express()
app.use(express.json())

const db = new Pool({ connectionString: process.env.DATABASE_URL })

app.get('/todos', async (req, res) => {
  console.log('GET /todos')
  const result = await db.query('SELECT * FROM todos ORDER BY created_at DESC')
  res.json(result.rows)
})

app.post('/todos', async (req, res) => {
  const { title } = req.body
  console.log('Creating todo:', title)
  const result = await db.query(
    'INSERT INTO todos (title, done) VALUES ($1, false) RETURNING *',
    [title]
  )
  res.status(201).json(result.rows[0])
})

app.patch('/todos/:id', async (req, res) => {
  const { id } = req.params
  const { done } = req.body
  console.log(`Updating todo ${id}:`, done)
  const result = await db.query(
    'UPDATE todos SET done = $1 WHERE id = $2 RETURNING *',
    [done, id]
  )
  if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' })
  res.json(result.rows[0])
})

app.delete('/todos/:id', async (req, res) => {
  const { id } = req.params
  console.log(`Deleting todo ${id}`)
  await db.query('DELETE FROM todos WHERE id = $1', [id])
  res.status(204).send()
})

app.listen(3000, () => console.log('listening on :3000'))
