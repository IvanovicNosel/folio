import { Router } from 'express'
import { createOrder, getOrder, cancelOrder } from '../domain/order.js'

const router = Router()

router.post('/orders', async (req, res) => {
  const order = await createOrder(req.body.customerId, req.body.items)
  res.status(201).json(order)
})

router.get('/orders/:id', async (req, res) => {
  const order = await getOrder(req.params.id)
  if (!order) return res.status(404).json({ error: 'Not found' })
  res.json(order)
})

router.post('/orders/:id/cancel', async (req, res) => {
  await cancelOrder(req.params.id)
  res.status(204).send()
})

export default router
