import { Router } from 'express'
import { getStock, reserve, release } from '../domain/stock.js'

const router = Router()

router.get('/stock/:productId', async (req, res) => {
  const stock = await getStock(req.params.productId)
  if (!stock) return res.status(404).json({ error: 'Product not found' })
  res.json(stock)
})

router.post('/stock/:productId/reserve', async (req, res) => {
  const ok = await reserve(req.params.productId, req.body.quantity)
  if (!ok) return res.status(409).json({ error: 'Insufficient stock' })
  res.status(204).send()
})

router.post('/stock/:productId/release', async (req, res) => {
  await release(req.params.productId, req.body.quantity)
  res.status(204).send()
})

export default router
