import { Router } from 'express'
import { notifyOrderConfirmed, notifyOrderShipped, notifyOrderCancelled } from '../domain/notification.js'

const router = Router()

router.post('/notify/order-confirmed', async (req, res) => {
  await notifyOrderConfirmed(req.body.email, req.body.orderId)
  res.status(204).send()
})

router.post('/notify/order-shipped', async (req, res) => {
  await notifyOrderShipped(req.body.email, req.body.orderId, req.body.trackingCode)
  res.status(204).send()
})

router.post('/notify/order-cancelled', async (req, res) => {
  await notifyOrderCancelled(req.body.email, req.body.orderId)
  res.status(204).send()
})

export default router
